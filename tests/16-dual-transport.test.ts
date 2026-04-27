import "reflect-metadata";
import { describe, it, expect } from "vitest";
import {
  HyperApp,
  HyperService,
  OnInternal,
  OnTransport,
  OnMessage,
  createApplication,
  Transport,
  MessageBus,
  InternalTransport,
  IMessageTransport,
  ILogger
} from "../src";
import { container, singleton, injectable } from "tsyringe";

/**
 * 🛠️ Mock Transport for testing ruteo logic
 */
@singleton()
@injectable()
class MockTransport implements IMessageTransport {
  readonly name = "mock-dist";
  public receivedEmits: any[] = [];
  public handlers: Map<string, Function[]> = new Map();

  async listen(topic: string, handler: (data: any) => Promise<void> | void): Promise<void> {
    if (!this.handlers.has(topic)) this.handlers.set(topic, []);
    this.handlers.get(topic)?.push(handler);
  }

  async emit(topic: string, data: any): Promise<void> {
    this.receivedEmits.push({ topic, data });
  }

  async isConnected(): Promise<boolean> { return true; }
  async close(): Promise<void> { }
  setLogger(logger: ILogger): void { }

  // Helper for the test to simulate an incoming message from the "network"
  async simulateIncoming(topic: string, data: any) {
    const topicHandlers = this.handlers.get(topic);
    if (topicHandlers) {
      await Promise.all(topicHandlers.map(h => h(data)));
    }
  }
}

@HyperService()
class DualChannelService {
  public internalHits = 0;
  public mockHits = 0;
  public broadcastHits = 0;

  @OnInternal("event.local")
  onLocal() {
    this.internalHits++;
  }

  @OnTransport("mock-dist", "event.remote")
  onRemote() {
    this.mockHits++;
  }

  @OnMessage("event.broadcast")
  onBroadcast() {
    this.broadcastHits++;
  }
}

@HyperApp({
  transports: [InternalTransport, MockTransport],
  imports: [DualChannelService]
})
class DualApp { }

describe("Dual Transport Strategy (Functional Test)", () => {
  it("should correctly segregate local and distributed messages", async () => {
    const app = await createApplication(DualApp);
    const service = container.resolve(DualChannelService);
    const mock = container.resolve(MockTransport);

    // --- 1. Test emitLocal (Internal Only) ---
    // This should hit internalHits but NOT be sent to the mock transport
    await MessageBus.emitLocal("event.local", { fast: true });
    expect(service.internalHits).toBe(1);
    expect(mock.receivedEmits.length).toBe(0);

    // --- 2. Test targeted emit (Mock Only) ---
    // This should NOT hit any local listener (since nobody is listening to event.remote via Internal)
    // but should be recorded by the mock transport
    await MessageBus.emit("event.remote", { data: 123 }, { transport: "mock-dist" });
    expect(service.mockHits).toBe(0); 
    
    // Check envelope
    expect(mock.receivedEmits[0].topic).toBe("event.remote");
    expect(mock.receivedEmits[0].data.m).toEqual({ data: 123 });
    expect(mock.receivedEmits[0].data.i).toBeDefined(); // Message ID
    expect(mock.receivedEmits[0].data.t).toBeDefined(); // Timestamp

    // --- 3. Test incoming from Mock ---
    // Simulate NATS/Redis receiving a message wrapped in an envelope
    await mock.simulateIncoming("event.remote", { 
      i: "msg-123", 
      t: Date.now(), 
      m: { data: "from-wire" } 
    });
    expect(service.mockHits).toBe(1);
    expect(service.internalHits).toBe(1); // Should stay at 1

    // --- 4. Test broadcast (Internal + Mock) ---
    await MessageBus.emit("event.broadcast", { hello: "world" });
    expect(service.broadcastHits).toBe(1); 
    
    const broadcastEmitsToMock = mock.receivedEmits.filter(e => e.topic === "event.broadcast");
    expect(broadcastEmitsToMock[0].data.m).toEqual({ hello: "world" });

    // --- 5. Test emitLocal on a broadcast topic ---
    await MessageBus.emitLocal("event.broadcast", { local: true });
    expect(service.broadcastHits).toBe(2); 
    // Verify it wasn't sent to mock this time
    const broadcastEmitsToMockAgain = mock.receivedEmits.filter(e => e.topic === "event.broadcast");
    expect(broadcastEmitsToMockAgain.length).toBe(1); // Still only the one from step 4

    await app.close();
  });

  it("should work with Transport enum", async () => {
    // Re-verify enum values match our expectations
    expect(Transport.INTERNAL).toBe("internal");
    
    const app = await createApplication(DualApp);
    const mock = container.resolve(MockTransport);
    
    // Emit using enum
    await MessageBus.emit("enum.test", {}, { transport: Transport.INTERNAL });
    // This shouldn't reach mock
    expect(mock.receivedEmits.filter(e => e.topic === "enum.test").length).toBe(0);

    await app.close();
  });
});
