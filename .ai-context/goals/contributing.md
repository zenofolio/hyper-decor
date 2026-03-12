# 🤝 Contributing to Hyper-Decor

¡Bienvenido! This guide will help you contribute effectively to the Hyper-Decor project.

## 🏗️ Quick Start for Contributors

### 1. Development Setup
```bash
# Clone the repository
git clone https://github.com/zenozaga/hyper-decor.git
cd hyper-decor

# Install dependencies (npm workspaces)
npm install

# Build all packages
npm run build

# Run tests
npm test

# Start development with watch mode
npm run dev
```

### 2. Understanding the Monorepo
```
hyper-decor/
├── packages/core/          # @zenofolio/hyper-decor-core
├── packages/routing/       # @zenofolio/hyper-decor-routing  
├── packages/hyper-decor/   # @zenofolio/hyper-decor (main)
└── .ai-context/           # AI development guidance
```

Each package has its own `.ai-context/` directory with specific development rules and architectural knowledge.

## 🎯 Contribution Areas

### 🔧 High Priority (Help Needed!)

#### Core Package Fixes
**Issue**: 40 TypeScript compilation errors
**Skills**: TypeScript, module systems, import/export
**Impact**: Critical for project stability

```bash
# Check current errors
cd packages/core
npm run build
```

**Common Error Types**:
- Import path corrections (relative vs absolute)
- Type definition issues
- Missing dependencies
- Circular import resolution

#### uWebSockets.js Integration
**Issue**: Failed GitHub installation
**Skills**: Node.js, native modules, build systems
**Impact**: Critical for O(1) routing performance

```bash
# Try alternative installation
cd packages/routing
npm install uws@github:uNetworking/uWebSockets.js
# or try building from source
```

### 🚀 Medium Priority

#### Performance Optimizations
- Trie implementation for dynamic routes
- Route caching mechanisms
- Memory usage optimization
- Benchmark suite creation

#### Developer Experience
- Better error messages
- More comprehensive examples
- Documentation improvements
- VS Code extension

### 📚 Documentation & Examples
- API documentation
- Tutorial content
- Migration guides
- Real-world examples

## 📋 Contribution Types

### 🐛 Bug Fixes
1. **Check existing issues** on GitHub
2. **Reproduce the bug** with minimal example
3. **Write failing test** first
4. **Implement fix** with tests passing
5. **Update documentation** if needed

### ✨ New Features
1. **Create feature proposal** issue first
2. **Discuss architecture** with maintainers
3. **Follow package-specific rules** in `.ai-context/`
4. **Implement with comprehensive tests**
5. **Add documentation and examples**

### 📖 Documentation
1. **Follow existing style** and structure
2. **Include code examples** for all features
3. **Test all code snippets** work correctly
4. **Use consistent terminology**

### 🧪 Testing
1. **Unit tests**: Test individual functions/classes
2. **Integration tests**: Test package interactions
3. **Performance tests**: Benchmark critical paths
4. **E2E tests**: Test complete workflows

## 🔍 Development Guidelines

### Code Style
- **TypeScript**: Strict mode, no `any` types
- **Formatting**: Prettier (runs on save)
- **Linting**: ESLint (strict configuration)
- **Naming**: Descriptive, consistent with existing code

### Testing Requirements
- **Coverage**: >90% for new code
- **Performance**: Include benchmarks for critical paths
- **Documentation**: JSDoc for all public APIs
- **Examples**: Working examples for new features

### Performance Standards
- **Routing**: O(1) for static routes, <1μs for dynamic
- **Memory**: <100MB for 10k routes
- **Bundle**: <500KB compressed per package
- **Build**: <5s full rebuild

## 🏃‍♂️ Package-Specific Contribution

### Core Package (`@zenofolio/hyper-decor-core`)

#### Current Needs
- **Critical**: Fix TypeScript compilation errors
- **Important**: Complete test coverage
- **Enhancement**: Add validation decorators

#### Development Rules
```typescript
// Follow decorator patterns
export function Get(path: string = '/') {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // Implementation follows established patterns
  }
}

// Use consistent error handling
throw new HyperException('Clear error message', ErrorCode.SPECIFIC_CODE);

// Follow metadata conventions
const metadata = getMetadata('hyper:routes', target) || [];
```

#### Testing Patterns
```typescript
// Comprehensive decorator tests
describe('@Get decorator', () => {
  it('should register route metadata', () => {
    // Test decorator registration
  });
  
  it('should handle edge cases', () => {
    // Test error conditions
  });
});
```

