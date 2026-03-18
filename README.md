# @zenofolio/hyper-decor

Librería de decoradores para [HyperExpress](https://github.com/kartikk221/hyper-express).

Este paquete proporciona una capa de abstracción basada en decoradores para facilitar el desarrollo de APIs con HyperExpress, enfocándose en la composición de resolutores para el manejo de parámetros y validación.

---

## Características

- **Arquitectura de Composición**: La resolución de parámetros, validación de DTOs y transformaciones se calculan durante la inicialización para minimizar la lógica en el flujo de peticiones.
- **Manejo de Archivos (`@File`)**: Implementación basada en streams para la validación de tamaño y tipo de archivos durante la subida.
- **Decoradores Polimórficos**: Soporte para diferentes tipos de argumentos en decoradores de parámetros.
- **Integración con OpenAPI**: Soporte básico para la generación de esquemas OpenAPI 3.0.

---

## Instalación

```bash
npm install @zenofolio/hyper-decor
```

---

## Uso

### Definición de Aplicación
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

### Decoradores de Parámetros
Los decoradores `@Body`, `@Query`, `@Param` y `@Headers` permiten diferentes formas de uso.

```typescript
@HyperController("/users")
class UserController {
  
  // 1. Validación con DTO
  @Post("/")
  async create(@Body(CreateUserDto) user: CreateUserDto) {
    return user;
  }

  // 2. Extracción por clave y transformación funcional
  @Get("/:id")
  async findOne(@Param("id", v => parseInt(v)) id: number) {
    return { id };
  }

  // 3. Extracción de propiedad anidada con DTO
  @Post("/settings")
  async updateSettings(@Body("settings", SettingsDto) data: SettingsDto) {
    return data;
  }

  // 4. Extractores básicos
  @Get("/")
  async list(@Query() allQuery: any, @Req req: any) {
    return allQuery;
  }
}
```

---

## Subida de Archivos (`@File`)

El decorador `@File` permite manejar la subida de archivos validando el tamaño y tipo (MIME) mediante streams.

```typescript
@Post("/upload")
async upload(
  @File("avatar", {
    maxFileSize: 5 * 1024 * 1024,
    allowedExtensions: ["png", "jpg"],
    allowedMimeTypes: ["image/png", "image/jpeg"]
  }) file: UploadedFile
) {
  return { filename: file.filename, size: file.size };
}
```

---

## OpenAPI y DTOs

Es posible utilizar clases para definir los esquemas de datos que se reflejarán en la documentación OpenAPI generada.

```typescript
class CreateUserDto {
  age: number;
  name: string;
}

@Post("/")
async create(@Body(CreateUserDto) data: CreateUserDto) { ... }
```

---

## Licencia

MIT
