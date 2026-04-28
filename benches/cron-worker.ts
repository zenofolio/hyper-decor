import "reflect-metadata";
import { OnCron, CronContext } from "../src/lib/natsmq";
import { NatsMQService } from "../src/lib/natsmq/service";
import { RedisConcurrencyStore } from "../src/lib/natsmq/store/redis-store";
import { Redis } from "ioredis";

const CRON_NAME = process.env.CRON_NAME || "bench_cron";
const REDIS_KEY = "bench:cron:total_executions";
const ACTIVE_BUCKETS = "bench:cron:active_buckets";
const BUCKET_PREFIX = "bench:cron:bucket";

class CronWorker {
  @OnCron(CRON_NAME, "* * * * * *", { lockTtlMs: 5000 })
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
  service.registerInstance(new CronWorker());
  
  console.log(`[Worker ${process.pid}] READY for cron: ${CRON_NAME}`);
}

main().catch(console.error);
