# OpenAPI (Swagger) Integration

`hyper-decor` can automatically generate OpenAPI 3.0 specifications based on your Controllers and Decorators.

## 1. Automatic Extraction

The `OpenApi` utility can traverse your application tree and extract all metadata.

```typescript
import { OpenApi } from "@zenofolio/hyper-decor";

// Extract the complete spec
const spec = OpenApi.extract(MainApp);

console.log(JSON.stringify(spec, null, 2));
```

## 2. Adding Metadata to Routes

Use the `@OpenApi` decorator to add descriptions, responses, and parameters to your routes.

```typescript
@HyperController("/users")
class UserController {
  @Get("/:id")
  @OpenApi({
    summary: "Get user by ID",
    description: "Returns a single user object",
    responses: {
      200: { description: "User found" },
      404: { description: "User not found" }
    }
  })
  async getUser(@Param("id") id: string) {
    // ...
  }
}
```

## 3. Schema Integration (Zod)

If you use Zod for validation in your `@Body` or `@Param` decorators, `hyper-decor` can attempt to map those schemas to OpenAPI components automatically.

## 4. Serving the Spec

You can easily create an endpoint in HyperExpress to serve the generated JSON.

```typescript
@Get("/openapi.json")
async getSpec() {
  return OpenApi.extract(MainApp);
}
```
