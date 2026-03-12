# hyper-decor Architecture

## Overview

hyper-decor is a production-ready TypeScript library that provides NestJS-style decorators for building high-performance REST APIs with HyperExpress. It combines familiar developer experience with blazing-fast performance (45k+ req/sec target).

## Current Status (v1.0.61)
- ✅ **Production Ready**: All core features implemented and tested
- ✅ **Performance Optimized**: <1MB bundle, optimized build pipeline
- ✅ **Type Safe**: Full TypeScript strict mode support
- ✅ **Test Coverage**: 8/8 core tests passing, >80% coverage target
- ⚠️ **DI Tests**: Some complex DI tests skipped (to be fixed)
- 🎯 **Performance**: Targeting 45k+ requests/second

## Core Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                       │
├─────────────────────────────────────────────────────────────┤
│  @HyperApp    @HyperModule    @HyperController             │
│  └── Application  └── Feature    └── Route Handler         │
│      Bootstrap       Grouping        Definition             │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Decorator Layer                          │
├─────────────────────────────────────────────────────────────┤
│  Method Decorators     Parameter Decorators                │
│  @Get @Post @Put      @Body @Param @Query @Res            │
│  @Delete @Patch       @File @FileStream                    │
│                                                             │
│  Cross-cutting Decorators                                  │
│  @Middleware @Role @Scope @RateLimitStore                  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Metadata Layer                           │
├─────────────────────────────────────────────────────────────┤
│  Metadata Storage    Metadata Processing                   │
│  Reflect.metadata    MetadataStore                         │
│  Constants           Transformers                          │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  HyperExpress Layer                        │
├─────────────────────────────────────────────────────────────┤
│  Server Instance     Request/Response                      │
│  Route Registration  Middleware Chain                      │
│  HTTP Methods        Error Handling                        │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Decorator System ✅ Complete
- **Class Decorators**: `@HyperApp`, `@HyperModule`, `@HyperController`, `@HyperService`
- **Method Decorators**: `@Get`, `@Post`, `@Put`, `@Delete`, `@Patch`, `@Options`, `@Head`
- **Parameter Decorators**: `@Body`, `@Param`, `@Query`, `@Req`, `@Res`, `@Headers`, `@File`
- **Cross-cutting Decorators**: `@Middleware`, `@Role`, `@Scope`, `@Pass`
- **Advanced Features**: `@FileStream`, `@RateLimitStore`, WebSocket support (`@WS`)

### 2. Metadata Management
- Uses `Reflect.metadata` for storing decorator information
- Centralized metadata constants and types
- Metadata transformers for processing decorator data
- Metadata stores for runtime access

### 3. HyperExpress Integration
- Seamless integration with HyperExpress server
- Route registration and middleware handling
- Request/response object wrapping
- Error handling and exception management

### 4. Type System
- Comprehensive TypeScript interfaces
- Generic type support for decorators
- Type-safe parameter extraction
- Build-time validation support

## Data Flow

1. **Decoration Phase**: Decorators attach metadata to classes/methods/parameters
2. **Bootstrap Phase**: Application analyzes metadata and configures routes
3. **Runtime Phase**: Incoming requests are routed through decorated handlers
4. **Response Phase**: Responses are formatted and sent through HyperExpress

## Design Principles

### 1. Declarative API Design
- Use decorators to express intent clearly
- Minimize boilerplate code
- Follow familiar NestJS patterns

### 2. Type Safety
- Leverage TypeScript's type system fully
- Provide compile-time error detection
- Support IDE autocompletion and refactoring

### 3. Performance
- Minimize runtime overhead
- Cache metadata for quick access
- Optimize HyperExpress integration

### 4. Extensibility
- Support custom decorators
- Allow middleware composition
- Enable plugin architecture

### 5. Developer Experience
- Clear error messages
- Comprehensive documentation
- Familiar patterns from NestJS ecosystem

## Module System

```typescript
@HyperModule({
  path: '/api',
  controllers: [UserController, PostController],
  services: [UserService, PostService],
  middleware: [AuthMiddleware, LoggingMiddleware]
})
class ApiModule {}

@HyperApp({
  modules: [ApiModule],
  globalMiddleware: [CorsMiddleware],
  prefix: '/v1'
})
class Application extends Server {}
```

## Request Lifecycle

1. **Request Reception**: HyperExpress receives HTTP request
2. **Route Matching**: Find decorated handler based on path and method
3. **Middleware Execution**: Run global and route-specific middleware
4. **Parameter Extraction**: Use parameter decorators to extract data
5. **Handler Execution**: Call the decorated method with extracted parameters
6. **Response Processing**: Format and send response through HyperExpress
7. **Error Handling**: Catch and process any exceptions

## Security Integration

- **Role-based Access Control**: `@Role` decorator for authorization
- **Scope-based Permissions**: `@Scope` decorator for fine-grained access
- **Rate Limiting**: `@RateLimitStore` for API protection
- **Input Validation**: Parameter decorators with validation support

## OpenAPI Integration

- Automatic OpenAPI specification generation
- Decorator-based API documentation
- Request/response schema validation
- Interactive API explorer support