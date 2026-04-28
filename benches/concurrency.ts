import { spawn, ChildProcess } from "child_process";
import { connect, JSONCodec } from "nats";
import path from "path";
import { z } from "zod";
import { NatsMQService } from "../src/lib/natsmq/service";
import "reflect-metadata";
import { MaxAckPendingPerSubject, OnNatsMessage } from "../src/lib/natsmq/decorators";
import { RedisConcurrencyStore, RedisMetrics } from "../src/lib/natsmq";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const jc = JSONCodec();

async function runConcurrencyBench() {
  console.log("⚖️ Starting DISTRIBUTED Concurrency Benchmark (MaxAckPendingPerSubject)...");

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

  // 2. Setup Redis Context
  const testPrefix = `test:concurrency:${Date.now()}`;
  const metrics = new RedisMetrics({ redis, prefix: `${testPrefix}:metrics` });
  const store = new RedisConcurrencyStore({ redis, prefix: `${testPrefix}:store` });

  const maxObserved: Record<string, number> = { "jobs.stress.concurrency.A": 0, "jobs.stress.concurrency.B": 0 };
  let totalProcessed = 0;
  const totalToSent = 100; // 50 for A, 50 for B

  // 3. Setup Worker (In-process for maximum reliability)
  console.log("[Bench] Initializing Worker in-process...");
  const JobSchema = z.object({ id: z.number() });
  const { DeliverPolicy } = await import("nats");

  const uniqueDurable = `stress_consumer_${Date.now()}`;

  class ConcurrencyWorker {
    @OnNatsMessage("jobs.stress.concurrency.*", JobSchema, {
      stream: "STR_STRESS",
      deliver_policy: DeliverPolicy.All,
      durable_name: uniqueDurable
    })
    @MaxAckPendingPerSubject("jobs.stress.concurrency.*", 5)
    async handle(data: any) {
      // console.log(`[Worker] 👷 Processing job ${data.id}`);
      await delay(500);
    }
  }

  const service = NatsMQService.getInstance();
  service.configure({
    servers: "nats://localhost:4222",
    concurrencyStore: store,
    metrics: metrics
  });
  await service.onInit();
  await service.registerInstance(new ConcurrencyWorker());

  console.log(`[Bench] Worker ready in-process (Durable: ${uniqueDurable})`);
  await delay(1000);

  // 4. Send Messages
  console.log(`[Bench] 🚀 BLASTING ${totalToSent} messages...`);

  const pubPromises = [];
  for (let i = 1; i <= 50; i++) {
    pubPromises.push(js.publish("jobs.stress.concurrency.A", jc.encode({ id: i })));
    pubPromises.push(js.publish("jobs.stress.concurrency.B", jc.encode({ id: i + 100 })));
  }
  await Promise.all(pubPromises);
  console.log("✅ BLAST COMPLETE");

  // 5. Monitor via Polling
  console.log("[Bench] 📊 Starting monitor...");
  const start = Date.now();
  while (totalProcessed < totalToSent && Date.now() - start < 60000) {
    try {
      const activeA = await store.getActiveCount("jobs.stress.concurrency.A");
      const activeB = await store.getActiveCount("jobs.stress.concurrency.B");

      maxObserved["jobs.stress.concurrency.A"] = Math.max(maxObserved["jobs.stress.concurrency.A"] || 0, activeA);
      maxObserved["jobs.stress.concurrency.B"] = Math.max(maxObserved["jobs.stress.concurrency.B"] || 0, activeB);

      const doneA = await metrics.getCounter("jobs.stress.concurrency.A", "success");
      const doneB = await metrics.getCounter("jobs.stress.concurrency.B", "success");
      totalProcessed = doneA + doneB;

      const s = await jsm.streams.info("STR_STRESS");
      console.log(`[Monitor] StreamMsgs: ${s.state.messages} | Active: A(${activeA}) B(${activeB}) | Processed: ${totalProcessed}/${totalToSent}`);
    } catch (err: any) {
      console.error(`❌ MONITOR ERROR: ${err.message}`);
    }

    if (totalProcessed < totalToSent) await delay(500);
  }

  console.log("\n" + "=".repeat(40));
  console.log("🏁 CONCURRENCY RESULTS");
  console.log("Subject A Max Concurrency:", maxObserved["jobs.stress.concurrency.A"]);
  console.log("Subject B Max Concurrency:", maxObserved["jobs.stress.concurrency.B"]);

  const success = Object.values(maxObserved).every(v => v <= 5) && totalProcessed === totalToSent;

  if (success) {
    console.log("✅ SUCCESS: Per-subject concurrency strictly enforced (Max 5).");
  } else {
    console.error("❌ FAILURE: Concurrency limit violated or not all messages processed!");
  }
  console.log("=".repeat(40) + "\n");

  for (const w of workers) try { w.kill(); } catch { }
  await nc.close();
  await redis.quit();
  process.exit(success ? 0 : 1);
}

runConcurrencyBench().catch(console.error);
