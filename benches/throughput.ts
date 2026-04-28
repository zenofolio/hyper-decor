import "reflect-metadata";
import { spawn, ChildProcess } from "child_process";
import { connect, JSONCodec } from "nats";
import path from "path";
import { NatsMQService } from "../src/lib/natsmq/service";
import { INatsMetrics } from "../src/lib/natsmq/types";
import { z } from "zod";
import { NatsSubscriptionMeta } from "../src/lib/natsmq/decorators";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const jc = JSONCodec();
const JobSchema = z.object({ id: z.number(), isLast: z.boolean().optional() });

// Métricas de seguimiento para el benchmark
class BenchMetrics implements INatsMetrics {
  public received = 0;
  public success = 0;
  public errors = 0;

  recordMessageReceived(_subject: string) { this.received++; }
  recordProcessingSuccess(_subject: string, _duration: number) { this.success++; }
  recordProcessingError(subject: string, type: string): void { this.errors++; }
  recordCronError(name: string, error: string): void { }
  increment(name: string, value?: number, labels?: Record<string, string>): void { }
  gauge(name: string, value: number, labels?: Record<string, string>): void { }
  async getCounter(subject: string, type: 'received' | 'success' | 'error'): Promise<number> { return 0; }
  async getAverageLatency(subject: string): Promise<number> { return 0; }
}

async function runThroughputBench() {
  const totalMessages = 10;
  console.log(`📊 Starting FULL STACK Throughput Benchmark (${totalMessages} messages)...`);

  const workerPath = path.join(__dirname, "throughput-worker.ts");
  const workers: ChildProcess[] = [];
  const metrics = new BenchMetrics();

  // 1. Initialize Full Service
  const service = NatsMQService.getInstance();
  service.configure({
    servers: "nats://localhost:4222",
    metrics
  });
  await service.onInit();

  // 2. Setup Stream using the Engine with correct types
  const engine = service.mq!.engine;
  const mockMeta: NatsSubscriptionMeta = {
    methodName: "bench",
    subject: "bench.throughput",
    schema: JobSchema,
    options: { stream: "STR_BENCH" },
    isRequest: false
  };

  await engine.provisionStream(mockMeta);

  for (let i = 0; i < 4; i++) {
    const child = spawn("npx", ["tsx", workerPath], { shell: true, stdio: 'inherit' });
    workers.push(child);
  }
  await delay(5000);

  // 4. Subscriber for the DONE signal
  const nc = await connect({ servers: "nats://localhost:4222" });
  let endTime = 0;
  const donePromise = new Promise<void>((resolve) => {
    nc.subscribe("bench.done", {
      callback: () => {
        endTime = Date.now();
        resolve();
      }
    });
  });

  // 5. BLAST through the Framework!
  console.log(`[Bench] ⚡ BLASTING messages through NatsMQService/Engine...`);
  const startTime = Date.now();

  for (let i = 1; i <= totalMessages; i++) {
    // Aquí es donde medimos el overhead real de publicación del motor
    engine.publish("bench.throughput", JobSchema, {
      id: i,
      isLast: i === totalMessages
    }).catch(() => { });

    if (i % 500 === 0) await delay(5);
  }

  await donePromise;

  const durationMs = endTime - startTime;
  const durationSec = durationMs / 1000;
  const tps = Math.round(totalMessages / durationSec);

  console.log("\n" + "=".repeat(40));
  console.log(`🏁 FULL STACK BENCHMARK COMPLETE`);
  console.log(`Total Messages: ${totalMessages}`);
  console.log(`Total Time:     ${durationSec.toFixed(2)}s`);
  console.log(`Throughput:     ${tps} msg/sec`);
  console.log(`Metrics Recorded (Publisher side):`);
  console.log(` - Sent: ${totalMessages}`);
  console.log("=".repeat(40) + "\n");

  for (const w of workers) w.kill();
  await nc.close();
  process.exit(0);
}

runThroughputBench().catch(console.error);