### Routing Package (`@zenofolio/hyper-decor-routing`)

#### Current Needs  
- **Critical**: Complete uWebSockets.js integration
- **Important**: Implement O(1) trie structure
- **Enhancement**: Add middleware system

#### Development Rules
```typescript
// Optimize for performance
class OptimizedRouteMatcher {
  private staticRoutes = new Map<string, Handler>(); // O(1) lookup
  private dynamicRoutes = new TrieNode(); // Optimized trie
  
  findRoute(method: string, path: string): MatchResult {
    // Always prefer static lookup first
    const staticKey = `${method}:${path}`;
    const staticHandler = this.staticRoutes.get(staticKey);
    if (staticHandler) return { handler: staticHandler, params: {} };
    
    // Fallback to trie for dynamic routes
    return this.dynamicRoutes.match(method, path);
  }
}
```

#### Performance Requirements
```typescript
// All route operations must be benchmarked
describe('Route Performance', () => {
  it('should achieve O(1) static route lookup', () => {
    const matcher = new OptimizedRouteMatcher();
    const startTime = process.hrtime.bigint();
    
    matcher.findRoute('GET', '/static/path');
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000; // Convert to microseconds
    expect(duration).toBeLessThan(1); // <1μs
  });
});
```

### Main Package (`@zenofolio/hyper-decor`)

#### Current Needs
- **Critical**: Create application factory
- **Important**: Implement integration layer
- **Enhancement**: Add unified API

#### Development Rules
```typescript
// Create intuitive API
export function createApp(options?: AppOptions) {
  return new HyperApplication(options);
}

// Combine packages seamlessly  
export class HyperApplication {
  private router = new Router(); // from routing package
  private container = new Container(); // from core package
  
  // Unified decorator registration
  registerController(controller: any) {
    // Use core package metadata
    // Apply to routing package
  }
}
```

## 🚀 Advanced Contribution Patterns

### AI-Assisted Development
Each package has `.ai-context/` directories with:
- **rules.md**: Development guidelines and patterns
- **knowledge/**: Architectural documentation
- **goals/**: Specific objectives and roadmap

Use these to understand:
- Package architecture and design decisions
- Performance requirements and constraints
- Testing patterns and quality standards
- Integration points between packages

### Performance-First Development
```typescript
// Always consider performance implications
class PerformanceCritical {
  // Pre-allocate objects where possible
  private cache = new Map<string, any>();
  
  // Avoid repeated work
  getComputedValue(key: string) {
    if (this.cache.has(key)) return this.cache.get(key);
    
    const value = expensiveComputation(key);
    this.cache.set(key, value);
    return value;
  }
  
  // Measure and benchmark critical paths
  criticalPath() {
    const start = performance.now();
    // ... operation
    const duration = performance.now() - start;
    if (duration > 1) console.warn(`Slow operation: ${duration}ms`);
  }
}
```

### Backward Compatibility
```typescript
// Maintain API compatibility
export function createRoute(path: string, method?: HttpMethod) {
  // Support both old and new signatures
  if (method) {
    // New signature: createRoute('/path', 'GET')
    return { path, method };
  } else {
    // Legacy: return decorator function
    return function(target: any, propertyKey: string) {
      // ... existing implementation
    }
  }
}
```

## 📞 Getting Help

### Communication Channels
- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and ideas
- **PR Reviews**: Code review and feedback
- **Documentation**: Comprehensive guides and API docs

### Code Review Process
1. **Self-review**: Check your own code first
2. **Tests**: Ensure all tests pass
3. **Performance**: Include benchmarks for critical changes
4. **Documentation**: Update docs for public API changes
5. **Breaking Changes**: Highlight and justify in PR description

### Maintainer Response Times
- **Bug fixes**: Within 24 hours
- **Feature PRs**: Within 48 hours  
- **Documentation**: Within 72 hours
- **Questions**: Within 24 hours

## 🏆 Recognition

### Contributors
All contributors are recognized in:
- **README.md**: Contributors section
- **CHANGELOG.md**: Release acknowledgments
- **Package.json**: Contributors field
- **Annual Reports**: Major contribution highlights

### Contribution Levels
- **Code Contributors**: Any merged PR
- **Core Contributors**: Regular, significant contributions
- **Maintainers**: Long-term project stewardship
- **Emeritus**: Former maintainers with continued recognition

Thank you for helping make Hyper-Decor the fastest TypeScript decorator framework! 🚀