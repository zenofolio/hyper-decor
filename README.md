# @zenofolio/hyper-decor

High-performance decorator library for [HyperExpress](https://github.com/kartikk221/hyper-express).

`hyper-decor` provides a modular, reactive architecture based on metadata for building robust APIs and distributed systems, focusing on efficiency, decoupling, and testability.

---

## 📚 Documentation Index

| Topic | Description | Link |
|-------|-------------|------|
| **Getting Started** | Installation and Full App Example | [Read Guide](./docs/getting-started.md) |
| **Architecture** | Modules, Controllers and Services | [Read Guide](./docs/architecture.md) |
| **NatsMQ (Messaging)** | Contracts, Fluent API and High Performance | [Read Guide](./docs/natsmq.md) |
| **Concurrency Control** | Distributed Locking and Crons | [Read Guide](./docs/concurrency.md) |
| **OpenAPI** | Automatic Swagger Spec Generation | [Read Guide](./docs/openapi.md) |

---

## ⚡ Quick Examples

### 1. High-Throughput Messaging (NatsMQ)
Decouple your logic instantly with type-safe contracts and cluster-wide performance.

```typescript
// 1. Define a contract
const Orders = defineQueue("orders");
const OrderCreated = Orders.define("created", z.object({ id: z.string() }));

// 2. Subscribe with automatic wiring
@HyperService()
class NotificationSvc {
  @OnNatsMessage(OrderCreated)
  async welcome(order: { id: string }) {
    console.log(`Order ${order.id} received!`);
  }
}

// 3. Register and get the instance
const [svc] = await NatsMQService.getInstance().register(NotificationSvc);
```

### 2. Distributed Concurrency Control
Ensure strict execution limits across your entire cluster at **30,000+ msg/sec**.

```typescript
@HyperController("/orders")
class OrderProcessor {
  @OnNatsMessage(OrderCreated)
  @MaxAckPendingPerSubject(OrderCreated, 1) // Only 1 worker at a time cluster-wide
  async process(order: any) {
    // Critical section safe from race conditions across ALL nodes
    await performHeavyTask(order);
  }
}
```

---

## Key Features

- **Extreme Performance**: Optimized for high-fidelity messaging, reaching **30,000+ msg/sec** with NATS JetStream.
- **Modular Architecture**: Organize your logic into `HyperApp`, `HyperModule`, `HyperController`, and `HyperService`.
- **Contract-First Design**: Eliminate "string magic" by using strictly typed Zod contract objects.
- **Distributed Transports**: Native support for **NATS (JetStream)** and **Redis (Streams)**.
- **Cluster-Wide Concurrency**: Global limits via `@MaxAckPendingPerSubject` with Redis backends.
- **Distributed Cron**: Ensure cron tasks run exactly once per cluster using temporal bucketing.
- **Dependency Injection**: Deep dependency resolution powered by `tsyringe`.
- **OpenAPI Integration**: Automatic generation of Swagger specifications from decorators.

---

## Installation

```bash
npm install @zenofolio/hyper-decor
# Optional dependencies for distributed transports
npm install nats ioredis
```

---

## 🚀 NatsMQ: The Messaging Engine

NatsMQ is the recommended engine for high-fidelity messaging. It uses a Fluent API to define strictly typed contracts and manages consumer life-cycles automatically.

```typescript
const service = NatsMQService.getInstance();
service.configure({ servers: "nats://localhost:4222" });

// Programmatic subscription (optional)
await service.mq.engine.createPullConsumer(OrderCreated.getNatsConfig(), [], async (data, msg) => {
  console.log("Manual processing");
  await msg.ack();
});
```

[Full Messaging Documentation](./docs/natsmq.md)

---

## License

MIT
