import "reflect-metadata";
import { describe, it, expect, afterAll } from "vitest";
import { z } from "zod";
import { container, singleton } from "tsyringe";
import { NatsMQ, NatsMQWorker, OnNatsMessage, NatsMQApp, defineQueue } from "../../src/lib/natsmq";

const testSuffix = Math.random().toString(36).substring(7);
const STREAM_NAME = `STR_ISOLATION_${testSuffix}`;
const IsoQueue = defineQueue(`iso_${testSuffix}`, { stream: STREAM_NAME });

// --- Contratos definidos fuera ---
const MessageA = IsoQueue.define("a", z.string());
const MessageB = IsoQueue.define("b", z.string());

@singleton()
@NatsMQWorker(IsoQueue)
class IsolationWorker {
  public receivedA: string[] = [];
  public receivedB: string[] = [];

  @OnNatsMessage(MessageA)
  async handleA(data: string) {
    this.receivedA.push(data);
  }

  @OnNatsMessage(MessageB)
  async handleB(data: string) {
    this.receivedB.push(data);
  }
}

@NatsMQApp({
  servers: "nats://localhost:4222",
  workers: [IsolationWorker]
})
class IsolationApp {}

describe("NatsMQ: Subscription Isolation", () => {
  let mq: NatsMQ;

  afterAll(async () => {
    if (mq) {
      await mq.engine.deleteStream(STREAM_NAME);
      await mq.close();
    }
  });

  it("should ensure handlers only receive messages they are specifically subscribed to", async () => {
    mq = await NatsMQ.bootstrap(IsolationApp);
    
    await mq.engine.publish(MessageA, "msg_A");
    await mq.engine.publish(MessageB, "msg_B");

    let wait = 0;
    const worker = container.resolve(IsolationWorker);
    while ((worker.receivedA.length < 1 || worker.receivedB.length < 1) && wait < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      wait++;
    }

    expect(worker.receivedA).toEqual(["msg_A"]);
    expect(worker.receivedB).toEqual(["msg_B"]);
    
    expect(worker.receivedA).not.toContain("msg_B");
    expect(worker.receivedB).not.toContain("msg_A");
  });
});
