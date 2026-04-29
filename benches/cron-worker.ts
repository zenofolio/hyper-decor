import "reflect-metadata";
import { OnCron, CronContext, NatsMQWorker } from "../src/lib/natsmq";
import { NatsMQService } from "../src/lib/natsmq/service";
import { RedisConcurrencyStore } from "../src/lib/natsmq/store/redis-store";
import { Redis } from "ioredis";

const REDIS_KEY = "bench:cron:total_executions";
const ACTIVE_BUCKETS = "bench:cron:active_buckets";
const BUCKET_PREFIX = "bench:cron:bucket";

@NatsMQWorker({
  getNatsConfig: () => ({
    subject: "bench.cron.>",
    schema: (null as any),
    options: { stream: "BENCH_STREAM" }
  })
} as any)
class CronWorker {
  @OnCron("distributed_cron_test", "* * * * * *", { lockTtlMs: 5000 })
  async handle(ctx: CronContext) {
    const redis = new Redis("redis://localhost:6379");
    const bucket = Math.round(ctx.scheduledTime.getTime() / 1000);
    
    // Increment total
    await redis.incr(REDIS_KEY);
    
    // Use multi for atomicity
    await redis.multi()
      .sadd(ACTIVE_BUCKETS, bucket.toString())
      .sadd(`${BUCKET_PREFIX}:${bucket}`, process.pid.toString())
      .expire(`${BUCKET_PREFIX}:${bucket}`, 60)
      .exec();

    await redis.quit();
    console.log(`🚀 [Worker ${process.pid}] EXECUTED cron: ${ctx.name} (Bucket: ${bucket})`);
  }
}

async function main() {
  const redis = new Redis("redis://localhost:6379");
  const store = new RedisConcurrencyStore({ 
    redis, 
    prefix: process.env.REDIS_PREFIX 
  });

  const service = NatsMQService.getInstance();
  service.configure({
    servers: "nats://localhost:4222",
    concurrencyStore: store
  });

  await service.onInit();
  // Register the class directly
  await service.register(CronWorker);
  
  console.log(`[Worker ${process.pid}] READY for cron: distributed_cron_test`);
}

main().catch(console.error);
