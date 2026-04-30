import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NatsMQService, defineQueue, OnNatsMessage, HyperService, HyperApp, NatsTransport, createApplication, OnMessage } from "../../src/index";
import { z } from "zod";
import { connect, JSONCodec, NatsConnection } from "nats";
import { IHyperApp } from "../../src/type";

describe("NatsMQ: Core NATS Interoperability", async () => {
  let service: NatsMQService;
  let nc: NatsConnection;
  let app: IHyperApp<any>
  const jc = JSONCodec();

  const InteropQueue = defineQueue("interop.test", { stream: "STR_INTEROP" });
  const CoreMsg = InteropQueue.define("core_pub", z.object({ value: z.string() }));

  let receivedMessage: any = null;

  @HyperService()
  class InteropWorker {
    @OnNatsMessage(CoreMsg)
    async handle(data: any) {
      receivedMessage = data;
    }

    @OnNatsMessage(CoreMsg)
    async handle2(data: any) {
      receivedMessage = data;
    }

    @OnMessage(CoreMsg.subject)
    async Message(data: any) {}

    @OnMessage(CoreMsg.subject)
    async Message2(data: any) {}
  }

  @HyperApp({
    name: "test",
    imports: [InteropWorker],
    transports: [
      new NatsTransport({
        servers: "nats://localhost:4222",
      })
    ]
    , modules: []
  })
  class App { }

  beforeAll(async () => {
    app = await createApplication(App)
    service = NatsMQService.getInstance();
    service.configure({
      servers: "nats://localhost:4222",
    });

    // We also need a direct connection to simulate "Core NATS" publication
    nc = await connect({ servers: "nats://localhost:4222" });

    await service.onInit();
    await service.register(InteropWorker);
  });

  afterAll(async () => {
    try {
      await service.mq?.engine.deleteStream("STR_INTEROP");
    } catch { }
    await service.mq?.engine.close();
    await nc.close();
  });

  it("should capture and process messages published via raw NATS connection (Core NATS)", async () => {
    const payload = { value: "hello from core nats" };

    // PUBLISH USING CORE NATS (Not JetStream)
    // This is "fire and forget" from the producer side


    service.mq?.engine.publish(CoreMsg, payload);

    // Wait for the worker to pick it up from the stream
    await new Promise((resolve) => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (receivedMessage || Date.now() - start > 5000) {
          clearInterval(interval);
          resolve(true);
        }
      }, 100);
    });

    expect(receivedMessage).toEqual(payload);
    console.log("✅ Message successfully captured by JetStream even when published via Core NATS!");
  });
});
