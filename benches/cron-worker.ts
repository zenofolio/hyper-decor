import "reflect-metadata";
import { OnCron, CronContext } from "../src/lib/natsmq";
import { NatsMQService } from "../src/lib/natsmq/service";
import { RedisConcurrencyStore } from "../src/lib/natsmq/store/redis-store";
import { Redis } from "ioredis";

const CRON_NAME = process.env.CRON_NAME || "bench_cron";
const REDIS_KEY = "bench:cron:total_executions";

class CronWorker {
  @OnCron(CRON_NAME, "* * * * * *", { lockTtlMs: 900 })
  async handle(ctx: CronContext) {
    const redis = new Redis("redis://localhost:6379");
    await redis.incr(REDIS_KEY);
    await redis.quit();
    console.log(`🚀 [Worker ${process.pid}] EXECUTED cron: ${ctx.name}`);
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
