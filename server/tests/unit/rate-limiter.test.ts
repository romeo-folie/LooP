import express, { Request, Response, NextFunction } from "express";
import request from "supertest";
import {
  createPerUserRateLimiter,
  RateLimiterOptions,
} from "../../src/middleware/rate-limiter";
import type Redis from "ioredis";

type MockRedis = {
  defineCommand: jest.Mock;
  consumeTokens: jest.Mock<Promise<any>, any[]>;
};

function makeMockRedis(): MockRedis {
  return {
    defineCommand: jest.fn(),
    consumeTokens: jest.fn(),
  };
}

const fakeLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as unknown as Parameters<typeof createPerUserRateLimiter>[0]["logger"];

describe("rate limiter middleware", () => {
  let mockRedis: MockRedis;
  const capacity = 12;
  const hourlyQuota = 300;
  const refillPerSecond = hourlyQuota / 3600;
  const ttlSeconds = 60 * 60 * 2;

  beforeEach(() => {
    mockRedis = makeMockRedis();
    jest.clearAllMocks();
  });

  describe("missing authUser (should skip limiter)", () => {
    it("skips consumeTokens and calls next handler when req.authUser is missing", async () => {
      // Create an instance of the limiter middleware using the mock Redis
      const limiterFactory = createPerUserRateLimiter({
        redis: mockRedis as unknown as Redis,
        logger: fakeLogger,
        capacity,
        refillPerSecond,
        ttlSeconds,
        keyPrefix: "rl:test:",
        failClosed: false,
      } as RateLimiterOptions);

      const app = express();
      // mount the limiter on a test route
      app.get("/", limiterFactory(), (req: Request, res: Response) => {
        res.status(200).json({ ok: true });
      });

      const resp = await request(app).get("/");

      expect(resp.status).toBe(200);
      expect(resp.body).toEqual({ ok: true });

      // Because no authUser was set, consumeTokens should NOT have been called
      expect(mockRedis.defineCommand).toHaveBeenCalled(); // script registration happened
      expect(mockRedis.consumeTokens).not.toHaveBeenCalled();
    });
  });

  describe("allowed reply from redis consumeTokens", () => {
    it("calls redis.consumeTokens, sets headers, and allows request when allowed=1", async () => {
      // Arrange: prepare mock reply from the Lua script
      // reply: [allowed, remaining, retryAfterSeconds, capacity]
      const mockReply = [1, 11, 0, capacity];

      mockRedis.consumeTokens.mockResolvedValueOnce(mockReply);

      const limiterFactory = createPerUserRateLimiter({
        redis: mockRedis as unknown as Redis,
        logger: fakeLogger,
        capacity,
        refillPerSecond,
        ttlSeconds,
        keyPrefix: "rl:test:",
        failClosed: false,
      } as RateLimiterOptions);

      const app = express();

      // Test auth middleware: read x-test-user header and set req.authUser.userId
      app.use((req: Request, _res: Response, next: NextFunction) => {
        const testUser = req.header("x-test-user");
        if (testUser) {
          // attach to req in the same shape as your AppRequest expects
          (req as any).authUser = { userId: testUser };
        }
        next();
      });

      // mount the limiter on a test route
      app.get("/protected", limiterFactory(), (req: Request, res: Response) => {
        res.status(200).json({ ok: true });
      });

      const testUserId = "user-123";

      const resp = await request(app)
        .get("/protected")
        .set("x-test-user", testUserId);

      // Assert response ok
      expect(resp.status).toBe(200);
      expect(resp.body).toEqual({ ok: true });

      // Assert headers set by the middleware
      expect(resp.headers["x-ratelimit-limit"]).toBe(String(capacity));
      expect(resp.headers["x-ratelimit-remaining"]).toBe(String(11));
      expect(resp.headers["x-ratelimit-cost"]).toBe(String(1)); // default cost in factory
      // Retry-After header should not be present for allowed requests
      expect(resp.headers["retry-after"]).toBeUndefined();

      // Assert consumeTokens was called with expected args
      // The key prefix used in limiter factory was "rl:test:" so key should be "rl:test:<userId>"
      expect(mockRedis.consumeTokens).toHaveBeenCalledTimes(1);

      const callArgs = mockRedis.consumeTokens.mock.calls[0] as any[];
      // call shape: (key, capacityStr, refillPerSecondStr, costStr, ttlSecondsStr)
      expect(callArgs[0]).toBe(`rl:test:${testUserId}`);
      expect(callArgs[1]).toBe(String(capacity));
      // refillPerSecond may be a float string; compare numeric value
      expect(Number(callArgs[2])).toBeCloseTo(refillPerSecond);
      expect(callArgs[3]).toBe(String(1)); // default cost
      expect(callArgs[4]).toBe(String(ttlSeconds));
    });
  });
});
