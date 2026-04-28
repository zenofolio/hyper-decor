import "reflect-metadata";
import { JSONCodec, DeliverPolicy } from "nats";
import { OnNatsMessage, MaxAckPendingPerSubject } from "../src/lib/natsmq/decorators";
import { NatsMQService } from "../src/lib/natsmq/service";
import { RedisConcurrencyStore } from "../src/lib/natsmq/store/redis-store";
import { z } from "zod";
import { RedisMetrics } from "../src/lib/natsmq";

const JobSchema = z.object({ id: z.number() });
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const CONCURRENCY_LIMIT = parseInt(process.env.LIMIT || "5");

class ConcurrencyWorker {
  @OnNatsMessage("jobs.stress.concurrency.*", JobSchema, {
    stream: "STR_STRESS",
    deliver_policy: DeliverPolicy.All,
    durable_name: "stress_consumer" // Shared durable name for load balancing across processes
  })
  @MaxAckPendingPerSubject("jobs.stress.concurrency.*", CONCURRENCY_LIMIT)
  async handle(data: z.infer<typeof JobSchema>) {
    await delay(500);
  }
}

async function main() {
  const { Redis } = await import("ioredis");
  const redis = new Redis("redis://localhost:6379");

  const store = new RedisConcurrencyStore({ redis, prefix: process.env.REDIS_PREFIX });
  const metrics = new RedisMetrics({ redis, prefix: process.env.METRICS_PREFIX });

  const service = NatsMQService.getInstance();
  service.configure({
    servers: "nats://localhost:4222",
    concurrencyStore: store,
    metrics
  });
  await service.onInit();

  await service.registerInstance(new ConcurrencyWorker());
  console.log(`🚀 [Worker ${process.pid}] READY (Limit: ${CONCURRENCY_LIMIT}, Prefix: ${process.env.REDIS_PREFIX})`);
}

main().catch(console.error);
