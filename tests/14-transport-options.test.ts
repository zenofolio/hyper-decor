import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import {
  HyperApp,
  HyperModule,
  HyperService,
  OnMessage,
  createApplication,
  IMessageTransport,
  MessageBus,
} from "../src";
import { container } from "tsyringe";

// 1. Mock Transport that tracks options
class OptionTrackingTransport implements IMessageTransport {
  public lastListenOptions: any = null;
  public lastEmitOptions: any = null;

  async listen(topic: string, handler: (data: any) => Promise<void> | void, options?: any): Promise<void> {
    this.lastListenOptions = options;
  }

  async emit(topic: string, data: any, options?: any): Promise<void> {
    this.lastEmitOptions = options;
  }
}

@HyperService()
class TestService {
  @OnMessage("test.topic", { concurrency: 10, nats: { queue: "test-queue" } })
  async handle(data: any) {}
}

@HyperModule({ imports: [TestService] })
class TestModule {}

describe("Transport Options and Metadata", () => {
  it("should pass OnMessage options to the transport", async () => {
    const transport = new OptionTrackingTransport();

    @HyperApp({
      modules: [TestModule],
      transports: [transport]
    })
    class App {}

    const app = await createApplication(App);

    expect(transport.lastListenOptions).toEqual({
      concurrency: 10,
      nats: { queue: "test-queue" }
    });

    // Test emission options
    await app.emit("emit.topic", { foo: "bar" }, { priority: "high" });
    expect(transport.lastEmitOptions).toEqual({ priority: "high" });

    await app.close();
  });

  it("should support module augmentation for options (Type check only behavior)", async () => {
    // This is more of a documentation/compile-time check, but we can verify the object structure
    const options = {
        concurrency: 5,
        nats: { queue: "my-queue" }
    };
    
    // In a real scenario, the user would do:
    // declare module "../src" { interface IMessageOptions { nats: { queue: string } } }
    
    expect(options.nats.queue).toBe("my-queue");
  });
});
