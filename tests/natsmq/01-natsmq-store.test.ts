import { describe, it, expect, beforeEach, afterAll, beforeAll, vi } from "vitest";
import { LocalConcurrencyStore } from "../../src/lib/natsmq/store/local-store";
import { RedisConcurrencyStore } from "../../src/lib/natsmq/store/redis-store";
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
      
      const a1 = await store.acquire([subject], 5000, { limit: 2 });
      const a2 = await store.acquire([subject], 5000, { limit: 2 });
      const a3 = await store.acquire([subject], 5000, { limit: 2 });

      expect(typeof a1).toBe("object");
      expect(typeof a2).toBe("object");
      expect(a3).toBeNull(); // Limit reached
    });

    it("should allow acquiring again after release", async () => {
      const subject = "test.local.release";
      
      const lock = await store.acquire([subject], 5000, { limit: 1 });
      expect(lock).not.toBeNull();
      
      const a2 = await store.acquire([subject], 5000, { limit: 1 });
      expect(a2).toBeNull();

      await store.release(lock!);
      
      const a3 = await store.acquire([subject], 5000, { limit: 1 });
      expect(typeof a3).toBe("object");
    });

    it("should auto-expire locks based on TTL", async () => {
      const subject = "test.local.ttl";
      
      await store.acquire([subject], 100, { limit: 1 }); // 100ms TTL
      
      expect(await store.acquire([subject], 5000, { limit: 1 })).toBeNull(); // Locked
      
      await delay(150); // Wait for TTL to expire
      
      const lock = await store.acquire([subject], 5000, { limit: 1 });
      expect(typeof lock).toBe("object"); // Should be free now
    });

    it("should handle subjects with special characters (colons, dots)", async () => {
      const subject = "test:with:colons.and.dots";
      
      const lock = await store.acquire([subject], 5000, { limit: 1 });
      expect(typeof lock).toBe("object");
      
      expect(await store.acquire([subject], 5000, { limit: 1 })).toBeNull();
      
      await store.release(lock!);
      expect(await store.acquire([subject], 5000, { limit: 1 })).not.toBeNull();
    });
  });

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
          setTimeout(() => reject(new Error("Timeout")), 1000); 
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
        store = new RedisConcurrencyStore({ redis });
      }
    });

    it("should allow acquiring up to the limit (Redis)", async () => {
      if (!isConnected) return;
      const subject = "test.redis";
      
      const a1 = await store.acquire([subject], 5000, { limit: 2 });
      const a2 = await store.acquire([subject], 5000, { limit: 2 });
      const a3 = await store.acquire([subject], 5000, { limit: 2 });

      expect(typeof a1).toBe("object");
      expect(typeof a2).toBe("object");
      expect(a3).toBeNull(); 
    });

    it("should allow acquiring again after release (Redis)", async () => {
      if (!isConnected) return;
      const subject = "test.redis.release";
      
      const lock = await store.acquire([subject], 5000, { limit: 1 });
      const a2 = await store.acquire([subject], 5000, { limit: 1 });
      expect(a2).toBeNull();

      await store.release(lock!);
      
      const a3 = await store.acquire([subject], 5000, { limit: 1 });
      expect(typeof a3).toBe("object");
    });

    it("should auto-expire locks based on TTL (Redis)", async () => {
      if (!isConnected) return;
      const subject = "test.redis.ttl";
      
      await store.acquire([subject], 100, { limit: 1 }); 
      
      expect(await store.acquire([subject], 5000, { limit: 1 })).toBeNull(); 
      
      await delay(150); 
      
      const lock = await store.acquire([subject], 5000, { limit: 1 });
      expect(typeof lock).toBe("object"); 
    });
  });
});
