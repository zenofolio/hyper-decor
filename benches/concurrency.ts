import { connect } from "nats";
import { fork, ChildProcess } from "child_process";
import path from "path";
import { NatsMQService, RedisConcurrencyStore, RedisMetrics, defineQueue } from "../src/index";
import { z } from "zod";

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
const JobSchema = z.object({ id: z.number() });

function renderBar(current: number, max: number, width: number = 20) {
  const filled = Math.min(width, Math.floor((current / max) * width));
  const empty = width - filled;
  return `[${"#".repeat(filled)}${"-".repeat(empty)}] ${current}/${max}`;
}

async function runConcurrencyBench() {
  const { Redis } = await import("ioredis");
  const redis = new Redis("redis://localhost:6379");
  await redis.flushall();

  const nc = await connect({ servers: "nats://localhost:4222" });
  const workerPath = path.join(__dirname, "concurrency-worker.ts");
  const workers: ChildProcess[] = [];

  // 1. Setup Stream
  const jsm = await nc.jetstreamManager();
  console.log("[Bench] Cleaning NATS Stream...");
  try { await jsm.streams.delete("STR_STRESS"); } catch { }
  await jsm.streams.add({ name: "STR_STRESS", subjects: ["jobs.stress.concurrency.>"] });

  // 2. Shared Context
  const testPrefix = `test:concurrency:${Date.now()}`;
  const metrics = new RedisMetrics({ redis, prefix: `${testPrefix}:metrics` });
  const store = new RedisConcurrencyStore({ redis, prefix: `${testPrefix}:store` });

  const CONCURRENCY_LIMIT = 20;
  const totalToSent = 100;
  let maxObserved = 0;

  // 3. Spawn 4 independent worker processes
  console.log("[Bench] Spawning 4 independent worker processes...");
  for (let i = 0; i < 4; i++) {
    const child = fork(workerPath, [], {
      execArgv: ["--require", "tsx/cjs"],
      env: {
        ...process.env,
        REDIS_PREFIX: `${testPrefix}:store`,
        METRICS_PREFIX: `${testPrefix}:metrics`,
        LIMIT: CONCURRENCY_LIMIT.toString()
      },
      stdio: "inherit"
    });
    workers.push(child);
  }

  console.log("[Bench] Waiting for workers to be ready...");
  await delay(5000);

  // 4. BLAST via Engine (Publisher)
  const service = NatsMQService.getInstance();
  service.configure({
    servers: "nats://localhost:4222",
    concurrencyStore: store,
    metrics: metrics
  });
  await service.onInit();
  const engine = service.mq!.engine;

  // Define the Contract
  const Tasks = defineQueue("jobs.stress.concurrency", { stream: "STR_STRESS" });
  // We use .fill() to shard by user
  const TaskContract = Tasks.define("job.*", JobSchema);

  console.log(`[Bench] 🚀 BLASTING ${totalToSent} messages...`);
  const pubPromises = [];
  for (let i = 1; i <= 50; i++) {
    pubPromises.push(engine.publish(TaskContract.fill("A"), { id: i }));
    pubPromises.push(engine.publish(TaskContract.fill("B"), { id: i + 100 }));
  }
  await Promise.all(pubPromises);
  console.log("✅ BLAST COMPLETE");

  // 5. Monitor
  console.log("\n📊 REAL-TIME CONCURRENCY MONITOR");
  console.log("=".repeat(50));
  const start = Date.now();
  let totalProcessed = 0;
  
  while (totalProcessed < totalToSent && Date.now() - start < 60000) {
    const active = await engine.getActiveCount("jobs.stress.concurrency.job.>");
    maxObserved = Math.max(maxObserved, active);

    const successA = await metrics.getCounter("success", "jobs.stress.concurrency.job.A");
    const successB = await metrics.getCounter("success", "jobs.stress.concurrency.job.B");
    
    // Concurrency per user
    const activeA = await engine.getActiveCount("jobs.stress.concurrency.job.A");
    const activeB = await engine.getActiveCount("jobs.stress.concurrency.job.B");

    totalProcessed = await metrics.getCounter("success");

    process.stdout.write(`\u001b[2J\u001b[0;0H`); // Clear screen and home
    console.log(`📊 REAL-TIME CONCURRENCY MONITOR (Limit: ${CONCURRENCY_LIMIT})`);
    console.log("=".repeat(50));
    console.log(`User A: ${renderBar(activeA, CONCURRENCY_LIMIT)} | Done: ${successA}/50`);
    console.log(`User B: ${renderBar(activeB, CONCURRENCY_LIMIT)} | Done: ${successB}/50`);
    console.log("-".repeat(50));
    console.log(`GLOBAL: ${renderBar(active, CONCURRENCY_LIMIT)} | Total: ${totalProcessed}/${totalToSent}`);
    console.log(`Max Concurrent Observed: ${maxObserved}`);
    console.log("=".repeat(50));

    if (totalProcessed < totalToSent) await delay(200);
  }

  console.log("\n🏁 BENCHMARK COMPLETE");
  const success = maxObserved <= CONCURRENCY_LIMIT && totalProcessed === totalToSent;

  for (const w of workers) w.kill();
  await nc.close();
  await redis.quit();
  process.exit(success ? 0 : 1);
}

runConcurrencyBench().catch(console.error);
