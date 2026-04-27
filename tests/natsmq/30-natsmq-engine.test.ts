import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { NatsMQEngine } from "../src/lib/natsmq/engine";
import { NatsSubscriptionMeta, NatsConcurrencyMeta } from "../src/lib/natsmq/decorators";
import { z } from "zod";
import { connect, NatsConnection, StringCodec, DeliverPolicy } from "nats";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe("NatsMQ Engine Integrations", () => {
  let engine: NatsMQEngine;
  let testNc: NatsConnection;
  let isNatsAvailable = false;
  const sc = StringCodec();

  beforeAll(async () => {
    try {
      testNc = await connect({ servers: "nats://localhost:4222", timeout: 1000 });
      isNatsAvailable = true;
    } catch (e) {
      isNatsAvailable = false;
    }
  });

  afterAll(async () => {
    if (isNatsAvailable && testNc) {
      await testNc.close();
    }
  });

  beforeEach(async () => {
    if (isNatsAvailable) {
      engine = new NatsMQEngine({
        servers: "nats://localhost:4222",
        dlsSubject: "dead.letter.queue",
        retryBackoffMs: [100, 200, 300] // Fast backoff for tests
      });
      await engine.start();
    }
  });

  afterEach(async () => {
    if (isNatsAvailable && engine) {
      await engine.close();
    }
  });

  it("should provision stream and pull consumer correctly", async (ctx) => {
    if (!isNatsAvailable) return ctx.skip();

    const UserSchema = z.object({ name: z.string() });
    
    const meta: NatsSubscriptionMeta = {
      methodName: "handleUser",
      subject: "users_v2.created",
      schema: UserSchema,
      isRequest: false,
      options: {
        stream: "TEST_USERS_STREAM_V2",
        deliver_policy: DeliverPolicy.New
      }
    };

    // Auto provision
    await engine.provisionStream(meta);
    
    let handled = false;
    
    // Start pull loop
    await engine.createPullConsumer(meta, undefined, async (data) => {
      expect(data.name).toBe("Alice");
      handled = true;
    });

    // Wait for consumer to bind
    await delay(500);

    // Publish matching schema
    await engine.publish("users_v2.created", UserSchema, { name: "Alice" });

    // Wait for pull to fetch and process
    await delay(1000);

    expect(handled).toBe(true);
  });

  it("should send invalid payloads to DLS and not execute handler", async (ctx) => {
    if (!isNatsAvailable) return ctx.skip();

    const OrderSchema = z.object({ id: z.number() });
    
    const meta: NatsSubscriptionMeta = {
      methodName: "handleOrder",
      subject: "orders_v2.placed",
      schema: OrderSchema,
      isRequest: false,
      options: {
        stream: "TEST_ORDERS_STREAM_V2",
        deliver_policy: DeliverPolicy.New
      }
    };

    await engine.provisionStream(meta);

    let dlsHit = false;
    testNc.subscribe("dead.letter.queue", {
      callback: (err, msg) => {
        const payload = JSON.parse(sc.decode(msg.data));
        if (payload.subject === "orders_v2.placed") {
          dlsHit = true;
        }
      }
    });

    let handled = false;
    await engine.createPullConsumer(meta, undefined, async (data) => {
      handled = true; // Should not reach here
    });

    await delay(500);

    // Publish INVALID schema (string instead of number)
    testNc.publish("orders_v2.placed", sc.encode(JSON.stringify({ id: "not-a-number" })));

    await delay(1000);

    expect(handled).toBe(false); // Handler protected
    expect(dlsHit).toBe(true);   // Sent to DLS
  });

  it("should apply semaphore backpressure on concurrent matching subjects", async (ctx) => {
    if (!isNatsAvailable) return ctx.skip();

    const JobSchema = z.object({ id: z.number() });
    
    const meta: NatsSubscriptionMeta = {
      methodName: "processJob",
      subject: "jobs_v2.>",
      schema: JobSchema,
      isRequest: false,
      options: {
        stream: "TEST_JOBS_STREAM_V2",
        deliver_policy: DeliverPolicy.New,
        ack_wait: 5000000000 // 5s in ns
      }
    };

    const concurrencyMeta: NatsConcurrencyMeta = {
      pattern: "jobs_v2.>",
      limit: 1 // Only 1 concurrent per exact subject
    };

    await engine.provisionStream(meta);

    let activeJobs = 0;
    let maxOverlap = 0;
    let completed = 0;

    await engine.createPullConsumer(meta, concurrencyMeta, async (data, msg) => {
      // It's the SAME exact subject, so overlap should NEVER exceed 1
      activeJobs++;
      maxOverlap = Math.max(maxOverlap, activeJobs);
      
      // Simulate heavy work
      await delay(300);
      
      activeJobs--;
      completed++;
    });

    await delay(500);

    // Blast 3 messages to the EXACT SAME subject
    engine.publish("jobs_v2.sync.1", JobSchema, { id: 1 });
    engine.publish("jobs_v2.sync.1", JobSchema, { id: 2 });
    engine.publish("jobs_v2.sync.1", JobSchema, { id: 3 });

    // Blast 1 message to a DIFFERENT subject (should not be blocked)
    engine.publish("jobs_v2.sync.2", JobSchema, { id: 4 });

    // The first 3 should be processed sequentially. The 4th can happen in parallel.
    // So max overlap globally across both subjects could be 2, but overlap per subject is 1.
    // Total time might be higher due to NATS redelivery intervals
    await delay(2500);

    expect(completed).toBe(4);
    // Since we sent 4 messages but only 1 to a different subject, 
    // the max global overlap we could ever observe is 2 (1 for jobs.sync.1, 1 for jobs.sync.2).
    // The semaphore MUST prevent the 3 messages for jobs.sync.1 from running simultaneously.
    expect(maxOverlap).toBeLessThanOrEqual(2);
  });
});
