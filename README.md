# @zenofolio/hyper-decor

Librería de decoradores de alto rendimiento para [HyperExpress](https://github.com/kartikk221/hyper-express).

`hyper-decor` proporciona una arquitectura modular y reactiva basada en metadatos para construir APIs y sistemas distribuidos robustos, enfocándose en la eficiencia, el desacoplamiento y la facilidad de prueba.

---

## Características Principales

- **Arquitectura Modular**: Divide tu lógica en `HyperApp`, `HyperModule`, `HyperController` y `HyperService`.
- **Mensajería Reactiva (`@OnMessage`)**: Sistema integrado de Pub/Sub para comunicación entre servicios y procesos.
- **Transportes Distribuidos**: Soporte nativo para **NATS** y **Redis** con carga diferida (*lazy loading*).
- **Ruteo Inteligente**: Capacidad de emitir mensajes a múltiples transportes simultáneamente (Broadcast/Bridge) o dirigir la comunicación a un transporte específico.
- **Ciclo de Vida Extensible**: Hooks de inicialización (`onBeforeInit`, `onAfterInit`) para el control total del árbol de la aplicación.
- **Integración con OpenAPI**: Generación automática de especificaciones OpenAPI 3.0 basada en clases y decoradores.
- **Inyección de Dependencias**: Resolución profunda de dependencias mediante `tsyringe`.
- **Manejo de Archivos Stream-based**: Validación y procesamiento de subidas mediante streams para máxima eficiencia.

---

## Instalación

```bash
npm install @zenofolio/hyper-decor
# Dependencias opcionales para transportes distribuidos
npm install nats ioredis
```

---

## Mensajería Distribuida

`hyper-decor` facilita la creación de sistemas distribuidos o arquitecturas basadas en eventos sin configuración compleja.

### Escuchar Mensajes
Utiliza el decorador `@OnMessage` en cualquier `HyperService`.

```typescript
@HyperService()
class NotificationService {
  @OnMessage("user.registered")
  async onUserRegistered(data: UserData) {
    console.log(`Notificando a: ${data.email}`);
  }
}
```

### Configurar Transportes
Puedes registrar múltiples transportes en tu `HyperApp`.

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

### Emisión y Ruteo
El `MessageBus` permite enviar mensajes a través de todos los transportes o de uno específico.

```typescript
import { MessageBus } from "@zenofolio/hyper-decor";

// Envía a NATS, Redis e Interno simultáneamente (Broadcast)
await MessageBus.emit("user.registered", { id: 1, email: "test@test.com" });

// Envía solo por NATS (Direccionamiento específico)
await MessageBus.emit("user.registered", data, { transport: 'nats' });
```

---

## Hooks de Ciclo de Vida

Los servicios y módulos pueden reaccionar a diferentes estados de la inicialización de la aplicación.

```typescript
@HyperService()
class CacheService {
  async onBeforeInit() {
    // Se ejecuta antes de que las rutas se registren
    console.log("Conectando a base de datos...");
  }

  async onAfterInit() {
    // Se ejecuta cuando todo el árbol (incluyendo módulos hijos) está listo
    console.log("Sistema cache sincronizado.");
  }
}
```

---

## Testing con `HyperTest`

Utilidad inspirada en NestJS para facilitar pruebas unitarias y de integración de forma aislada.

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

## Subida de Archivos (`@File`)

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

## Licencia

MIT
