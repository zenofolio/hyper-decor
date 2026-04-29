# @zenofolio/hyper-decor

High-performance decorator library for [HyperExpress](https://github.com/kartikk221/hyper-express).

`hyper-decor` provides a modular, reactive architecture based on metadata for building robust APIs and distributed systems, focusing on efficiency, decoupling, and testability.

---

## 📚 Documentation Index

| Topic | Description | Link |
|-------|-------------|------|
| **Getting Started** | Installation and Full App Example | [Read Guide](./docs/getting-started.md) |
| **Architecture** | Modules, Controllers and Services | [Read Guide](./docs/architecture.md) |
| **NatsMQ (Messaging)** | Contracts, Dynamic Sharding and High Performance | [Read Guide](./docs/natsmq.md) |
| **Concurrency Control** | Distributed Locking and Cluster-Wide Limits | [Read Guide](./docs/concurrency.md) |
| **OpenAPI** | Automatic Swagger Spec Generation | [Read Guide](./docs/openapi.md) |

---

## ⚡ Quick Start

### 1. Web API Architecture
Organize your HyperExpress application into clean, injectable components.

```typescript
@HyperController("/users")
class UserController {
  @Get("/:id")
  async getUser(req: Request, res: Response) {
    return res.json({ id: req.params.id, name: "Zeno" });
  }
}

@HyperModule({
  controllers: [UserController]
})
class MainModule {}

const app = new HyperApp({ 
  port: 3000, 
  modules: [MainModule] 
});
await app.listen();
```

### 2. High-Fidelity Messaging (NatsMQ)
Decouple your services with type-safe contracts and cluster-wide performance (**30,000+ msg/sec**).

```typescript
// Define a type-safe contract
const Tasks = defineQueue("jobs");
const ProcessTask = Tasks.define("process", z.object({ id: z.number() }));

@NatsMQWorker(Tasks)
class WorkerSvc {
  @OnNatsMessage(ProcessTask)
  @MaxAckPendingPerSubject("jobs.process", 10) // Cluster-wide concurrency limit
  async handle(data: { id: number }) {
    console.log(`Processing task ${data.id}`);
  }
}
```

### 3. Dynamic Subject Sharding
Scale your concurrency per resource (e.g., per user) using dynamic lock keys.

```typescript
// Contract with named parameters
const UserTasks = Tasks.define("user.:id", TaskSchema);

@NatsMQWorker(Tasks)
class ShardedWorker {
  @OnNatsMessage(UserTasks)
  // Engine resolves :id from the message subject for granular locking
  @MaxAckPendingPerSubject("jobs.user.:id", 1) 
  async handle(data: any) {
    // Only 1 concurrent task per USER across the whole cluster
  }
}

// Publish to a specific shard
await engine.publish(UserTasks.fill({ id: "123" }), data);
```

---

## 💎 Key Features

- **🚀 Extreme Throughput**: Optimized for high-fidelity messaging, reaching **30,000+ msg/sec** with NATS JetStream.
- **🧩 Modular DI**: Full dependency injection powered by `tsyringe` across Modules, Controllers, and Services.
- **📜 Contract-First Messaging**: Eliminate "string-based" events. Use Zod-powered contracts for total type safety.
- **⚖️ Distributed Concurrency**: Enforce global execution limits via Redis backends with local retry/jitter to avoid NAK storms.
- **⏰ Distributed Cron**: Ensure cron tasks run exactly once per cluster using temporal bucketing and TTL locks.
- **📊 Real-time Metrics**: Built-in support for Redis-backed metrics for monitoring throughput and latency.
- **🛡️ OpenAPI / Swagger**: Automatic generation of Swagger specifications directly from your decorators.

---

## Installation

```bash
npm install @zenofolio/hyper-decor
# Optional dependencies for distributed features
npm install nats ioredis
```

---

## License

MIT
