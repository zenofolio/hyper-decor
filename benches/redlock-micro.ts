/**
 * Micro-benchmark for Redlock internals.
 * Measures: _random(), _hash(), acquire+release cycle, extend cycle.
 * 
 * Usage: npx tsx benches/redlock-micro.ts
 */
import { Redis } from "ioredis";
import Redlock from "../src/lib/lock/redis.lock";

const ITERATIONS = 1000;

async function bench(name: string, fn: () => Promise<void> | void, iterations = ITERATIONS) {
  // Warmup
  for (let i = 0; i < 50; i++) await fn();

  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }

  times.sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);
  const avg = sum / times.length;
  const p50 = times[Math.floor(times.length * 0.5)];
  const p99 = times[Math.floor(times.length * 0.99)];
  const min = times[0];
  const max = times[times.length - 1];

  console.log(`${name.padEnd(35)} avg=${avg.toFixed(3)}ms  p50=${p50.toFixed(3)}ms  p99=${p99.toFixed(3)}ms  min=${min.toFixed(3)}ms  max=${max.toFixed(3)}ms`);
  return { name, avg, p50, p99, min, max };
}

async function main() {
  const redis = new Redis({ host: "localhost", port: 6379, lazyConnect: true });
  await redis.connect();

  const redlock = new Redlock([redis], { retryCount: 0 });

  console.log("=".repeat(100));
  console.log(`Redlock Micro-Benchmark — ${ITERATIONS} iterations each`);
  console.log("=".repeat(100));

  // 1. _random() — accessed via acquire (we isolate it by measuring just the ID generation overhead)
  await bench("randomBytes(16).toString('hex')", () => {
    const { randomBytes } = require("crypto");
    randomBytes(16).toString("hex");
  }, 5000);

  await bench("crypto.randomUUID()", () => {
    const { randomUUID } = require("crypto");
    randomUUID();
  }, 5000);

  // 2. Acquire + Release cycle (the real end-to-end hot path)
  const lockKey = `bench:lock:${Date.now()}`;
  await bench("acquire + release (single key)", async () => {
    const lock = await redlock.acquire([lockKey], 10000);
    await redlock.release(lock);
  });

  // 3. Extend cycle
  await bench("acquire + extend + release", async () => {
    const lock = await redlock.acquire([lockKey], 10000);
    const extended = await redlock.extend(lock, 10000);
    await redlock.release(extended);
  });

  // 4. Acquire + Release with multiple keys
  const keys = Array.from({ length: 3 }, (_, i) => `bench:lock:multi:${i}:${Date.now()}`);
  await bench("acquire + release (3 keys)", async () => {
    const lock = await redlock.acquire(keys, 10000);
    await redlock.release(lock);
  });

  console.log("=".repeat(100));
  console.log("Done.");

  await redis.quit();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
