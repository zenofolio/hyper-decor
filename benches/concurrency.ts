import "reflect-metadata";
import { fork, ChildProcess } from "child_process";
import { connect, JSONCodec } from "nats";
import path from "path";
import { z } from "zod";
import { NatsMQService } from "../src/lib/natsmq/service";
import { RedisConcurrencyStore, RedisMetrics } from "../src/lib/natsmq";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const jc = JSONCodec();
const JobSchema = z.object({ id: z.number() });

async function runConcurrencyBench() {
  console.log("⚖️ Starting REAL DISTRIBUTED Concurrency Benchmark...");

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
  await jsm.streams.add({ name: "STR_STRESS", subjects: ["jobs.stress.concurrency.*"] });
  const js = nc.jetstream();

  // 2. Shared Context
  const testPrefix = `test:concurrency:${Date.now()}`;
  const metrics = new RedisMetrics({ redis, prefix: `${testPrefix}:metrics` });
  const store = new RedisConcurrencyStore({ redis, prefix: `${testPrefix}:store` });

  const CONCURRENCY_LIMIT = 20;
  const totalToSent = 100;
  const maxObserved: Record<string, number> = { "jobs.stress.concurrency.A": 0, "jobs.stress.concurrency.B": 0 };

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

  // 4. BLAST via Engine (Publisher) & Monitor Context
  const service = NatsMQService.getInstance();
  service.configure({
    servers: "nats://localhost:4222",
    concurrencyStore: store,
    metrics: metrics
  });
  await service.onInit();
  const engine = service.mq!.engine;

  console.log(`[Bench] 🚀 BLASTING ${totalToSent} messages...`);
  const pubPromises = [];
  for (let i = 1; i <= 50; i++) {
    pubPromises.push(engine.publish("jobs.stress.concurrency.A", JobSchema, { id: i }));
    pubPromises.push(engine.publish("jobs.stress.concurrency.B", JobSchema, { id: i + 100 }));
  }
  await Promise.all(pubPromises);
  console.log("✅ BLAST COMPLETE");

  // 5. Monitor
  console.log("[Bench] 📊 Monitoring across all processes...");
  const start = Date.now();
  let totalProcessed = 0;
  while (totalProcessed < totalToSent && Date.now() - start < 60000) {
    const activeA = await engine.getActiveCount("jobs.stress.concurrency.A");
    const activeB = await engine.getActiveCount("jobs.stress.concurrency.B");

    maxObserved["jobs.stress.concurrency.A"] = Math.max(maxObserved["jobs.stress.concurrency.A"], activeA);
    maxObserved["jobs.stress.concurrency.B"] = Math.max(maxObserved["jobs.stress.concurrency.B"], activeB);

    totalProcessed = await engine.getSuccessCount();

    process.stdout.write(`\r[Monitor] Processed: ${totalProcessed}/${totalToSent} | Active A: ${activeA} B: ${activeB} | Max A: ${maxObserved["jobs.stress.concurrency.A"]} B: ${maxObserved["jobs.stress.concurrency.B"]}   `);

    if (totalProcessed < totalToSent) await delay(100);
  }

  console.log("\n" + "=".repeat(40));
  console.log("🏁 DISTRIBUTED RESULTS");
  console.log("Subject A Max Concurrency:", maxObserved["jobs.stress.concurrency.A"]);
  console.log("Subject B Max Concurrency:", maxObserved["jobs.stress.concurrency.B"]);

  const success = maxObserved["jobs.stress.concurrency.A"] <= CONCURRENCY_LIMIT &&
    maxObserved["jobs.stress.concurrency.B"] <= CONCURRENCY_LIMIT &&
    totalProcessed === totalToSent;

  if (success) {
    console.log(`✅ SUCCESS: Distributed concurrency strictly enforced (Max ${CONCURRENCY_LIMIT}).`);
  } else {
    console.error(`❌ FAILURE: Limit violated (A:${maxObserved["jobs.stress.concurrency.A"]}, B:${maxObserved["jobs.stress.concurrency.B"]}) or messages lost!`);
  }
  console.log("=".repeat(40) + "\n");

  for (const w of workers) w.kill();
  await nc.close();
  await redis.quit();
  process.exit(success ? 0 : 1);
}

runConcurrencyBench().catch(console.error);
