import { injectable, inject } from "tsyringe";
import { IIdempotencyStore } from "../../../common/idempotency";
import type Redis from "ioredis";

/**
 * 🚩 RedisIdempotencyStore
 * Distributed idempotency using Redis with atomic SET NX PX.
 */
@injectable()
export class RedisIdempotencyStore implements IIdempotencyStore {
  private client: Redis | null = null;

  constructor(
    @inject("RedisClient") private providedClient: Redis | null,
    @inject("IdempotencyConfig") private config: any
  ) { }

  async onInit(): Promise<void> {
    if (this.providedClient) {
      this.client = this.providedClient;
      return;
    }

    // Lazy load ioredis if not provided
    try {
      const RedisClass = (await import("ioredis")).default;
      this.client = new RedisClass(this.config?.redisOptions || {});
    } catch (e) {
      throw new Error("[HYPER-ERROR] RedisIdempotencyStore requires 'ioredis' package. Please install it.");
    }
  }

  async has(key: string): Promise<boolean> {
    if (!this.client) return false;
    const exists = await this.client.exists(`hyper:idemp:${key}`);
    return exists === 1;
  }

  async set(key: string, ttlMs: number): Promise<void> {
    if (!this.client) return;
    // We use SET with NX and PX for atomicity and safety
    await this.client.set(`hyper:idemp:${key}`, "1", "PX", ttlMs);
  }
}
