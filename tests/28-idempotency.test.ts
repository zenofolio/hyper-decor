import "reflect-metadata";
import { describe, it, expect, beforeEach } from "vitest";
import {
  HyperApp,
  HyperService,
  OnMessage,
  createApplication,
  MessageBus,
  Transport,
  InternalTransport,
  InMemoryIdempotencyStore
} from "../src";
import { container } from "tsyringe";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

@HyperService()
class IdempotentService {
  public callCount = 0;
  public bypassCount = 0;

  @OnMessage("test.idempotent")
  async handle() {
    this.callCount++;
  }

  @OnMessage("test.bypass", { idempotency: false })
  async handleBypass() {
    this.bypassCount++;
  }
}

@HyperApp({
  imports: [IdempotentService],
  transports: [InternalTransport],
  modules: []
})
class TestApp { }

describe("Idempotency Interceptor", () => {
  beforeEach(() => {
    container.clearInstances();
  });

  it("should prevent duplicate processing of the same message ID", async () => {
    const app = await createApplication(TestApp);
    const service = container.resolve(IdempotentService);

    // 1. First emit
    const key = "unique-op-1";
    await MessageBus.emit("test.idempotent", { data: 1 }, { idempotencyKey: key });
    expect(service.callCount).toBe(1);

    // 2. Second emit with same key (should be ignored)
    await MessageBus.emit("test.idempotent", { data: 1 }, { idempotencyKey: key });
    expect(service.callCount).toBe(1); // Still 1!

    await app.close();
  });

  it("should allow bypassing idempotency if explicitly disabled in decorator", async () => {
    const app = await createApplication(TestApp);
    const service = container.resolve(IdempotentService);

    const key = "bypass-key";
    await MessageBus.emit("test.bypass", {}, { idempotencyKey: key });
    await MessageBus.emit("test.bypass", {}, { idempotencyKey: key });

    expect(service.bypassCount).toBe(2); // Both processed

    await app.close();
  });

  it("should expire keys after TTL", async () => {
    // We'll use a very short TTL for testing
    @HyperApp({
      imports: [IdempotentService],
      transports: [InternalTransport],
      idempotency: { ttl: 50 },
      modules: []
    })
    class ShortTtlApp { }

    const app = await createApplication(ShortTtlApp);
    const service = container.resolve(IdempotentService);

    const key = "ttl-key";
    await MessageBus.emit("test.idempotent", {}, { idempotencyKey: key });
    expect(service.callCount).toBe(1);

    // Wait for expiration
    await delay(100);

    await MessageBus.emit("test.idempotent", {}, { idempotencyKey: key });
    expect(service.callCount).toBe(2); // Processed again after TTL

    await app.close();
  });
});
