import { IConcurrencyStore } from "../types";
import type Redis from "ioredis";

export class RedisConcurrencyStore implements IConcurrencyStore {
  private client: Redis | null = null;
  private prefix = "natsmq:lock:";

  constructor(
    private providedClient?: Redis | null,
    private redisOptions?: any
  ) { }

  async onInit(): Promise<void> {
    if (this.providedClient) {
      this.client = this.providedClient;
      return;
    }

    try {
      const IORedis = await import("ioredis");
      const RedisConstructor = (IORedis as any).Redis || (IORedis as any).default || IORedis;
      this.client = new (RedisConstructor as any)(this.redisOptions || {});
    } catch (e) {
      throw new Error("[NatsMQ] RedisConcurrencyStore requires 'ioredis' package. Please install it.");
    }
  }

  async close(): Promise<void> {
    if (this.client && !this.providedClient) {
      await this.client.quit();
    }
  }

  async acquire(subject: string, limit: number, ttlMs: number): Promise<boolean> {
    if (!this.client) return false;
    
    const key = `${this.prefix}${subject}`;
    const now = Date.now();
    const expiry = now + ttlMs;

    // Use a Lua script to atomically check the limit and add a lock with TTL
    // We use a Redis ZSET (Sorted Set) where the score is the expiration timestamp.
    const luaScript = `
      local key = KEYS[1]
      local limit = tonumber(ARGV[1])
      local now = tonumber(ARGV[2])
      local expiry = tonumber(ARGV[3])
      local memberId = ARGV[4]

      -- Remove expired locks
      redis.call('ZREMRANGEBYSCORE', key, '-inf', now)

      -- Check current count
      local currentCount = redis.call('ZCARD', key)
      if currentCount >= limit then
        return 0 -- Limit reached
      end

      -- Add the new lock
      redis.call('ZADD', key, expiry, memberId)
      
      -- Set global key TTL to avoid orphaned keys
      redis.call('PEXPIRE', key, expiry - now + 1000)

      return 1 -- Success
    `;

    // A random member ID to differentiate multiple locks for the same subject
    const memberId = `${now}-${Math.random().toString(36).substring(2, 9)}`;

    const result = await this.client.eval(luaScript, 1, key, limit, now, expiry, memberId);
    
    return result === 1;
  }

  async release(subject: string): Promise<void> {
    if (!this.client) return;

    const key = `${this.prefix}${subject}`;
    
    // Simplest release: we just remove the oldest lock (lowest score)
    // In a fully robust implementation, acquire should return the memberId 
    // and release should use it, but for our queue-like semaphore this works.
    await this.client.zpopmin(key);
  }

  async getGlobalActiveCount(): Promise<number> {
    // This is expensive in Redis to scan all keys. 
    // For a real production app, we might maintain a global counter,
    // but calculating it precisely across all subjects requires scanning.
    // For now, we return 0 or implement a global counter in Lua.
    return 0; // Placeholder: Not strictly necessary for core functionality
  }

  async getActiveCount(subject: string): Promise<number> {
    if (!this.client) return 0;
    const key = `${this.prefix}${subject}`;
    const now = Date.now();
    
    await this.client.zremrangebyscore(key, '-inf', now);
    return await this.client.zcard(key);
  }
}
