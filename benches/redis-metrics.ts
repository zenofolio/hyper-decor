import "reflect-metadata";
import { Redis } from "ioredis";
import { RedisMetrics } from "../src/lib/natsmq/metrics/redis-metrics";
import { NatsMQService } from "../src/lib/natsmq/service";
import { z } from "zod";

async function testRedisMetrics() {
  console.log("🧪 Testing Redis Metrics Adapter...");
  
  const redis = new Redis("redis://localhost:6379");
  await redis.flushall(); // Limpiamos para el test

  const metrics = new RedisMetrics({ redis });
  const service = NatsMQService.getInstance();
  
  service.configure({
    servers: "nats://localhost:4222",
    metrics
  });
  await service.onInit();

  const JobSchema = z.object({ id: z.number() });
  const subject = "test.metrics.redis";

  console.log("-> Recording metrics...");
  metrics.recordMessageReceived(subject);
  metrics.recordProcessingSuccess(subject, 100);
  metrics.recordProcessingError(subject, "test_error");
  
  await new Promise(resolve => setTimeout(resolve, 500)); // Esperar a que Redis procese

  const snapshot = await metrics.getSnapshot();
  console.log("📊 Redis Metrics Snapshot:", JSON.stringify(snapshot, null, 2));

  if (snapshot.counters[`received:${subject}`] === "1" && 
      snapshot.counters[`success:${subject}`] === "1" &&
      snapshot.counters[`error:test_error:${subject}`] === "1") {
    console.log("✅ Redis Metrics Verified!");
  } else {
    console.error("❌ Redis Metrics Mismatch!");
    process.exit(1);
  }

  await redis.quit();
  process.exit(0);
}

testRedisMetrics().catch(console.error);
