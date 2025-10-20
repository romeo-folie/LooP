import { Response, NextFunction } from "express";
import Redis from "ioredis";
import type { Logger } from "winston";
import type { AppRequest } from "../types";

// Per user token bucket options
export interface RateLimiterOptions {
  redis: Redis;
  logger: Logger;
  capacity: number; // max tokens (burst capacity)
  refillPerSecond: number; // tokens added per second
  keyPrefix?: string; // prefix for redis keys, default "rl:user:"
  ttlSeconds?: number; // TTL for redis keys
  failClosed?: boolean; // if true, on Redis error respond 503; otherwise fail-open (allow)
}

type RouteLimiterOptions = { cost?: number };

export function createPerUserRateLimiter(opts: RateLimiterOptions) {
  const {
    redis,
    logger,
    capacity,
    refillPerSecond,
    keyPrefix = "rl:user:",
    ttlSeconds = 3600,
    failClosed = false,
  } = opts;

  // Lua script
  const SCRIPT = `
    -- KEYS[1] = key
    -- ARGV[1] = capacity
    -- ARGV[2] = refill_per_sec
    -- ARGV[3] = cost
    -- ARGV[4] = ttl_seconds
    local key = KEYS[1]
    local capacity = tonumber(ARGV[1])
    local refill_per_sec = tonumber(ARGV[2])
    local cost = tonumber(ARGV[3])
    local ttl_seconds = tonumber(ARGV[4]) or 3600
    local redis_time = redis.call("TIME")
    local now_ms = tonumber(redis_time[1]) * 1000 + math.floor(tonumber(redis_time[2]) / 1000)
    local data = redis.call("HMGET", key, "tokens", "last_refill_timestamp")
    local tokens = tonumber(data[1])
    local last_refill_timestamp = tonumber(data[2])
    if tokens == nil or last_refill_timestamp == nil then
      tokens = capacity
      last_refill_timestamp = now_ms
    end
    local elapsed_ms = now_ms - last_refill_timestamp
    if elapsed_ms < 0 then
      elapsed_ms = 0
    end
    local to_add = (elapsed_ms / 1000.0) * refill_per_sec
    tokens = math.min(capacity, tokens + to_add)
    last_refill_timestamp = now_ms
    local allowed = 0
    local retry_after_seconds = 0
    if tokens >= cost then
      allowed = 1
      tokens = tokens - cost
    else
      allowed = 0
      local missing = cost - tokens
      if refill_per_sec > 0 then
        retry_after_seconds = math.ceil(missing / refill_per_sec)
      else
        retry_after_seconds = 2147483647
      end
    end
    redis.call("HMSET", key, "tokens", tostring(tokens), "last_refill_timestamp", tostring(last_refill_timestamp))
    redis.call("EXPIRE", key, ttl_seconds)
    local remaining = math.floor(tokens)
    local cap_int = math.floor(capacity)
    return { allowed, remaining, retry_after_seconds, cap_int }
  `;

  // register command once
  redis.defineCommand("consumeTokens", {
    numberOfKeys: 1,
    lua: SCRIPT,
  });

  function limiter(routeOpts: RouteLimiterOptions = {}) {
    const cost = routeOpts.cost ?? 1;

    return async function perUserLimiterMiddleware(
      req: AppRequest,
      res: Response,
      next: NextFunction,
    ) {
      const userId = req.authUser?.userId;

      if (!userId) {
        logger.debug(
          "rate-limiter: missing authUser.userId — skipping per-user limiter",
          {
            path: req.path,
            method: req.method,
          },
        );
        next();
        return;
      }

      const key = `${keyPrefix}${userId}`;

      try {
        const reply = await redis.consumeTokens(
          key,
          String(capacity),
          String(refillPerSecond),
          String(cost),
          String(ttlSeconds),
        );

        const allowed = Number(reply[0]) === 1;
        const remaining = Number(reply[1]);
        const retryAfter = Number(reply[2]); // seconds
        const cap = Number(reply[3]);

        // set headers
        res.setHeader("X-RateLimit-Limit", String(cap));
        res.setHeader("X-RateLimit-Remaining", String(Math.max(0, remaining)));
        res.setHeader("X-RateLimit-Cost", String(cost));
        if (!allowed) {
          res.setHeader("Retry-After", String(retryAfter));
          logger.info("rate-limiter: request denied", {
            userId,
            path: req.path,
            method: req.method,
            remaining,
            retryAfter,
            cost,
          });
          res.status(429).json({
            error: "Too Many Requests",
            message: `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
          });
          return;
        }

        // allowed: continue the chain
        next();
      } catch (err) {
        logger.error("rate-limiter: redis/script error", {
          error:
            err instanceof Error
              ? { message: err.message, stack: err.stack }
              : err,
          userId,
          path: req.path,
          method: req.method,
        });

        if (failClosed) {
          res.status(503).json({
            error: "Service Unavailable",
            message: "Rate limiter unavailable",
          });
        } else {
          // fail-open: allow request through
          next();
        }
      }
    };
  }

  return limiter;
}
