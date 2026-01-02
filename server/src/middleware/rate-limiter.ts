import Redis from "ioredis";
import logger from "../lib/winston-config";
import { createPerUserRateLimiter } from "../lib/create-rate-limiter";

const capacity = 20; // allow bursts up to capacity
const hourlyQuota = 600;
const refillPerSecond = hourlyQuota / 3600; // tokens per second
export const redisClient = new Redis(process.env.REDIS_URL as string);

// Log Redis connection events
redisClient.on("connect", () => {
  logger.info("✅ Connected to Redis", {
    host: redisClient.options.host,
    port: redisClient.options.port,
  });
});

redisClient.on("ready", () => {
  logger.info("✅ Redis client ready");
});

redisClient.on("error", (err) => {
  logger.error("❌ Redis connection error", {
    error: err.message,
    stack: err.stack,
  });
});

redisClient.on("close", () => {
  logger.warn("⚠️ Redis connection closed");
});

redisClient.on("reconnecting", () => {
  logger.info("🔄 Redis reconnecting...");
});

export const limiter = createPerUserRateLimiter({
  redis: redisClient,
  logger,
  capacity,
  refillPerSecond,
  ttlSeconds: 60 * 60 * 2,
});

export async function shutdownRedis(): Promise<void> {
  if (process.env.NODE_ENV === "test" && redisClient) {
    try {
      await redisClient.quit();
    } catch (err) {
      try {
        redisClient.disconnect();
      } catch (e) {
        //swallow
      }
    }
  }
}
