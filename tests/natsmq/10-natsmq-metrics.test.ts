import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Redis } from "ioredis";
import { RedisMetrics } from "../../src/lib/natsmq/metrics/redis-metrics";
import { NatsMQService } from "../../src/lib/natsmq/service";
import { NatsMQEngine } from "../../src/lib/natsmq/engine";
import { defineQueue } from "../../src/lib/natsmq/contracts";
import { DeliverPolicy } from "nats";
import { z } from "zod";

describe("NatsMQ: Metrics System", () => {
  let redis: Redis;
  let metrics: RedisMetrics;
  let isConnected = false;
  const suitePrefix = `natsmq:metrics:suite:${Date.now()}:${Math.random().toString(36).substring(7)}`;

  beforeAll(async () => {
    try {
      redis = new Redis({ host: "localhost", port: 6379, maxRetriesPerRequest: 1 });
      await new Promise((resolve, reject) => {
        redis.on('ready', () => { isConnected = true; resolve(true); });
        redis.on('error', (err) => { reject(err); });
        setTimeout(() => reject(new Error("Timeout")), 1000);
      });
      if (isConnected) {
        metrics = new RedisMetrics({ redis, prefix: suitePrefix });
      }
    } catch (e) {
      isConnected = false;
    }
  });

  afterAll(async () => {
    if (redis) {
      // Clean up our specific suite keys
      const keys = await redis.keys(`${suitePrefix}:*`);
      if (keys.length > 0) await redis.del(...keys);
      await redis.quit();
    }
    const service = NatsMQService.getInstance();
    if (service.mq) {
      await service.mq.engine.deleteStream("STR_METRICS_PENDING");
      await service.close();
    }
  });

  it("should record and retrieve basic metrics via Redis", async () => {
    if (!isConnected) return;

    const subject = "test.metrics.unit";

    await metrics.recordMessageReceived(subject);
    await metrics.recordProcessingSuccess(subject, 150);
    await metrics.recordProcessingError(subject, "unit_test_err");

    // Wait a bit for Redis consistency
    await new Promise(resolve => setTimeout(resolve, 200));

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

  it("should provide metrics via NatsMQEngine directly", async () => {
    if (!isConnected) return;

    const engine = new NatsMQEngine({
      servers: "nats://localhost:4222",
      metrics: metrics
    });

    // Mock start state
    (engine as any).running = true;
    (engine as any).js = {};

    const subject = "engine.test.metrics";
    await metrics.recordMessageReceived(subject);

    const count = await engine.getCounter('received', subject);
    expect(count).toBe(1);
  });

  it("should retrieve real-time pending count from NATS", async () => {
    if (!isConnected) return;

    const streamName = "STR_METRICS_PENDING";
    const MyQueue = defineQueue("metrics_pending", { 
      stream: streamName,
      deliver_policy: DeliverPolicy.All 
    });
    const MyMsg = MyQueue.define("job", z.any());

    const service = NatsMQService.getInstance();
    service.configure({ servers: "nats://localhost:4222" });
    await service.onInit();

    // 0. Clean start
    await service.mq?.engine.deleteStream(streamName);

    // 1. Provision the stream
    await service.mq?.engine.provisionStream(MyMsg.getNatsConfig() as any);
    
    // 2. Create a consumer with a handler that DOES NOT ACK immediately
    let resolveHandler: any;
    const handlerPromise = new Promise(resolve => { resolveHandler = resolve; });
    
    await service.mq?.engine.createPullConsumer(MyMsg.getNatsConfig() as any, [], async () => {
      await handlerPromise; // Block here
    });

    // 3. Publish 3 messages
    await service.mq?.engine.publish(MyMsg, { data: 1 });
    await service.mq?.engine.publish(MyMsg, { data: 2 });
    await service.mq?.engine.publish(MyMsg, { data: 3 });

    // 4. Wait for NATS to deliver and update stats
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 5. Verify stats
    const stats = await service.getPendingCount(MyMsg);
    
    // Total should be 3
    expect(stats.unacked + stats.pending).toBe(3);
    
    // Clean up
    resolveHandler();
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
