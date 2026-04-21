import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { 
    MessageBus, 
    IMessageTransport, 
    IMessageOptions, 
    IMessageEmitOptions 
} from "../src";
import { container } from "tsyringe";

class MockTransport implements IMessageTransport {
    constructor(public readonly name: string) {}
    public emit = vi.fn().mockResolvedValue(undefined);
    public listen = vi.fn().mockResolvedValue(undefined);
}

describe("Multi-Transport Routing", () => {
    let bus: MessageBus;
    let nats: MockTransport;
    let redis: MockTransport;

    beforeEach(() => {
        container.clearInstances();
        bus = container.resolve(MessageBus);
        nats = new MockTransport("nats");
        redis = new MockTransport("redis");
        
        bus.registerTransport(nats);
        bus.registerTransport(redis);
    });

    it("should emit to ALL transports by default", async () => {
        await bus.emit("test.topic", { foo: "bar" });
        
        expect(nats.emit).toHaveBeenCalledWith("test.topic", { foo: "bar" }, undefined);
        expect(redis.emit).toHaveBeenCalledWith("test.topic", { foo: "bar" }, undefined);
    });

    it("should emit ONLY to NATS when targeted", async () => {
        await bus.emit("test.topic", { foo: "bar" }, { transport: "nats" });
        
        expect(nats.emit).toHaveBeenCalled();
        expect(redis.emit).not.toHaveBeenCalled();
    });

    it("should emit ONLY to Redis when targeted", async () => {
        await bus.emit("test.topic", { foo: "bar" }, { transport: "redis" });
        
        expect(redis.emit).toHaveBeenCalled();
        expect(nats.emit).not.toHaveBeenCalled();
    });

    it("should subscribe ONLY on specific transport when targeted", async () => {
        const handler = () => {};
        await bus.listen("test.topic", handler, { transport: "nats" });
        
        expect(nats.listen).toHaveBeenCalledWith("test.topic", handler, { transport: "nats" });
        expect(redis.listen).not.toHaveBeenCalled();
    });

    it("should subscribe on ALL transports by default", async () => {
        const handler = () => {};
        await bus.listen("test.topic", handler);
        
        expect(nats.listen).toHaveBeenCalled();
        expect(redis.listen).toHaveBeenCalled();
    });
});
