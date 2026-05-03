import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NatsMQEngine } from "../../src/lib/natsmq/engine";
import { DefaultNatsMQMetrics } from "../../src/lib/natsmq/metrics";
import { LocalConcurrencyStore } from "../../src/lib/natsmq/store/local-store";
import { z } from "zod";
import { AckPolicy, connect, StringCodec } from "nats";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe("NatsMQ Audit Proofs (Production Failure Simulations)", () => {
  let engineA: NatsMQEngine;
  let engineB: NatsMQEngine;
  let nc: any;
  let jsm: any;
  const STREAM_NAME = "AUDIT_PROOFS";

  beforeAll(async () => {
    // We connect a raw client to inspect the stream directly
    nc = await connect({ servers: "nats://localhost:4222" });
    jsm = await nc.jetstreamManager();

    try {
      await jsm.streams.delete(STREAM_NAME);
    } catch (e) {}

    engineA = new NatsMQEngine({
      servers: "nats://localhost:4222",
      concurrencyStore: new LocalConcurrencyStore(),
      metrics: new DefaultNatsMQMetrics(),
      dlsSubject: "audit.dls" // Defined, but will prove it's never used
    });

    engineB = new NatsMQEngine({
      servers: "nats://localhost:4222",
      concurrencyStore: new LocalConcurrencyStore(),
      metrics: new DefaultNatsMQMetrics(),
      dlsSubject: "audit.dls"
    });

    await engineA.start();
    await engineB.start();
  });

  afterAll(async () => {
    await engineA.close();
    await engineB.close();
    try {
      await jsm.streams.delete(STREAM_NAME);
    } catch (e) {}
    await nc.close();
  });

  it("Proof 1: 'La Tarea Robada' - Duplicate processing due to ack_wait vs lock_wait", async () => {
    const subject = "audit.robada";
    let executionsA = 0;
    let executionsB = 0;

    const meta = {
      subject,
      options: { 
        stream: STREAM_NAME, 
        durable_name: "robada_cons",
        ack_wait: 2000000000, // 2 seconds in nanoseconds
        max_deliver: 3
      },
      schema: z.any(),
      key: "test",
      methodName: "test",
      className: "test",
      isRequest: false,
      concurrencies: []
    };

    await engineA.provisionStream(meta as any);

    // Concurrency limit 1. 
    // We simulate a task that takes 3.5 seconds.
    // Ack wait is 2 seconds. NATS will redeliver at 2s.
    const concurrencies = [{ pattern: subject, limit: 1, ttlMs: 10000 }];

    // Start Consumer A
    await engineA.createPullConsumer(meta as any, concurrencies, async (data, msg) => {
      executionsA++;
      // Simulate heavy work taking longer than ack_wait
      await delay(3500); 
    });

    // Start Consumer B (Another Node)
    await engineB.createPullConsumer(meta as any, concurrencies, async (data, msg) => {
      executionsB++;
      await delay(500);
    });

    // Publish 1 single message
    await engineA.publish(subject, { id: 1 });

    // Wait 5 seconds to let the whole drama unfold
    // T=0: Node A gets message, acquires lock, sleeps 3.5s.
    // T=2: NATS ack_wait expires. NATS redelivers to Node B.
    // T=2: Node B gets message, spins in `while(!success)` waiting for lock.
    // T=3.5: Node A finishes, acks message, releases lock.
    // T=3.5: Node B acquires lock, processes the same message, acks message.
    await delay(5000);

    // PROOF: The same message was processed twice by the system!
    // This violates the entire purpose of concurrency locks.
    console.log(`[Proof 1] Executions Node A: ${executionsA}, Executions Node B: ${executionsB}`);
    
    // We expect both nodes to have executed the handler for a single published message.
    expect(executionsA + executionsB).toBeGreaterThan(1);
    expect(executionsA).toBe(1);
    expect(executionsB).toBe(1);
  }, 10000);

  it("Proof 2: 'El Agujero Negro' - DLS is completely ignored", async () => {
    const subject = "audit.blackhole";
    let executions = 0;
    
    // We will subscribe to the DLS subject manually using the raw client
    // to prove that no message ever arrives there.
    let dlsReceived = 0;
    const dlsSub = nc.subscribe("audit.dls");
    (async () => {
      for await (const m of dlsSub) {
        dlsReceived++;
      }
    })();

    const meta = {
      subject,
      options: { 
        stream: STREAM_NAME, 
        durable_name: "blackhole_cons",
        max_deliver: 2, // Fail permanently after 2 tries
        ack_wait: 1000000000 // 1 second
      },
      schema: z.any(),
      key: "test2",
      methodName: "test2",
      className: "test2",
      isRequest: false,
      concurrencies: []
    };

    await engineA.provisionStream(meta as any);

    await engineA.createPullConsumer(meta as any, [], async (data, msg) => {
      executions++;
      // We purposefully throw an error to trigger a NAK
      throw new Error("Poison Pill!");
    });

    await engineA.publish(subject, { payload: "poison" });

    // Wait for the message to be delivered 2 times and fail both times
    await delay(3000);

    // Let's check NATS stream state
    const info = await jsm.streams.info(STREAM_NAME);
    const msgCount = info.state.messages;

    console.log(`[Proof 2] Executions: ${executions}, Messages in DLS: ${dlsReceived}, Messages left in Stream: ${msgCount}`);

    // PROOF: The message was executed twice, failed both times, 
    // was deleted from NATS, and NEVER arrived at the DLS. Data loss confirmed.
    expect(executions).toBeGreaterThanOrEqual(2);
    expect(dlsReceived).toBe(0); // DLS is unused!
    
  }, 10000);
});
