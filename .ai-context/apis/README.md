# APIs Documentation

This folder contains OpenAPI/Swagger specifications and API contracts for hyper-decor.

## Contents

### OpenAPI Specifications
- **hyper-decor-api.yaml** - Main API specification for library endpoints
- **examples/** - Example API specifications using hyper-decor
- **schemas/** - Reusable OpenAPI schema definitions

### API Contracts
- **rest-api.md** - REST API design guidelines and conventions
- **error-responses.md** - Standard error response formats
- **authentication.md** - Authentication and authorization patterns

## OpenAPI Integration

hyper-decor provides automatic OpenAPI specification generation through decorators:

```typescript
@HyperController('/users')
@ApiTag('Users')
export class UserController {
  
  @Get('/')
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'List of users', type: [User] })
  async findAll(): Promise<User[]> {
    // Implementation
  }
  
  @Post('/')
  @ApiOperation({ summary: 'Create a new user' })
  @ApiRequestBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, description: 'User created', type: User })
  async create(@Body() userData: CreateUserDto): Promise<User> {
    // Implementation
  }
}
```

## Usage Guidelines

1. **API Versioning**: Use path prefixes for API versions (`/v1`, `/v2`)
2. **Resource Naming**: Use plural nouns for resources (`/users`, `/posts`)
3. **HTTP Methods**: Follow REST conventions for CRUD operations
4. **Status Codes**: Use appropriate HTTP status codes
5. **Error Handling**: Consistent error response format
6. **Documentation**: Comprehensive OpenAPI annotations

## Example API Structure

```yaml
openapi: 3.0.0
info:
  title: hyper-decor Example API
  version: 1.0.0
  description: Example REST API built with hyper-decor

paths:
  /users:
    get:
      summary: Get all users
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/User'
    
    post:
      summary: Create a new user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserDto'
      responses:
        '201':
          description: User created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
          format: int64
        name:
          type: string
        email:
          type: string
          format: email
        createdAt:
          type: string
          format: date-time
    
    CreateUserDto:
      type: object
      required:
        - name
        - email
      properties:
        name:
          type: string
        email:
          type: string
          format: email
```