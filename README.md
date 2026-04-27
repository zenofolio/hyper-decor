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
import { MessageBus, Transport } from "@zenofolio/hyper-decor";

// Sends to all registered transports (Broadcast/Bridge)
await MessageBus.emit("user.registered", { id: 1, email: "test@test.com" });

// Targeted routing (using the enum or string)
await MessageBus.emit("order.created", data, { transport: Transport.NATS });
await MessageBus.emit("urgent.alert", data, { transport: Transport.REDIS });
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

`hyper-decor` provides several hooks to manage initialization and preparation.

### 1. `onInit()` (Services & Modules)
The primary hook for any `@injectable`, `@HyperService`, or `@HyperModule`. It runs once during the deep-resolution process.

```typescript
@HyperService()
class CacheService implements OnInit {
  async onInit() {
    // Runs when the service is resolved and ready
    console.log("Connecting to database...");
  }
}
```

### 2. `onPrepare()` (Application)
Supported only on the `@HyperApp` class. It runs after the entire application tree has been prepared and routes are registered, but before the server starts listening (if handled manually).

```typescript
@HyperApp({ ... })
class MainApp {
  async onPrepare() {
    console.log("Server is ready to receive traffic.");
  }
}
```

### 3. Global Hooks (`IHyperHooks`)
You can provide global hooks in the `@HyperApp` configuration to intercept every component's initialization.

---

## Dual Transport Strategy (Local vs Distributed)

For performance-critical systems, you can combine the ultra-fast **Internal** transport with distributed ones like **NATS**.

### 1. Registration
```typescript
import { HyperApp, Transport, InternalTransport, NatsTransport } from "@zenofolio/hyper-decor";

@HyperApp({
  transports: [
    InternalTransport, // Ultra-fast (microsecond latency)
    new NatsTransport({ servers: "nats://..." }) // Global scale
  ]
})
class Application {}
```

### 2. Targeted Emission
Use `emitLocal` for same-process events or the `Transport` enum for specific targets.

```typescript
import { MessageBus, Transport } from "@zenofolio/hyper-decor";

// 🚀 Maximum performance (stays in memory)
await MessageBus.emitLocal("cache.invalidate", { id: 1 });

// 🌐 Distributed event
await MessageBus.emit("user.created", data, { transport: Transport.NATS });
```

### 3. Targeted Subscription
Use `@OnInternal` to ensure a listener only reacts to local events, avoiding network overhead or double-delivery.

```typescript
@HyperService()
class SpeedService {
  @OnInternal("critical.task")
  async handleQuickly(data: any) {
    // Runs only via InternalTransport
  }

  @OnTransport(Transport.NATS, "global.event")
  async handleGlobal(data: any) {
    // Runs only via NATS
  }
}
```

---

## Message Envelope (Tracing & Idempotency)

Every message in `hyper-decor` is automatically wrapped in a standardized envelope. This provides built-in support for tracing and reliable delivery without complex configuration.

### The Envelope Structure
```typescript
interface IMessageEnvelope<T> {
  i: string;  // Unique Message ID (UUID)
  t: number;  // Creation Timestamp
  c?: string; // Correlation ID (for cross-service tracing)
  m: T;       // The actual payload
}
```

### Transparent Usage
By default, your handlers receive only the payload, making it compatible with any external message source.

```typescript
@OnMessage("user.signup")
async handle(data: UserDto) {
  // 'data' is the unwrapped payload
}
```

### Accessing Metadata
If you need to access the ID or Timestamp (e.g., for logging or preventing duplicate processing), simply add a second argument:

```typescript
@OnMessage("critical.payment")
async handle(data: PaymentDto, envelope: IMessageEnvelope<PaymentDto>) {
  console.log(`Processing message ${envelope.i} created at ${envelope.t}`);
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
