# @zenofolio/hyper-decor

High-performance decorator library for [HyperExpress](https://github.com/kartikk221/hyper-express).

`hyper-decor` provides a modular, reactive architecture based on metadata for building robust APIs and distributed systems, focusing on efficiency, decoupling, and testability.

---

## Key Features

- **Modular Architecture**: Organize your logic into `HyperApp`, `HyperModule`, `HyperController`, and `HyperService`.
- **Reactive Messaging (`@OnMessage`)**: Integrated Pub/Sub system for cross-service and cross-process communication.
- **Distributed Transports**: Native support for **NATS** and **Redis** with lazy loading.
- **Smart Routing**: Capability to emit messages to multiple transports simultaneously (Broadcast/Bridge) or target a specific transport.
- **Extensible Lifecycle**: Initialization hooks (`onBeforeInit`, `onAfterInit`) for full control over the application tree.
- **OpenAPI Integration**: Automatic generation of OpenAPI 3.0 specifications based on classes and decorators.
- **Dependency Injection**: Deep dependency resolution powered by `tsyringe`.
- **Stream-based File Handling**: Efficient file upload validation and processing using streams.
- **Observability & Logging**: Standardized `ILogger` interface for monitoring connections, message flow, and errors.

---

## Installation

```bash
npm install @zenofolio/hyper-decor
# Optional dependencies for distributed transports
npm install nats ioredis
```

---

## Distributed Messaging

`hyper-decor` makes it easy to create distributed systems or event-driven architectures without complex configuration.

### Listening to Messages
Use the `@OnMessage` decorator on any `HyperService`. You can also inject transport-specific configurations using dedicated decorators.

```typescript
@HyperService()
class NotificationService {
  // Standard subscription
  @OnMessage("user.registered")
  async onUserRegistered(data: UserData) {
    console.log(`Notifying: ${data.email}`);
  }

  // Load-balanced NATS Queue Group
  @OnMessage("orders.*")
  @OnNatsOptions({ queue: "workers" })
  async processOrder(order: any) {
    // Only one worker in the "workers" group will receive this message
  }

  // Redis Stream with Consumer Group
  @OnMessage("analytics.hit")
  @OnRedisOptions({ stream: { group: "analytics-group", consumer: "worker-1" } })
  async trackHit(hit: any) {
    // Durable streaming with acknowledgements
  }
}
```

### Configuring Transports
`hyper-decor` supports multiple transports out of the box.

*   **NATS**: Supports standard Pub/Sub and **JetStream** (durable streams/consumers).
*   **Redis**: Supports standard Pub/Sub and **Redis Streams** (with consumer groups).
*   **Internal**: Ultra-fast, zero-allocation Trie-based router for same-process communication.

```typescript
import { HyperApp, NatsTransport, RedisTransport } from "@zenofolio/hyper-decor";

@HyperApp({
  modules: [UserModule],
  transports: [
    new NatsTransport({ 
      servers: "nats://localhost:4222",
      jetstream: true // Enable JetStream features
    }),
    new RedisTransport({ host: "localhost", port: 6379 })
  ]
})
class Application {}
```

### Emission and Routing
The `MessageBus` allows sending messages through all transports or a specific one.

```typescript
import { MessageBus } from "@zenofolio/hyper-decor";

// Sends to all registered transports (Broadcast/Bridge)
await MessageBus.emit("user.registered", { id: 1, email: "test@test.com" });

// Targeted routing
await MessageBus.emit("order.created", data, { transport: 'nats' });
await MessageBus.emit("urgent.alert", data, { transport: 'redis' });
```

---

## Observability & Logging

`hyper-decor` includes a flexible logging system to monitor the behavior of your transports and messaging system.

### Standard Logger Interface

The library uses a standard `ILogger` interface. By default, it uses an internal logger that outputs to the console with clear prefixes like `[HYPER-INFO]`, `[HYPER-DEBUG]`.

```typescript
export interface ILogger {
  info(message: string, ...context: any[]): void;
  warn(message: string, ...context: any[]): void;
  error(message: string, ...context: any[]): void;
  debug(message: string, ...context: any[]): void;
}
```

### Customizing the Logger

You can provide a custom logger instance to any transport constructor:

```typescript
const myLogger = {
  info: (msg) => console.log(`MyLog: ${msg}`),
  error: (msg, err) => console.error(`Error: ${msg}`, err),
  // ... rest of the methods
};

const nats = new NatsTransport({ servers: "nats://localhost:4222" }, myLogger);
```

Or register a global logger in the `tsyringe` container using the `LOGGER_TOKEN`:

```typescript
import { container } from "tsyringe";
import { LOGGER_TOKEN } from "@zenofolio/hyper-decor";

container.register(LOGGER_TOKEN, { useValue: myLogger });
```

### Log Levels
- **INFO**: Connection established, subscriptions activated.
- **DEBUG**: Message received/emitted (includes topic name).
- **ERROR**: Handling errors, connection failures, parsing errors.

---

## Lifecycle Hooks

Services and modules can react to different stages of application initialization.

```typescript
@HyperService()
class CacheService {
  async onBeforeInit() {
    // Runs before routes are registered
    console.log("Connecting to database...");
  }

  async onAfterInit() {
    // Runs when the entire tree (including child modules) is ready
    console.log("Cache system synchronized.");
  }
}
```

---

## Testing with `HyperTest`

A NestJS-inspired utility to facilitate isolated unit and integration testing.

```typescript
import { HyperTest } from "@zenofolio/hyper-decor";

const module = await HyperTest.createTestingModule({
    imports: [AppModule]
})
.overrideProvider(DatabaseService).useValue(mockDb)
.compile();

const service = module.get(MyService);
```

---

## File Upload (`@File`)

```typescript
@Post("/upload")
async upload(
  @File("avatar", {
    maxFileSize: 5 * 1024 * 1024,
    allowedExtensions: ["png", "jpg"]
  }) file: UploadedFile
) {
  return { filename: file.filename };
}
```

---

## License

MIT
