import type Redis from "ioredis";

declare module "ioredis" {
  interface Redis {
    consumeTokens(
      key: string,
      capacity: string,
      refillPerSecond: string,
      cost: string,
      ttlSeconds: string,
    ): Promise<[string, string, string, string]>;
  }
}
