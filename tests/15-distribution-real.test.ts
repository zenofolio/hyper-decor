import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { fork, ChildProcess } from "child_process";
import path from "path";
import { NatsTransport, RedisTransport, MessageBus } from "../src";
import { container } from "tsyringe";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Real Distribution Testing (NATS & Redis)", () => {
    let workers: ChildProcess[] = [];
    const workerScript = path.resolve(__dirname, "worker.ts");

    const spawnWorker = (id: string, transport: string, topic: string, queue?: string): Promise<ChildProcess> => {
        return new Promise((resolve, reject) => {
            const child = fork(workerScript, [], {
                env: {
                    ...process.env,
                    WORKER_ID: id,
                    TRANSPORT_TYPE: transport,
                    TOPIC: topic,
                    QUEUE_GROUP: queue || "",
                },
                execArgv: ["-r", "ts-node/register"], // Use ts-node for legacy decorators
                stdio: "inherit"
            });

            child.on("message", (msg: any) => {
                if (msg.type === "ready") resolve(child);
            });

            child.on("error", reject);
            workers.push(child);
        });
    };

    const cleanupWorkers = () => {
        workers.forEach(w => w.kill("SIGTERM"));
        workers = [];
    };

    afterAll(() => {
        cleanupWorkers();
    });

    describe("NATS: Load Balancing (Queue Groups)", () => {
        it("should balance 10 messages between 2 workers in a queue group", async () => {
            const topic = "nats.dist.test";
            const queue = "test-group";
            
            // 1. Spawn two workers in the same queue group
            await Promise.all([
                spawnWorker("nats-1", "nats", topic, queue),
                spawnWorker("nats-2", "nats", topic, queue)
            ]);

            await delay(200); // Wait for NATS subscriptions to propagate

            const results: string[] = [];
            workers.forEach(w => {
                w.on("message", (msg: any) => {
                    if (msg.type === "received") results.push(msg.workerId);
                });
            });

            // 2. Emit 10 messages from the test process
            const transport = new NatsTransport({ servers: "nats://localhost:4222" });
            const bus = container.resolve(MessageBus);
            (bus as any).transports = [transport];

            for (let i = 0; i < 10; i++) {
                await bus.emit(topic, { id: i });
            }

            await delay(500); // Wait for all messages to be processed

            // 3. Verify total count and distribution
            expect(results.length).toBe(10);
            const counts = results.reduce((acc, id) => {
                acc[id] = (acc[id] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            console.log("NATS Distribution Counts:", counts);
            
            // Both workers should have received something
            expect(counts["nats-1"]).toBeGreaterThan(0);
            expect(counts["nats-2"]).toBeGreaterThan(0);
            expect(counts["nats-1"] + (counts["nats-2"] || 0)).toBe(10);

            await transport.close();
            cleanupWorkers();
        }, 15000);
    });

    describe("Redis: Fan-out (Pub/Sub)", () => {
        it("should deliver 1 message to ALL workers (standard Pub/Sub)", async () => {
            const topic = "redis.fanout.test";
            
            // 1. Spawn two workers on the same topic
            await Promise.all([
                spawnWorker("redis-1", "redis", topic),
                spawnWorker("redis-2", "redis", topic)
            ]);

            await delay(200);

            const results: string[] = [];
            workers.forEach(w => {
                w.on("message", (msg: any) => {
                    if (msg.type === "received") results.push(msg.workerId);
                });
            });

            // 2. Emit 1 message
            const transport = new RedisTransport({ host: "localhost", port: 6379 });
            const bus = container.resolve(MessageBus);
            (bus as any).transports = [transport];

            await bus.emit(topic, { hello: "redis" });

            await delay(500);

            // 3. Verify both received it
            expect(results.length).toBe(2);
            expect(results).toContain("redis-1");
            expect(results).toContain("redis-2");

            await transport.close();
            cleanupWorkers();
        }, 15000);
    });
});
