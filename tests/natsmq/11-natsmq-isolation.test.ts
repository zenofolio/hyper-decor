import "reflect-metadata";
import { describe, it, expect, afterAll } from "vitest";
import { z } from "zod";
import { container, singleton } from "tsyringe";
import { NatsMQ, NatsMQWorker, OnNatsMessage, NatsMQApp, defineQueue } from "../../src/lib/natsmq";

const testSuffix = Math.random().toString(36).substring(7);
const STREAM_NAME = `STR_ISO_${testSuffix}`;
const IsoQueue = defineQueue(`iso_${testSuffix}`, { stream: STREAM_NAME });

// --- Different schemas to ensure validation error if mixed ---
const SchemaA = z.object({ id: z.number(), name: z.literal("A") });
const SchemaB = z.object({ id: z.number(), val: z.literal("B") });
const SchemaProg = z.object({ id: z.number(), mode: z.literal("PROG") });

const MessageA = IsoQueue.define("a", SchemaA);
const MessageB = IsoQueue.define("b", SchemaB);
const MessageProg = IsoQueue.define("prog", SchemaProg);


const metrics = {
  a: 0,
  b: 0
}

@singleton()
@NatsMQWorker(IsoQueue)
class IsolationWorker {
  public receivedA: any[] = [];
  public receivedB: any[] = [];

  @OnNatsMessage(MessageA)
  async handleA(data: any) {
    this.receivedA.push(data);
  }

  @OnNatsMessage(MessageB)
  async handleB(data: any) {
    this.receivedB.push(data);
  }
}

@NatsMQApp({
  servers: "nats://localhost:4222",
  workers: [IsolationWorker]
})
class IsolationApp { }

describe("NatsMQ: Subscription Isolation", () => {
  let mq: NatsMQ;

  afterAll(async () => {
    if (mq) {
      await mq.engine.deleteStream(STREAM_NAME);
      await mq.close();
    }
  });

  it("should ensure handlers only receive messages they are specifically subscribed to (Decorators + Programmatic)", async () => {
    mq = await NatsMQ.bootstrap(IsolationApp);

    // Programmatic subscription alongside workers
    const receivedProg: any[] = [];
    await mq.subscribe(MessageProg, async (data) => {
      receivedProg.push(data);
    });

    // Publish 3 of each
    for (let i = 1; i <= 3; i++) {
      await mq.engine.publish(MessageA, { id: i, name: "A" });
      await mq.engine.publish(MessageB, { id: i, val: "B" });
      await mq.engine.publish(MessageProg, { id: i, mode: "PROG" });
    }

    // Wait for delivery (expecting 3 of each)
    const worker = container.resolve(IsolationWorker);
    let wait = 0;
    while ((worker.receivedA.length < 3 || worker.receivedB.length < 3 || receivedProg.length < 3) && wait < 100) {
      await new Promise(resolve => setTimeout(resolve, 100));
      wait++;
    }

    // Assert Decorator Isolation
    expect(worker.receivedA).toHaveLength(3);
    expect(worker.receivedA.every(m => m.name === "A")).toBe(true);

    expect(worker.receivedB).toHaveLength(3);
    expect(worker.receivedB.every(m => m.val === "B")).toBe(true);

    // Assert Programmatic Isolation
    expect(receivedProg).toHaveLength(3);
    expect(receivedProg.every(m => m.mode === "PROG")).toBe(true);

    // CROSS-VERIFICATION: Ensure no cross-contamination
    // (If isolation failed, Schema validation or logic would have pushed objects to wrong arrays)
    expect(worker.receivedA).not.toContainEqual(expect.objectContaining({ val: "B" }));
    expect(worker.receivedB).not.toContainEqual(expect.objectContaining({ name: "A" }));
    expect(receivedProg).not.toContainEqual(expect.objectContaining({ name: "A" }));
  });

  it("should fail to process if we manually publish wrong schema to the subject (using raw publish)", async () => {
    // We try to "poison" the handler A with data for B by publishing manually to the raw subject
    // but the engine's filter_subject and schema validation should protect the core.
    const rawNc = (mq.engine as any).nc;
    const jc = (mq.engine as any).jc;

    // Poison "a" with "B" data
    await mq.engine.publish("iso_" + testSuffix + ".a" as any, { id: 99, val: "B" } as any);

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 500));

    const worker = container.resolve(IsolationWorker);
    // Worker A should NOT have added the poisoned message because the schema validation inside processMessage should fail
    // and it should be NAKed or logged as error.
    expect(worker.receivedA.find(m => m.id === 99)).toBeUndefined();
  });
});
