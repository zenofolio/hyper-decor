import {
  HyperService,
  NatsMQWorker,
  OnNatsMessage,
  MaxAckPendingPerSubject,
  NatsMQService,
  RedisConcurrencyStore,
  RedisMetrics,
  defineQueue
} from "../src/index";
import { z } from "zod";
import { Redis } from "ioredis";
import { JsMsg } from "nats";

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const JobSchema = z.object({ id: z.number() });

async function runWorker() {
  const redis = new Redis("redis://localhost:6379");
  const storePrefix = process.env.REDIS_PREFIX || "test:concurrency:store";
  const metricsPrefix = process.env.METRICS_PREFIX || "test:concurrency:metrics";
  const limit = parseInt(process.env.LIMIT || "20");

  const Tasks = defineQueue("jobs.stress.concurrency", { stream: "STR_STRESS" });
  // Contract with named parameter :user
  const TaskContract = Tasks.define("job.:user", JobSchema);

  @NatsMQWorker(Tasks)
  class ConcurrencyWorker {
    @OnNatsMessage(TaskContract)
    // 1. GLOBAL LIMIT (shared across all users)
    @MaxAckPendingPerSubject("jobs.stress.concurrency.job.>", limit)
    // 2. DYNAMIC LIMIT (per user)
    // The engine will resolve :user from the actual subject
    @MaxAckPendingPerSubject("jobs.stress.concurrency.job.:user", 10)
    async handle(data: any, msg: JsMsg) {
      // Simulate work
      await delay(10);
    }
  }

  const service = NatsMQService.getInstance();
  service.configure({
    servers: "nats://localhost:4222",
    concurrencyStore: new RedisConcurrencyStore({ redis, prefix: storePrefix }),
    metrics: new RedisMetrics({ redis, prefix: metricsPrefix })
  });

  await service.onInit();
  await service.register(ConcurrencyWorker);

  console.log(`🚀 [Worker ${process.pid}] READY (Global Limit: ${limit})`);
}

runWorker().catch(console.error);
