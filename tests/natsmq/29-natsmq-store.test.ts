import { describe, it, expect, beforeEach, afterAll, beforeAll } from "vitest";
import { LocalConcurrencyStore } from "../src/lib/natsmq/store/local-store";
import { RedisConcurrencyStore } from "../src/lib/natsmq/store/redis-store";
import Redis from "ioredis";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe("NatsMQ Concurrency Stores", () => {
  describe("LocalConcurrencyStore", () => {
    let store: LocalConcurrencyStore;

    beforeEach(() => {
      store = new LocalConcurrencyStore();
    });

    it("should allow acquiring up to the limit", async () => {
      const subject = "test.local";
      
      const a1 = await store.acquire(subject, 2, 5000);
      const a2 = await store.acquire(subject, 2, 5000);
      const a3 = await store.acquire(subject, 2, 5000);

      expect(a1).toBe(true);
      expect(a2).toBe(true);
      expect(a3).toBe(false); // Limit reached
    });

    it("should allow acquiring again after release", async () => {
      const subject = "test.local.release";
      
      await store.acquire(subject, 1, 5000);
      const a2 = await store.acquire(subject, 1, 5000);
      expect(a2).toBe(false);

      await store.release(subject);
      
      const a3 = await store.acquire(subject, 1, 5000);
      expect(a3).toBe(true);
    });

    it("should auto-expire locks based on TTL", async () => {
      const subject = "test.local.ttl";
      
      await store.acquire(subject, 1, 100); // 100ms TTL
      
      expect(await store.acquire(subject, 1, 5000)).toBe(false); // Locked
      
      await delay(150); // Wait for TTL to expire
      
      expect(await store.acquire(subject, 1, 5000)).toBe(true); // Should be free now
    });
  });

  // Redis tests only run if Redis is available, we'll try to connect or skip
  describe("RedisConcurrencyStore", () => {
    let store: RedisConcurrencyStore;
    let redis: Redis;
    let isConnected = false;

    beforeAll(async () => {
      try {
        redis = new Redis({ host: "localhost", port: 6379, maxRetriesPerRequest: 1 });
        await new Promise((resolve, reject) => {
          redis.on('ready', () => { isConnected = true; resolve(true); });
          redis.on('error', (err) => { reject(err); });
          // Fast timeout for tests without Redis
          setTimeout(() => reject(new Error("Timeout")), 500); 
        });
      } catch (e) {
        isConnected = false;
        if (redis) redis.disconnect();
      }
    });

    afterAll(async () => {
      if (redis) await redis.quit();
    });

    beforeEach(async () => {
      if (isConnected) {
        store = new RedisConcurrencyStore(redis);
        await store.onInit();
        await redis.del("natsmq:lock:test.redis");
        await redis.del("natsmq:lock:test.redis.release");
        await redis.del("natsmq:lock:test.redis.ttl");
      }
    });

    it("should allow acquiring up to the limit (Redis)", async (ctx) => {
      if (!isConnected) return ctx.skip();
      const subject = "test.redis";
      
      const a1 = await store.acquire(subject, 2, 5000);
      const a2 = await store.acquire(subject, 2, 5000);
      const a3 = await store.acquire(subject, 2, 5000);

      expect(a1).toBe(true);
      expect(a2).toBe(true);
      expect(a3).toBe(false); 
    });

    it("should allow acquiring again after release (Redis)", async (ctx) => {
      if (!isConnected) return ctx.skip();
      const subject = "test.redis.release";
      
      await store.acquire(subject, 1, 5000);
      const a2 = await store.acquire(subject, 1, 5000);
      expect(a2).toBe(false);

      await store.release(subject);
      
      const a3 = await store.acquire(subject, 1, 5000);
      expect(a3).toBe(true);
    });

    it("should auto-expire locks based on TTL (Redis)", async (ctx) => {
      if (!isConnected) return ctx.skip();
      const subject = "test.redis.ttl";
      
      await store.acquire(subject, 1, 100); 
      
      expect(await store.acquire(subject, 1, 5000)).toBe(false); 
      
      await delay(150); 
      
      expect(await store.acquire(subject, 1, 5000)).toBe(true); 
    });
  });
});
