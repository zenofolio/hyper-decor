## Decorators  

### Core  
- `@HyperApp` – Defines the application module.  
- `@HyperModule` – Creates a module with controllers.  
- `@HyperController` – Defines a controller within a module.  

### Request Decorators (`@Req`)  
- `@Body(validator?)` – Retrieves and optionally validates the request body.  
- `@Query(name?: string)` – Extracts query parameters from the request.  
- `@Param(name?: string)` – Extracts route parameters from the request.  

### Response Decorators  
- `@Res` – Handles the response object.  

### Middleware & Access Control  
- `@Middleware` – Attaches middleware to a route or controller.  
- `@Role(["ADMIN", "SUPERVISOR"])` – Ensures the request is valid for users with any of the specified roles.  
- `@Scope` – Defines permissions for specific actions.  

### Route Methods (`@Routes`)  
- `@Get` – Handles GET requests.  
- `@Post` – Handles POST requests.  
- `@Put` – Handles PUT requests.  
- `@Delete` – Handles DELETE requests.  
- `@Patch` – Handles PATCH requests.  
- `@Options` – Handles OPTIONS requests.  
- `@Head` – Handles HEAD requests.  
- `@Trace` – Handles TRACE requests.  
- `@Any` – Handles any type of HTTP request.  
- `@All` – Handles all HTTP requests.  
- `@Connect` – Handles CONNECT requests.  
- `@WS` – Handles WebSocket requests.  
- `@Upgrade` – Handles HTTP upgrade requests.  

### Custom Parameter Decorators  
Use `createCustomRequestDecorator` if you want to create custom parameter decorators for requests.

#### Example: Zod Schema

```typescript
const Parser = <T extends any>(schema: ZodSchema<T> | ZodEffects<any>) =>
  createCustomRequestDecorator(
    'Parser',
    async (request) => schema.parse(await request.json())
  );

// Use the decorator

const userScheme = z.object({
  name: z.string(),
  email: z.string().email(),
});

type UserScheme = z.infer<typeof userScheme>;

@HyperController()
class ParserController {
  @Post()
  async create(
    @Parser(userScheme) user: UserScheme,
    @Res response: Response
  ) {
    response.json(user);
  }
}
```