import "reflect-metadata";
import { fork, ChildProcess } from "child_process";
import path from "path";
import { NatsMQService } from "../src/lib/natsmq/service";
import { INatsMetrics } from "../src/lib/natsmq/types";
import { z } from "zod";
import { NatsSubscriptionMeta } from "../src/lib/natsmq/types";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const JobSchema = z.object({ id: z.number(), isLast: z.boolean().optional() });

class BenchMetrics implements INatsMetrics {
  public received = 0;
  public success = 0;
  public errors = 0;

  recordMessageReceived(_subject: string) { this.received++; }
  recordProcessingSuccess(_subject: string, _duration: number) { this.success++; }
  recordProcessingError(_subject: string, _type: string): void { this.errors++; }
  recordCronError(_name: string, _error: string): void { }
  increment(_name: string, _value?: number, _labels?: Record<string, string>): void { }
  gauge(_name: string, _value: number, _labels?: Record<string, string>): void { }
  async getCounter(_type: 'received' | 'success' | 'error', _subject?: string): Promise<number> { return 0; }
  async getAverageLatency(_subject: string): Promise<number> { return 0; }
}

async function runThroughputBench() {
  const totalMessages = 10000;
  console.log(`📊 Starting FULL STACK Throughput Benchmark (${totalMessages} messages)...`);

  const workerPath = path.join(__dirname, "throughput-worker.ts");
  const workers: ChildProcess[] = [];
  const metrics = new BenchMetrics();

  // 1. Initialize Full Service (publisher only, no consumers)
  const service = NatsMQService.getInstance();
  service.configure({ servers: "nats://localhost:4222", metrics });
  await service.onInit();

  // 2. Clear and Provision the stream
  const engine = service.mq!.engine;
  const STREAM_NAME = "STR_THROUGHPUT_BENCH";
  await engine.deleteStream("STR_BENCH"); // Old name cleanup
  await engine.deleteStream(STREAM_NAME);
  
  const mockMeta: NatsSubscriptionMeta = {
    key: "bench:throughput",
    methodName: "bench",
    className: "Bench",
    subject: "bench.throughput",
    schema: JobSchema,
    options: { stream: STREAM_NAME },
    isRequest: false,
    concurrencies: []
  };
  await engine.provisionStream(mockMeta);
  console.log("[Bench] ✅ Stream cleaned and provisioned");

  // 3. Spawn workers via fork() for IPC support
  const WORKER_COUNT = 4;
  let workersDone = 0;
  let finalResult: { time: number; pid: number } | null = null;

  const donePromise = new Promise<{ time: number; pid: number }>((resolve) => {
    for (let i = 0; i < WORKER_COUNT; i++) {
      const child = fork(workerPath, [], {
        execArgv: ["--require", "tsx/cjs"],
        stdio: "inherit"
      });

      child.on("message", (msg: any) => {
        if (msg.type === "done") {
          console.log(`[Bench] 🏁 Worker ${child.pid} signaled DONE`);
          resolve({ time: msg.time, pid: child.pid! });
        }
      });

      workers.push(child);
    }
  });

  console.log(`[Bench] ⏳ Waiting ${WORKER_COUNT} workers to initialize...`);
  await delay(3000);
  console.log("[Bench] ✅ Workers should be ready");

  // 4. BLAST
  console.log(`[Bench] ⚡ BLASTING ${totalMessages} messages...`);
  const startTime = Date.now();

  const pubPromises = [];
  for (let i = 1; i <= totalMessages; i++) {
    pubPromises.push(engine.publish("bench.throughput", JobSchema, {
      id: i,
      isLast: i === totalMessages
    }));

    if (i % 2000 === 0) {
      console.log(`[Bench] 📤 Published ${i}/${totalMessages}`);
    }
  }
  await Promise.all(pubPromises);
  console.log("[Bench] 📤 All messages published, waiting for workers...");

  // 5. Wait for completion with a safety timeout
  const timeout = 60_000;
  const result = await Promise.race([
    donePromise,
    delay(timeout).then(() => null)
  ]);

  if (!result) {
    console.error(`❌ TIMEOUT: No worker signaled done within ${timeout / 1000}s`);
    for (const w of workers) w.kill();
    process.exit(1);
  }

  const durationMs = result.time - startTime;
  const durationSec = durationMs / 1000;
  const tps = Math.round(totalMessages / durationSec);

  console.log("\n" + "=".repeat(40));
  console.log(`🏁 FULL STACK BENCHMARK COMPLETE`);
  console.log(`Total Messages: ${totalMessages}`);
  console.log(`Total Time:     ${durationSec.toFixed(2)}s`);
  console.log(`Throughput:     ${tps} msg/sec`);
  console.log("=".repeat(40) + "\n");

  for (const w of workers) w.kill();
  process.exit(0);
}

runThroughputBench().catch(console.error);
