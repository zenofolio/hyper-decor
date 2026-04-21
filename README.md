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
Use the `@OnMessage` decorator on any `HyperService`.

```typescript
@HyperService()
class NotificationService {
  @OnMessage("user.registered")
  async onUserRegistered(data: UserData) {
    console.log(`Notifying: ${data.email}`);
  }
}
```

### Configuring Transports
You can register multiple transports in your `HyperApp`.

```typescript
import { HyperApp, NatsTransport, RedisTransport } from "@zenofolio/hyper-decor";

@HyperApp({
  modules: [UserModule],
  transports: [
    new NatsTransport({ servers: "nats://localhost:4222" }),
    new RedisTransport({ host: "localhost", port: 6379 })
  ]
})
class Application {}
```

### Emission and Routing
The `MessageBus` allows sending messages through all transports or a specific one.

```typescript
import { MessageBus } from "@zenofolio/hyper-decor";

// Sends to NATS, Redis, and Internal simultaneously (Broadcast)
await MessageBus.emit("user.registered", { id: 1, email: "test@test.com" });

// Sends ONLY via NATS (Targeted routing)
await MessageBus.emit("user.registered", data, { transport: 'nats' });
```

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
