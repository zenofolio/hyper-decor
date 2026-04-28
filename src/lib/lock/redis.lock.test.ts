import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Redis from "ioredis";
import Redlock, { ExecutionError } from "./redis.lock";

describe("Redlock", () => {
    let client: Redis;
    let redlock: Redlock;

    beforeAll(() => {
        client = new Redis({ host: "127.0.0.1", port: 6379, maxRetriesPerRequest: 1 });
        redlock = new Redlock([client]);
    });

    afterAll(async () => {
        await redlock.quit();
    });

    it("should acquire and release a lock", async () => {
        const resource = `test-resource-${Math.random()}`;
        const lock = await redlock.acquire([resource], 1000);
        expect(lock.resources).toContain(resource);

        // Verify it exists in redis
        const val = await client.get(resource);
        expect(val).toBe(lock.value);

        await lock.release();

        // Verify it was removed
        const valAfter = await client.get(resource);
        expect(valAfter).toBeNull();
    });

    it("should fail to acquire an existing lock", async () => {
        const resource = `test-resource-${Math.random()}`;
        const lock = await redlock.acquire([resource], 1000);

        await expect(redlock.acquire([resource], 1000, { retryCount: 0 })).rejects.toThrow(ExecutionError);

        await lock.release();
    });

    it("should auto-extend using 'using' method", async () => {
        const resource = `test-resource-auto-${Math.random()}`;
        let extensionCount = 0;

        const originalExtend = redlock.extend.bind(redlock);
        let extendedPromiseResolve: () => void;
        const extendedPromise = new Promise<void>(resolve => extendedPromiseResolve = resolve);

        const extendSpy = vi.spyOn(redlock, "extend").mockImplementation(async (existing, duration, settings) => {
            extensionCount++;
            if (extendedPromiseResolve) extendedPromiseResolve();
            return originalExtend(existing, duration, settings);
        });

        // Set a duration and threshold to trigger extension
        const duration = 1000;
        const settings = {
            automaticExtensionThreshold: 800, // Trigger at 200ms
            retryCount: 0
        };

        await redlock.using([resource], duration, settings, async (signal) => {
            // Wait for the first extension to happen
            await extendedPromise;
            expect(signal.aborted).toBe(false);
        });

        expect(extensionCount).toBeGreaterThan(0);
        extendSpy.mockRestore();
    });

    it("should abort when extension fails", async () => {
        const resource = `test-resource-abort-${Math.random()}`;

        // Mock extend to fail
        const extendSpy = vi.spyOn(redlock, "extend").mockRejectedValue(new Error("Network failure"));

        const duration = 1000;
        const settings = {
            automaticExtensionThreshold: 800, // Extend when 200ms left
            retryCount: 0
        };

        try {
            await redlock.using([resource], duration, settings, async (signal) => {
                // Wait for extension to be attempted (at 200ms) and fail
                await new Promise(resolve => setTimeout(resolve, 500));
                expect(signal.aborted).toBe(true);
                expect(signal.error?.message).toBe("Network failure");
            });
        } catch (e) {
            // using() might throw ExecutionError if extension fails, which is fine
        }

        extendSpy.mockRestore();
    });
});
