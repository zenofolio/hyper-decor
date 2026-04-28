# @zenofolio/hyper-decor

High-performance decorator library for [HyperExpress](https://github.com/kartikk221/hyper-express).

`hyper-decor` provides a modular, reactive architecture based on metadata for building robust APIs and distributed systems, focusing on efficiency, decoupling, and testability.

---

## 📚 Documentation Index

| Topic | Description | Link |
|-------|-------------|------|
| **Getting Started** | Installation and Full App Example | [Read Guide](./docs/getting-started.md) |
| **Architecture** | Modules, Controllers and Services | [Read Guide](./docs/architecture.md) |
| **NatsMQ (Messaging)** | Contracts, Fluent API and Request-Reply | [Read Guide](./docs/natsmq.md) |
| **Concurrency Control** | Distributed Locking and Crons | [Read Guide](./docs/concurrency.md) |
| **OpenAPI** | Automatic Swagger Spec Generation | [Read Guide](./docs/openapi.md) |

---

## ⚡ Quick Examples

### 1. Simple Messaging (Pub/Sub)
Decouple your logic instantly across services or processes.

```typescript
@HyperService()
class NotificationSvc {
  @OnMessage("user.signup")
  async welcome(user: any) {
    console.log(`Welcome ${user.email}!`);
  }
}

// Emit from any Controller or Service
MessageBus.emit("user.signup", { email: "zeno@example.com" });
```

### 2. Distributed Concurrency (NatsMQ)
Ensure strict execution limits across your entire cluster.

```typescript
@HyperController("/orders")
class OrderProcessor {
  @OnNatsMessage(OrderCreated)
  @MaxAckPendingPerSubject(OrderCreated, 1) // Only 1 worker at a time cluster-wide
  async process(order: any) {
    // Critical section safe from race conditions
    await performHeavyTask(order);
  }
}
```

---

## Key Features

- **Modular Architecture**: Organize your logic into `HyperApp`, `HyperModule`, `HyperController`, and `HyperService`.
- **Reactive Messaging (`@OnMessage`)**: Integrated Pub/Sub system for cross-service and cross-process communication.
- **Contract-First Design**: Eliminate "string magic" by using typed contract objects.
- **Native Idempotency**: Prevent duplicate processing with TTL-based stores (In-Memory or Redis).
- **Distributed Transports**: Native support for **NATS** and **Redis** with lazy loading.
- **Concurrency Control**: Cluster-wide limits via `@MaxAckPendingPerSubject`.
- **OpenAPI Integration**: Automatic generation of OpenAPI 3.0 specifications.
- **Dependency Injection**: Deep dependency resolution powered by `tsyringe`.

---

## Installation

```bash
npm install @zenofolio/hyper-decor
# Optional dependencies for distributed transports
npm install nats ioredis
```

---

## Distributed Messaging (Transports)

`hyper-decor` supports multiple transports out of the box with zero-configuration switching.

*   **Internal**: Ultra-fast, zero-allocation Trie-based router for same-process communication.
*   **NATS**: Supports standard Pub/Sub and **JetStream** (durable streams/consumers).
*   **Redis**: Supports standard Pub/Sub and **Redis Streams**.

```typescript
@HyperApp({
  transports: [
    new NatsTransport({ servers: "nats://localhost:4222", jetstream: true }),
    new RedisTransport({ host: "localhost", port: 6379 })
  ]
})
class Application {}
```

---

## 🚀 NatsMQ: Contract-First Engine

NatsMQ is the recommended engine for high-fidelity messaging. It uses a Fluent API to define strictly typed contracts.

```typescript
// 1. Define your domain
const Orders = defineQueue("orders", { stream: "ORDERS" });

// 2. Define contracts with Zod validation
export const OrderCreated = Orders.define("created", z.object({ id: z.string() }));

// 3. Listen with full type-safety
@OnNatsMessage(OrderCreated)
async handle(order: z.infer<typeof OrderCreated.schema>) {
  // order.id is type-safe
}
```

[Full Messaging Documentation](./docs/natsmq.md)

---

## Lifecycle Hooks

Manage your application initialization with granular control.

- **`onInit()`**: Runs when a service/module is resolved.
- **`onPrepare()`**: Runs after the entire tree is ready, before server start.

```typescript
@HyperService()
class DbService implements OnInit {
  async onInit() {
    await this.connect();
  }
}
```

---

## Testing with `HyperTest`

A NestJS-inspired utility to facilitate isolated unit and integration testing.

```typescript
const module = await HyperTest.createTestingModule({ imports: [AppModule] })
  .overrideProvider(DatabaseService).useValue(mockDb)
  .compile();

const service = module.get(MyService);
```

---

## License

MIT
