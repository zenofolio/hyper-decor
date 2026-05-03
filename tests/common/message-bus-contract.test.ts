import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MessageBus } from "../../src/common/message-bus";
import { InternalTransport } from "../../src/common/transport";
import { defineQueue } from "../../src/lib/natsmq/contracts";
import { z } from "zod";
import { container } from "tsyringe";

describe("MessageBus with IMessageContract", () => {
  let bus: MessageBus;
  let transport: InternalTransport;

  beforeAll(() => {
    container.register("ILogger", { useClass: class { log() {} error() {} warn() {} info() {} debug() {} } as any });
    transport = container.resolve(InternalTransport);
    bus = container.resolve(MessageBus);
    bus.registerTransport(transport);
  });

  it("should emit using a NatsMessageContract and validate payload", async () => {
    const UserQueue = defineQueue("users");
    const CreateUser = UserQueue.define("create", z.object({ id: z.number(), name: z.string() }));

    let receivedData: any = null;
    
    // Subscribe to the resolved subject
    await bus.listen(CreateUser, (data) => {
      receivedData = data;
    });

    const payload = { id: 1, name: "Zeno" };
    
    // Emit using the contract directly!
    await bus.emit(CreateUser, payload, { 
      idempotencyKey: "unique-1",
      headers: { "x-test": "true" }
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(receivedData).toEqual(payload);
  });

  it("should fail to emit if payload does not match contract schema", async () => {
    const OrderContract = defineQueue("orders").define("cancel", z.object({ orderId: z.string() }));

    // @ts-expect-error - testing invalid payload
    const action = () => bus.emit(OrderContract, { orderId: 123 }); // 123 is not a string

    await expect(action()).rejects.toThrow();
  });

  it("should support fill() and still work as a contract", async () => {
    const DynamicContract = defineQueue("tasks").define("run.:id", z.object({ cmd: z.string() }));
    
    let receivedTopic = "";
    await bus.listen("tasks.run.42", (data, envelope) => {
       // Manual check if topic matched
       receivedTopic = "tasks.run.42";
    });

    // Use .fill() - this returns a NEW NatsMessageContract
    const filled = DynamicContract.fill({ id: "42" });
    
    await bus.emit(filled, { cmd: "test" });

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(receivedTopic).toBe("tasks.run.42");
  });
});
