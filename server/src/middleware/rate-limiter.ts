import Redis from "ioredis";
import logger from "../lib/winston-config";
import { createPerUserRateLimiter } from "../lib/create-rate-limiter";

const capacity = 20; // allow bursts up to capacity
const hourlyQuota = 600;
const refillPerSecond = hourlyQuota / 3600; // tokens per second
export const redisClient = new Redis(process.env.REDIS_URL as string);

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
