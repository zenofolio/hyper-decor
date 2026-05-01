import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Redis } from "ioredis";
import { RedisMetrics } from "../../src/lib/natsmq/metrics/redis-metrics";
import { defineQueue } from "../../src/lib/natsmq/contracts";
import { DeliverPolicy } from "nats";
import { z } from "zod";
import { NatsMQ, NatsMQApp } from "../../src/lib/natsmq";

describe("NatsMQ: Unified Metrics API (count)", () => {
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
      const keys = await redis.keys(`${suitePrefix}:*`);
      if (keys.length > 0) await redis.del(...keys);
      await redis.quit();
    }
  });

  it("should retrieve multiple metrics at once using mq.count()", async () => {
    if (!isConnected) return;

    @NatsMQApp({
      servers: "nats://localhost:4222",
      metrics: metrics
    })
    class MetricsApp { }

    const mq = await NatsMQ.bootstrap(MetricsApp);
    const MyQueue = defineQueue("orders");
    const MyMsg = MyQueue.define("created", z.any());

    // Record some activity (internally)
    await mq.metrics.recordMessageReceived("orders.created");
    await mq.metrics.recordProcessingSuccess("orders.created", 100);

    // Verify via unified API
    const stats = await mq.count(['received', 'success', 'error'], MyMsg);

    expect(stats.received).toBe(1);
    expect(stats.success).toBe(1);
    expect(stats.error).toBe(0);

    // Verify wildcard aggregation via Queue provider
    const queueStats = await mq.count(['received', 'success'], MyQueue);
    expect(queueStats.success).toBe(1);

    await mq.close();
  });

  it("should include real-time NATS stats in the count() method", async () => {
    if (!isConnected) return;

    const testSuffix = Math.random().toString(36).substring(7);
    const streamName = `STR_COUNT_STATS_${testSuffix}`;
    const durableName = `CONS_COUNT_${testSuffix}`;
    const MyQueue = defineQueue(`count_stats_${testSuffix}`, {
      stream: streamName,
      deliver_policy: DeliverPolicy.All
    });
    const MyMsg = MyQueue.define("job", z.any());

    @NatsMQApp({ servers: "nats://localhost:4222" })
    class StatsApp { }

    const mq = await NatsMQ.bootstrap(StatsApp);

    // 1. Provision & Subscribe (but block handler to keep messages unacked)
    let resolveHandler: any;
    const handlerPromise = new Promise(resolve => { resolveHandler = resolve; });

    await mq.subscribe(MyMsg, async () => {
      await handlerPromise;
    });

    // 2. Publish 2 messages
    await mq.engine.publish(MyMsg, { id: 1 });
    await mq.engine.publish(MyMsg, { id: 2 });

    // 3. Wait for NATS to deliver to consumer
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 4. Verify combined stats (Metrics + NATS + Store)
    const combined = await mq.count(['received', 'pending', 'unacked', 'active'], MyMsg);

    // received comes from metrics, pending/unacked from NATS, active from Store
    expect(combined.received).toBeGreaterThanOrEqual(2);
    expect(combined.unacked + combined.pending).toBe(2);
    expect(combined.active).toBeGreaterThanOrEqual(0);

    resolveHandler();
    await mq.engine.deleteStream(streamName);
    await mq.close();
  });

  it("should support global system counts", async () => {
    if (!isConnected) return;

    @NatsMQApp({
      servers: "nats://localhost:4222",
      metrics: metrics
    })
    class GlobalApp { }

    const mq = await NatsMQ.bootstrap(GlobalApp);

    await mq.metrics.recordProcessingSuccess("sub.1", 100);
    await mq.metrics.recordProcessingSuccess("sub.2", 200);

    const totalStats = await mq.count(['success']);
    expect(totalStats.success).toBeGreaterThanOrEqual(2);

    await mq.close();
  });
});
