import { singleton, injectable } from "tsyringe";

/**
 * 🗝️ Idempotency Store Interface
 */
export interface IIdempotencyStore {
  /** Optional initialization (e.g. connect to Redis) */
  onInit?(): Promise<void>;
  /** Check if the key exists and is still valid */
  has(key: string): Promise<boolean>;
  /** Store the key with a specific TTL in milliseconds */
  set(key: string, ttlMs: number): Promise<void>;
}

/**
 * 🧠 InMemoryIdempotencyStore
 * Simple implementation using a Map with TTL.
 */
@singleton()
@injectable()
export class InMemoryIdempotencyStore implements IIdempotencyStore {
  private cache = new Map<string, number>();

  async has(key: string): Promise<boolean> {
    const expiry = this.cache.get(key);
    if (!expiry) return false;

    if (Date.now() > expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async set(key: string, ttlMs: number): Promise<void> {
    this.cache.set(key, Date.now() + ttlMs);

    // Basic cleanup logic (optional: could be more advanced like LRU)
    if (this.cache.size > 10000) {
      this.cleanup();
    }
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, expiry] of this.cache.entries()) {
      if (now > expiry) this.cache.delete(key);
    }
  }
}
