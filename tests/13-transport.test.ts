import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import {
  HyperApp,
  HyperModule,
  HyperService,
  OnMessage,
  createApplication,
  IMessageTransport,
} from "../src";
import { container } from "tsyringe";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 1. Mock Transport Implementation
class MockTransport implements IMessageTransport {
  name: string = "mock";
  public lastEmitted: { topic: string, data: any } | null = null;
  public handlers: Map<string, Function[]> = new Map();

  async emit(topic: string, data: any, options?: any): Promise<void> {
    this.lastEmitted = { topic, data };

    // Simulate network delay or bridge behavior
    const listeners = this.handlers.get(topic) || [];
    listeners.forEach(h => h(data));
  }

  async listen(topic: string, handler: (data: any) => Promise<void> | void, options?: any): Promise<void> {
    const listeners = this.handlers.get(topic) || [];
    listeners.push(handler);
    this.handlers.set(topic, listeners);
  }
}

// 2. Service using the transport
@HyperService()
class TestService {
  public receivedData: any = null;

  @OnMessage("custom.event")
  async handleCustomEvent(data: any) {
    this.receivedData = data;
  }
}

@HyperModule({
  imports: [TestService]
})
class TestModule { }

describe("Transport Extensibility", () => {
  it("should use and verify a custom transport", async () => {
    const transport = new MockTransport();
    const listenSpy = vi.spyOn(transport, 'listen');
    const emitSpy = vi.spyOn(transport, 'emit');

    @HyperApp({
      modules: [TestModule],
      transports: [transport] // Inject the custom transport
    })
    class App { }

    const app = await createApplication(App);
    const service = container.resolve(TestService);


    // Verify: The framework should have called 'listen' on our transport
    // during bootstrap because of the @OnMessage decorator.
    expect(listenSpy).toHaveBeenCalledWith("custom.event", expect.any(Function), undefined);

    // Test: Emit via the app, should trigger transport.emit
    await app.emit("external.topic", { hello: "world" });
    expect(transport.lastEmitted?.topic).toBe("external.topic");
    expect(transport.lastEmitted?.data.m).toEqual({ hello: "world" });
    expect(emitSpy).toHaveBeenCalled();

    // Test: Trigger the transport manually (simulating external incoming message)
    const handlers = transport.handlers.get("custom.event") || [];
    await Promise.all(handlers.map(h => h({ foo: "bar" })));

    await delay(10); // Wait for async handler
    expect(service.receivedData).toEqual({ foo: "bar" });

    await app.close();
  });
});
