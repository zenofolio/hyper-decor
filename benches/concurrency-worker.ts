import "reflect-metadata";
import { connect, JSONCodec, DeliverPolicy } from "nats";
import { OnNatsMessage, MaxAckPendingPerSubject } from "../src/lib/natsmq/decorators";
import { NatsMQService } from "../src/lib/natsmq/service";
import { Redis } from "ioredis";
import { RedisConcurrencyStore } from "../src/lib/natsmq/store/redis-store";
import { z } from "zod";
import { RedisMetrics } from "../src/lib/natsmq";

const JobSchema = z.object({ id: z.number() });
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class ConcurrencyWorker {
  private jc = JSONCodec();

  @OnNatsMessage("jobs.stress.concurrency.*", JobSchema, {
    stream: "STR_STRESS",
    deliver_policy: DeliverPolicy.All,
    durable_name: "stress_consumer"
  })
  @MaxAckPendingPerSubject("jobs.stress.concurrency.*", 5)
  async handle(data: z.infer<typeof JobSchema>) {
    await delay(500);
  }
}

async function main() {
  console.log(`[Worker ${process.pid}] 🐣 I AM ALIVE!`);
  const { Redis } = await import("ioredis");

  const testPrefix = process.env.BENCH_PREFIX || "natsmq";
  const redis = new Redis("redis://localhost:6379");
  const store = new RedisConcurrencyStore({ redis, prefix: `${testPrefix}:store` });
  const metrics = new RedisMetrics({ redis, prefix: `${testPrefix}:metrics` });

  const service = NatsMQService.getInstance();
  service.configure({
    servers: "nats://localhost:4222",
    concurrencyStore: store,
    metrics
  });
  await service.onInit();

  const worker = new ConcurrencyWorker();
  await service.registerInstance(worker);

  console.log(`👷 Concurrency Worker ${process.pid} listening... Prefix: ${testPrefix}`);
}

main().catch(console.error);
