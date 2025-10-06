import { Result } from "ioredis";
declare module "ioredis" {
  interface RedisCommander<Context> {
    consumeTokens(
      key: string,
      capacity: string,
      refillPerSecond: string,
      cost: string,
      ttlSeconds: string,
    ): Result<[string, string, string, string], Context>;
  }
}
