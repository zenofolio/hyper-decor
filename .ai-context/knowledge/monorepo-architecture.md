# 🏗️ Hyper-Decor Monorepo - Architecture Knowledge

## 📦 Package Architecture

### Core Package (`@zenofolio/hyper-decor-core`)
**Purpose**: Foundational decorators, dependency injection, and utilities
**Dependencies**: Independent, no internal dependencies
**Key Components**:
- Decorators: `@HyperController`, `@Get`, `@Post`, etc.
- Dependency Injection: Integration with tsyringe
- Exceptions: Custom error handling system
- Stores: Metadata management
- Types: TypeScript interfaces and types

```typescript
// Core API Example
@HyperController('/api/users')
class UserController {
  @Get('/:id')
  async getUser(@Param('id') id: string) {
    return { user: { id } };
  }
}
```

### Routing Package (`@zenofolio/hyper-decor-routing`)
**Purpose**: Ultra-fast routing with O(1) static route access
**Dependencies**: uWebSockets.js (optional), independent from core
**Key Components**:
- OptimizedRouteMatcher: O(1) Map + Trie hybrid system
- uWebSockets.js Integration: Direct C++ performance
- Middleware System: Express-like middleware chains
- Request/Response Wrappers: Compatibility layer

```typescript
// Routing Performance Example
const matcher = new OptimizedRouteMatcher<Handler>();
matcher.addRoute('/api/status', handler);        // O(1) Map lookup
matcher.addRoute('/api/users/:id', handler);     // Trie structure

const match = matcher.match('/api/status');      // ~0.05μs
const paramMatch = matcher.match('/api/users/123'); // ~0.5μs
```

### Main Package (`@zenofolio/hyper-decor`)
**Purpose**: Unified API combining core + routing
**Dependencies**: Depends on both core and routing packages
**Key Components**:
- Application Factory: `createApp()` function
- Unified Exports: Re-exports from core and routing
- Integration Layer: Combines decorators with routing
- Documentation Hub: Main documentation and examples

```typescript
// Unified API Example
import { createApp, HyperController, Get } from '@zenofolio/hyper-decor';

const app = createApp();
app.registerController(UserController);
app.listen(3000);
```

## 🚀 Performance Architecture

### O(1) Routing System
```
Static Routes (Map):     /api/status → O(1) lookup
                        /api/health → O(1) lookup

Dynamic Routes (Trie):   /api/users/:id → Trie traversal
                        /api/posts/:id/comments/:cid → Trie traversal
```

### Memory Layout
```
OptimizedRouteMatcher {
  staticRoutes: Map<string, Handler>     // O(1) access
  dynamicRoutes: TrieNode<Handler>       // Efficient tree
  middleware: MiddlewareChain[]          // Optimized stack
}
```

### Performance Targets
- **Static Routes**: <0.1μs per lookup
- **Dynamic Routes**: <1μs per lookup  
- **Throughput**: >500k requests/second
- **Memory**: <50MB baseline per app
- **Latency**: <2ms average response time

## 🔧 Development Patterns

### Adding New Decorators (Core Package)
1. **Create decorator file** in `packages/core/src/decorators/`
2. **Define metadata constants** in `packages/core/src/internals/constants.ts`
3. **Add TypeScript types** in `packages/core/src/decorators/types/`
4. **Export from index** in `packages/core/src/decorators/index.ts`
5. **Write unit tests** in `packages/core/tests/`
6. **Update documentation** in `packages/core/README.md`

### Optimizing Routing (Routing Package)
1. **Benchmark current performance** using `npm run bench`
2. **Identify bottlenecks** with profiling tools
3. **Implement optimization** in `packages/routing/src/`
4. **Validate performance gains** with benchmarks
5. **Update performance docs** with new metrics

### Adding Features (Main Package)
1. **Determine if core or routing** - Where does the feature belong?
2. **Implement in appropriate package** first
3. **Add integration layer** in main package if needed
4. **Export unified API** from main package
5. **Create end-to-end examples** in main package docs

## 🧪 Testing Strategy

### Package-Level Testing
```bash
# Test individual packages
npm test --workspace=@zenofolio/hyper-decor-core
npm test --workspace=@zenofolio/hyper-decor-routing
npm test --workspace=@zenofolio/hyper-decor

# Test all packages
npm test
```

### Test Categories
- **Unit Tests**: Individual decorator and routing functions
- **Integration Tests**: Package interactions and API compatibility
- **Performance Tests**: Routing benchmarks and memory usage
- **E2E Tests**: Complete application scenarios

## 📈 Monitoring & Metrics

### Development Metrics
- Build times per package
- Test coverage per package
- Bundle size per package
- Performance benchmarks

### Runtime Metrics
- Route lookup times
- Memory usage patterns
- Request throughput
- Error rates by package

## 🔄 Release Strategy

### Independent Versioning
```bash
# Core package release
cd packages/core && npm version patch && npm publish

# Routing package release  
cd packages/routing && npm version minor && npm publish

# Main package release (follows highest version)
cd packages/hyper-decor && npm version minor && npm publish
```

### Version Compatibility
- Core and Routing can version independently
- Main package must be compatible with both
- Breaking changes require coordination across packages
- Semantic versioning enforced by CI/CD

## 🛠️ Build System

### Workspace Commands
```bash
# Build all packages in dependency order
npm run build

# Build specific package
npm run build --workspace=@zenofolio/hyper-decor-core

# Watch mode for development
npm run build:watch --workspace=@zenofolio/hyper-decor-routing

# Clean all build artifacts
npm run clean
```

### TypeScript Project References
- Root `tsconfig.json` references all packages
- Each package has composite builds enabled
- Incremental compilation across packages
- Proper dependency resolution between packages