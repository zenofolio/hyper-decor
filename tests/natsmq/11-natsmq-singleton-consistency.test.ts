import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { container, singleton, inject } from "tsyringe";
import { NatsMQ, NatsMQApp, NatsMQService, NatsMQWorker, OnNatsMessage } from "../../src/lib/natsmq/index";
import { defineQueue } from "../../src/lib/natsmq/contracts";
import { z } from "zod";

const STREAM_NAME = "STR_SINGLETON_TEST";
const MyQueue = defineQueue("singleton_test", { stream: STREAM_NAME });
const MyMsg = MyQueue.define("ping", z.any());

@singleton()
@NatsMQWorker(MyQueue)
class SingletonWorker {
  constructor(
    @inject(NatsMQService) public mqService: NatsMQService
  ) {}

  @OnNatsMessage(MyMsg)
  async handlePing() {
    // Should be able to access engine here
    const engine = this.mqService.getEngine();
    expect(engine).toBeDefined();
  }
}

@NatsMQApp({
  servers: "nats://localhost:4222",
  workers: [SingletonWorker]
})
class SingletonApp {}

describe("NatsMQ: Singleton Consistency", () => {
  it("should provide the same initialized engine via DI and static access", async () => {
    // 1. Bootstrap
    const mq = await NatsMQ.bootstrap(SingletonApp);

    // 2. Static check
    const staticEngine = NatsMQService.getEngine();
    expect(staticEngine).toBeDefined();
    expect(staticEngine).toBe(mq.engine);

    // 3. DI check
    const worker = container.resolve(SingletonWorker);
    expect(worker.mqService.getEngine()).toBe(mq.engine);
    expect(worker.mqService.mq).toBe(mq);

    // 4. Cleanup
    await mq.engine.deleteStream(STREAM_NAME);
    await mq.close();
  });
});
