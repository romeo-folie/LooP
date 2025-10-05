import express, { Request, Response, NextFunction } from "express";
import request from "supertest";
import {
  createPerUserRateLimiter,
  RateLimiterOptions,
} from "../../src/middleware/rate-limiter";
import type Redis from "ioredis";

type ConsumeArgs = [string, string, string, string, string];
type ConsumeReply = [
  string | number,
  string | number,
  string | number,
  string | number,
];

type MockRedis = {
  defineCommand: jest.Mock;
  consumeTokens: jest.Mock<Promise<ConsumeReply>, ConsumeArgs>;
};

function makeMockRedis(): MockRedis {
  return {
    defineCommand: jest.fn(),
    consumeTokens: jest.fn() as MockRedis["consumeTokens"],
  };
}

const fakeLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as unknown as Parameters<typeof createPerUserRateLimiter>[0]["logger"];

interface TestRequest extends Request {
  authUser: { userId: string | number };
}

describe("rate limiter middleware", () => {
  let mockRedis: MockRedis;
  const capacity = 20;
  const hourlyQuota = 600;
  const refillPerSecond = hourlyQuota / 3600;
  const ttlSeconds = 60 * 60 * 2;

  beforeEach(() => {
    mockRedis = makeMockRedis();
    jest.clearAllMocks();
  });

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

  it("calls redis.consumeTokens, sets headers, and allows request when allowed=1", async () => {
    // mock consumeTokensreply: [allowed, remaining, retryAfterSeconds, capacity]
    const mockReply = [1, 11, 0, capacity] as ConsumeReply;

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
        (req as TestRequest).authUser = { userId: testUser };
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

    const callArgs = mockRedis.consumeTokens.mock.calls[0] as ConsumeArgs;
    // call shape: (key, capacityStr, refillPerSecondStr, costStr, ttlSecondsStr)
    expect(callArgs[0]).toBe(`rl:test:${testUserId}`);
    expect(callArgs[1]).toBe(String(capacity));
    // refillPerSecond may be a float string; compare numeric value
    expect(Number(callArgs[2])).toBeCloseTo(refillPerSecond);
    expect(callArgs[3]).toBe(String(1)); // default cost
    expect(callArgs[4]).toBe(String(ttlSeconds));
  });

  it("should respond 429 and set Retry-After when consumeTokens returns denied", async () => {
    // mock consumeTokensreply: [allowed, remaining, retryAfterSeconds, capacity]
    const deniedReply = [0, 0, 3, capacity] as ConsumeReply;
    mockRedis.consumeTokens.mockResolvedValueOnce(deniedReply);

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

    // test auth middleware
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const testUser = req.header("x-test-user");
      if (testUser) {
        (req as TestRequest).authUser = { userId: testUser };
      }
      next();
    });

    app.get(
      "/protected-denied",
      limiterFactory(),
      (req: Request, res: Response) => {
        // If reached, test should fail (we expect middleware to stop and send 429)
        res.status(200).json({ reached: true });
      },
    );

    const resp = await request(app)
      .get("/protected-denied")
      .set("x-test-user", "user-denied");

    expect(resp.status).toBe(429);
    expect(resp.body).toEqual(
      expect.objectContaining({
        error: "Too Many Requests",
      }),
    );
    expect(resp.headers["retry-after"]).toBe(String(3));
    // ConsumeTokens was invoked once
    expect(mockRedis.consumeTokens).toHaveBeenCalledTimes(1);
  });

  it("should allow request through (fail-open) when redis throws and failClosed=false", async () => {
    mockRedis.consumeTokens.mockRejectedValueOnce(new Error("redis down"));

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

    // test auth middleware
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const testUser = req.header("x-test-user");
      if (testUser) {
        (req as TestRequest).authUser = { userId: testUser };
      }
      next();
    });

    // route protected by limiter
    app.get(
      "/protected-failopen",
      limiterFactory(),
      (req: Request, res: Response) => {
        res.status(200).json({ ok: true });
      },
    );

    const resp = await request(app)
      .get("/protected-failopen")
      .set("x-test-user", "user-failopen");

    expect(resp.status).toBe(200);
    expect(resp.body).toEqual({ ok: true });

    // ensure consumeTokens was called and threw
    expect(mockRedis.consumeTokens).toHaveBeenCalledTimes(1);
    // logger.error should have been called at least once
    expect(
      (fakeLogger.error as jest.Mock).mock.calls.length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("should respond 503 when redis throws and failClosed=true", async () => {
    mockRedis.consumeTokens.mockRejectedValueOnce(new Error("redis boom"));

    const limiterFactory = createPerUserRateLimiter({
      redis: mockRedis as unknown as Redis,
      logger: fakeLogger,
      capacity,
      refillPerSecond,
      ttlSeconds,
      keyPrefix: "rl:test:",
      failClosed: true,
    } as RateLimiterOptions);

    const app = express();

    // test auth middleware
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const testUser = req.header("x-test-user");
      if (testUser) {
        (req as TestRequest).authUser = { userId: testUser };
      }
      next();
    });

    app.get(
      "/protected-failclosed",
      limiterFactory(),
      (req: Request, res: Response) => {
        // should NOT reach here
        res.status(200).json({ reached: true });
      },
    );

    const resp = await request(app)
      .get("/protected-failclosed")
      .set("x-test-user", "user-failclosed");

    expect(resp.status).toBe(503);
    expect(resp.body).toEqual(
      expect.objectContaining({
        error: "Service Unavailable",
      }),
    );

    // ensure consumeTokens was called and threw
    expect(mockRedis.consumeTokens).toHaveBeenCalledTimes(1);
    // logger.error should have been called
    expect(
      (fakeLogger.error as jest.Mock).mock.calls.length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("should call consumeTokens with the configured cost and set X-RateLimit-Cost and other headers", async () => {
    const costForRoute = 3;
    // Simulate the Lua script returning allowed=1 and remaining=capacity-cost
    const remainingAfter = capacity - costForRoute; // e.g., 12 - 3 = 9
    const mockReply = [1, remainingAfter, 0, capacity] as ConsumeReply;

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

    // test auth middleware: set req.authUser.userId from header
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const testUser = req.header("x-test-user");
      if (testUser) {
        (req as TestRequest).authUser = { userId: testUser };
      }
      next();
    });

    // mount route with explicit cost
    app.get(
      "/with-cost",
      limiterFactory({ cost: costForRoute }),
      (req: Request, res: Response) => {
        res.status(200).json({ ok: true });
      },
    );

    const testUserId = "user-cost-1";
    const resp = await request(app)
      .get("/with-cost")
      .set("x-test-user", testUserId);

    // Assert success and body
    expect(resp.status).toBe(200);
    expect(resp.body).toEqual({ ok: true });

    // Assert headers are set correctly
    expect(resp.headers["x-ratelimit-limit"]).toBe(String(capacity));
    expect(resp.headers["x-ratelimit-remaining"]).toBe(String(remainingAfter));
    expect(resp.headers["x-ratelimit-cost"]).toBe(String(costForRoute));

    // Assert consumeTokens called once with expected args
    expect(mockRedis.consumeTokens).toHaveBeenCalledTimes(1);
    const callArgs = mockRedis.consumeTokens.mock.calls[0] as ConsumeArgs;
    expect(callArgs[0]).toBe(`rl:test:${testUserId}`); // key
    expect(callArgs[1]).toBe(String(capacity));
    expect(Number(callArgs[2])).toBeCloseTo(refillPerSecond);
    expect(callArgs[3]).toBe(String(costForRoute)); // cost passed correctly
    expect(callArgs[4]).toBe(String(ttlSeconds));
  });
});
