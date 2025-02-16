# Hyper Express Decorators  
A simple decorators library for Hyper Express  

### Why use this?  
This is a personal project designed to make it easier for me to create fast APIs. Maybe it can be helpful for someone else too.  
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
```## Add Role | Scope to Request

This package extends the `hyper-express/Request` class by adding methods that help manage roles and scopes for requests.

### Summary of Available Methods
- `req.setRole(role)` – Assigns a role to the request.
- `req.hasRole(role)` – Checks if the request has the specified role.
- `req.setScopes(scopes)` – Assigns scopes to the request.
- `req.hasScopes(scopes)` – Checks if the request has the specified scopes.
- `req.setRoleScopes(role, scopes)` – Sets both the role and the scopes in one method.


### examples

```typescript

@Middleware((req, res, next) => {
    
    // Assigning a role to the request
    req.setRole("ADMIN");

    // Assigning scopes to the request
    req.setScopes(["read", "write"]);

    // set role and scopes
    // req.setRoleScopes("ADMIN", ["read", "write"]);


    // Check if the request has the "ADMIN" role
    // if (req.hasRole("ADMIN")) {
    //     res.send("Role: ADMIN is assigned");
    // }

    // Check if the request has the "write" scope
    // if (req.hasScopes(["write"])) {
    //     res.send("Scope: write is granted");
    // }

    next();
})
@HyperModule({
    path: 'users'
})
class UserModule {}

```

## Usage/Decorators examples

`@HyperController` - Simple versioned controller
```typescript
@HyperController("v1")
class TestController extends CRUD<string> {

  @Get("/list")
  async index(@Query() query: any, @Res() res: Response) {
    res.send("hello");
  }

}
```

`@HyperModule` - define module with controllers 
```typescript
@HyperModule({
    path: "users",
    controllers: [HyperController]
})
class UserV1Module {}
```



`@HyperApp` - define application
```typescript
@HyperApp({
  name: "Hyper Express Decorators",
  version: "1.0.0",
  description: "Decorators to make development easier",
  modules: [UserV1Module],
  prefix: "/api",
})
export class Application implements IHyperApplication {
  onPrepare() {
    console.log("This method will be called after the app is prepared");
  }
}
```

## Run Application
```typescript
const app = await createApplication(Application)
await app.listen(3000);

```

As a result, we get:

- `/api/users/v1/list`


# All for now
More documentation will be added here late.
## Inspirate

 - [NestJS](https://github.com/nestjs/nest)
 - [Hyper Express](https://github.com/kartikk221/hyper-express)

