# 🚀 Hyper-Decor Monorepo - Development Rules

This file defines **architectural principles**, **coding conventions**, and **contribution guidelines** for the hyper-decor monorepo.

## 🚨 CRITICAL AGENT RULES

### AI Agent Requirements - MONOREPO CONTEXT
1. **UNDERSTAND MONOREPO STRUCTURE** - This is now a 3-package monorepo:
   - `packages/core/` - Decoradores, DI, excepciones, utilidades
   - `packages/routing/` - Sistema O(1) routing con uWebSockets.js  
   - `packages/hyper-decor/` - API principal combinada
2. **READ PACKAGE-SPECIFIC .ai-context** - Each package has its own context
3. **NO CROSS-PACKAGE IMPORTS** - Core and routing are independent
4. **PRESERVE O(1) ROUTING PERFORMANCE** - Target: >500k req/sec
5. **FOLLOW SEMANTIC VERSIONING** - Independent versioning per package
6. **UPDATE MULTIPLE READMES** - Root + package-specific documentation

### Monorepo Contribution Workflow
1. **Identify target package** - Which package needs the changes?
2. **Read package .ai-context** - Each has specific rules and patterns
3. **Use workspace commands** - `npm run build --workspace=package-name`
4. **Test in isolation** - Each package must pass its own tests
5. **Update documentation** - Both package and root level docs
6. **Benchmark performance** - Especially for routing changes

## TypeScript Standards
- **Strict Mode**: Always enable TypeScript `strict` mode
- **Type Safety**: Avoid `any` type except at API boundaries or legacy integrations
- **Imports**: Use absolute imports from `src/` when possible
- **Exports**: Use named exports, avoid default exports for better tree-shaking

## Decorator Patterns
- **Naming**: All decorators must use PascalCase (e.g., `@HyperController`, `@Get`, `@Post`)
- **Metadata**: Use Reflect.defineMetadata for storing decorator information  
- **Inheritance**: Decorators should work with class inheritance
- **Composition**: Support decorator stacking (multiple decorators on same element)
- **Creator Pattern**: Use existing creators from `src/__internals/creators/` 
- **Parameter Decorators**: Follow pattern from `src/decorators/Http.ts`
- **Performance**: Cache metadata to avoid repeated reflection calls

## Architecture Rules
- **Single Responsibility**: Each decorator has one clear purpose
- **Modularity**: Controllers, Services, and Modules should be composable
- **Dependency Injection**: Support constructor-based DI where applicable
- **Middleware Support**: All route decorators must support middleware chains

## File Structure
- **Controllers**: Place in `src/decorators/` with descriptive names
- **Types**: Define interfaces in `src/decorators/types/`
- **Tests**: Mirror source structure in `tests/`
- **Examples**: Provide usage examples in `examples/`

## Error Handling
- **Custom Errors**: Extend base `HyperException` class
- **Error Codes**: Include meaningful error codes and messages
- **Validation**: Provide clear parameter validation errors
- **Stack Traces**: Preserve original stack traces in error chains

## Function Guidelines
- **Pure Functions**: Prefer pure functions for utilities
- **Small Functions**: Keep functions focused and under 50 lines
- **Documentation**: Document complex decorator logic with JSDoc
- **Async/Await**: Use async/await over Promises for better readability

## Testing Requirements
- **Unit Tests**: Test each decorator independently
- **Integration Tests**: Test decorator combinations and HyperExpress integration
- **E2E Tests**: Test complete API scenarios with real HTTP requests
- **Coverage**: Maintain >80% test coverage for core decorators
- **DI Testing**: Always register dependencies with tsyringe container in tests
- **Reflect Metadata**: Import "reflect-metadata" at top of test files
- **Skip Complex Tests**: Use test.skip() for problematic DI tests until fixed

## Commit Standards
- **Conventional Commits**: Use format `type(scope): description`
  - `feat`: New decorators or features
  - `fix`: Bug fixes in existing decorators
  - `docs`: Documentation updates
  - `test`: Adding or updating tests
  - `refactor`: Code refactoring without functionality changes
  - `perf`: Performance improvements
  - `chore`: Build process or auxiliary tool changes

## Performance Rules
- **Metadata Caching**: Cache reflected metadata to avoid repeated reflection
- **Lazy Loading**: Defer heavy operations until actually needed
- **Memory Management**: Clean up event listeners and subscriptions
- **Bundle Size**: Keep library footprint minimal for better adoption

## HyperExpress Integration
- **Server Compatibility**: Ensure decorators work with HyperExpress Server class
- **Request/Response**: Properly handle HyperExpress Request/Response objects
- **Routing**: Integrate with HyperExpress routing system seamlessly
- **Middleware**: Support both HyperExpress and custom middleware patterns

## Build & Dependencies Rules
- **NO Circular Dependencies**: Never add "@zenofolio/hyper-decor": "file:" to package.json
- **TypeScript Strict**: Always maintain strict mode in tsconfig.json
- **Bundle Size**: Keep dist/ under 1MB for optimal performance
- **Clean Builds**: Always run clean before build in prebuild script
- **Peer Dependencies**: HyperExpress should remain as peerDependency only
- **Dev Dependencies**: Testing and build tools only in devDependencies

## Performance & Memory Rules  
- **Metadata Caching**: Cache reflected metadata to avoid repeated calls
- **Memory Leaks**: Clean up event listeners and subscriptions properly
- **Bundle Optimization**: Use tree-shaking friendly exports
- **Runtime Overhead**: Minimize decorator execution time
- **Lazy Loading**: Defer heavy operations until actually needed