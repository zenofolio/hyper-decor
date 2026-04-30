import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Redis } from "ioredis";
import { RedisMetrics } from "../../src/lib/natsmq/metrics/redis-metrics";
import { NatsMQService } from "../../src/lib/natsmq/service";
import { z } from "zod";

describe("NatsMQ: Metrics System", () => {
  let redis: Redis;
  let metrics: RedisMetrics;
  let isConnected = false;

  beforeAll(async () => {
    try {
      redis = new Redis({ host: "localhost", port: 6379, maxRetriesPerRequest: 1 });
      await new Promise((resolve, reject) => {
        redis.on('ready', () => { isConnected = true; resolve(true); });
        redis.on('error', (err) => { reject(err); });
        setTimeout(() => reject(new Error("Timeout")), 1000);
      });
      if (isConnected) {
        await redis.flushall();
        metrics = new RedisMetrics({ redis });
      }
    } catch (e) {
      isConnected = false;
    }
  });

  afterAll(async () => {
    if (redis) await redis.quit();
  });

  it("should record and retrieve basic metrics via Redis", async () => {
    if (!isConnected) return;

    const subject = "test.metrics.unit";

    await metrics.recordMessageReceived(subject);
    await metrics.recordProcessingSuccess(subject, 150);
    await metrics.recordProcessingError(subject, "unit_test_err");

    // Wait a bit for Redis consistency
    await new Promise(resolve => setTimeout(resolve, 100));

    const snapshot = await metrics.getSnapshot();

    expect(snapshot.received[subject]).toBe("1");
    expect(snapshot.success[subject]).toBe("1");
    expect(snapshot.error[subject]).toBe("1");

    // Average latency should be recorded
    const averageLatency = await metrics.getAverageLatency(subject);
    expect(averageLatency).toBe(150);
  });

  it("should support INatsProvider and Wildcards", async () => {
    if (!isConnected) return;

    const { defineQueue } = await import("../../src/lib/natsmq/contracts");
    const MyQueue = defineQueue("orders");
    const MyMsg = MyQueue.define("created", z.any());

    // Record metrics for specific subject
    await metrics.recordMessageReceived("orders.created");
    await metrics.recordProcessingSuccess("orders.created", 100);
    
    await metrics.recordMessageReceived("orders.deleted");
    await metrics.recordProcessingSuccess("orders.deleted", 200);

    // 1. Test via Contract (Individual)
    const msgCount = await metrics.getCounter('success', MyMsg);
    expect(msgCount).toBe(1);

    // 2. Test via Queue Factory (Wildcard aggregation)
    const queueCount = await metrics.getCounter('success', MyQueue);
    expect(queueCount).toBe(2);

    const queueLatency = await metrics.getAverageLatency(MyQueue);
    expect(queueLatency).toBe(150); // (100 + 200) / 2
  });

  it("should provide metrics via NatsMQService", async () => {
    if (!isConnected) return;

    const service = NatsMQService.getInstance();
    service.configure({
      servers: "nats://localhost:4222",
      metrics: metrics
    });

    const subject = "service.test.metrics";
    await metrics.recordMessageReceived(subject);

    const count = await service.getCounter('received', subject);
    expect(count).toBe(1);
  });

  it("should increment generic counters", async () => {
    if (!isConnected) return;

    const counterName = "custom_counter";
    await metrics.increment(counterName, 5);
    await metrics.increment(counterName, 3);

    const snapshot = await metrics.getSnapshot();
    expect(snapshot.counters[counterName]).toBe("8");
  });

  it("should record gauges", async () => {
    if (!isConnected) return;

    const gaugeName = "active_workers";
    await metrics.gauge(gaugeName, 10);
    await metrics.gauge(gaugeName, 15);

    const snapshot = await metrics.getSnapshot();
    expect(snapshot.gauges[gaugeName]).toBe("15");
  });
});
