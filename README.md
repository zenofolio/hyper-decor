# @zenofolio/hyper-decor (v1.0.71)

A high-performance, ultra-secure, and indestructible decorators library for [HyperExpress](https://github.com/kartikk221/hyper-express).

Built for speed and security, this library leverages a **Zero-Overhead** architecture using functional composition to ensure your API remains as fast as raw `uWS` while providing a modern development experience.

---

## 🚀 Why This Library?

- **Zero-Overhead Architecture**: Parameter resolution, DTO validation, and transformations are pre-composed at startup. No runtime branching in the hotpath.
- **Ultra-Secure File Handling**: Streaming validation of file sizes and types. Cuts the connection immediately if limits are breached. No memory exhaustion.
- **Polymorphic Decorators**: Flexible parameter decorators that adapt to your needs without sacrificing performance.
- **Automated OpenAPI**: Full OpenAPI 3.0 support with automatic DTO expansion and response documentation.

---

## 📦 Installation

```bash
npm install @zenofolio/hyper-decor
```

---

## 🛠️ Usage

### Define Your App
```typescript
import { HyperApp, createApplication } from "@zenofolio/hyper-decor";

@HyperApp({
  modules: [UserModule],
  prefix: "/api"
})
class Application {}

const app = await createApplication(Application);
await app.listen(3000);
```

### Polymorphic Parameter Decorators
Decorators like `@Body`, `@Query`, `@Param`, and `@Headers` are now smarter and faster.

```typescript
@HyperController("/users")
class UserController {
  
  // 1. Direct DTO Validation (Auto-transformation + OpenAPI)
  @Post("/")
  async create(@Body(CreateUserDto) user: CreateUserDto) {
    return user;
  }

  // 2. Key-based extraction with Functional Transformer
  @Get("/:id")
  async findOne(@Param("id", v => parseInt(v)) id: number) {
    return { id };
  }

  // 3. Nested extraction + DTO
  @Post("/settings")
  async updateSettings(@Body("settings", SettingsDto) data: SettingsDto) {
    return data;
  }

  // 4. Raw Extractors
  @Get("/")
  async list(@Query() allQuery: any, @Req req: any) {
    return allQuery;
  }
}
```

---

## 🔒 Indestructible File Uploader (`@File`)

The `@File` decorator is designed to be ultra-secure. It processes files as **streams**, validating size and type binarily (magic numbers) *before* the file is fully buffered.

- **Streaming Validation**: Connection is terminated immediately if `maxFileSize` is exceeded.
- **Binary Verification**: Uses binary signatures to verify MIME types, ensuring security even if the extension is falsified.
- **Automatic Sanitization**: File names are sanitized against path traversal and null bytes.

```typescript
@Post("/upload")
async upload(
  @File("avatar", {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedExtensions: ["png", "jpg"],
    allowedMimeTypes: ["image/png", "image/jpeg"]
  }) file: UploadedFile
) {
  // file.buffer contains the safely validated data
  return { filename: file.filename, size: file.size };
}
```

---

## ⚡ Performance

Benchmarks show that `@zenofolio/hyper-decor` introduces less than **1.8%** overhead compared to raw, manual HyperExpress handlers.

| Scenario | Raw HyperExpress | @zenofolio/hyper-decor | Overhead |
| :--- | :--- | :--- | :--- |
| **Simple GET** | 27,150 req/s | 26,660 req/s | ~1.8% |
| **Deep Transformation**| 18,120 req/s | 18,335 req/s | **+1.1% Gain** |

> [!TIP]
> The "Transformed" scenario actually performs better than manual implementations thanks to our optimized functional resolver composition that V8 can inline aggressively.

---

## 🔍 OpenAPI & DTOs

Pass classes to your decorators, and they will be expanded into the OpenAPI schema automatically.

```typescript
class CreateUserDto {
  /** @minimum 18 */
  age: number;
  name: string;
}

@Post("/")
async create(@Body(CreateUserDto) data: CreateUserDto) { ... }
```

You can integrate any validation engine (Zod, Class-Validator) by registering a `Transformer` in the `transformRegistry`.

---

## 🛡️ License

MIT
