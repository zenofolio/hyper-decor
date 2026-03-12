# 🔄 Development Workflows

## 🚀 Quick Development Commands

### Monorepo Management
```bash
# Install all dependencies
npm install

# Build all packages
npm run build

# Test all packages  
npm test

# Development mode (watch all packages)
npm run dev

# Clean all build artifacts
npm run clean

# Check workspace health
npm run workspace:check
```

### Package-Specific Commands
```bash
# Work on specific package
npm run build --workspace=@zenofolio/hyper-decor-core
npm run test --workspace=@zenofolio/hyper-decor-routing
npm run dev --workspace=@zenofolio/hyper-decor

# Or navigate to package directory
cd packages/core && npm run build
cd packages/routing && npm run test  
cd packages/hyper-decor && npm run dev
```

## 🏗️ Development Environment Setup

### Initial Setup
```bash
# Clone and setup
git clone <repository-url>
cd hyper-decor
npm install

# Verify setup
npm run build
npm test

# Start development
npm run dev
```

### IDE Configuration
**VS Code Workspace Settings** (`.vscode/settings.json`):
```json
{
  "typescript.preferences.includePackageJsonAutoImports": "auto",
  "typescript.suggest.autoImports": true,
  "typescript.workspaceSymbols.scope": "allOpenProjects",
  "eslint.workingDirectories": ["packages/core", "packages/routing", "packages/hyper-decor"],
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.turbo": true
  }
}
```

### Recommended Extensions
- **TypeScript Importer** - Auto import management
- **ESLint** - Code linting
- **Prettier** - Code formatting  
- **Jest** - Test runner integration
- **Thunder Client** - HTTP testing

## 🔄 Development Workflows

### 1. Adding New Decorator (Core Package)

#### Workflow Steps
```bash
# 1. Navigate to core package
cd packages/core

# 2. Create decorator file
touch src/decorators/NewDecorator.ts

# 3. Implement decorator following patterns
# See .ai-context/knowledge/core-architecture.md

# 4. Add tests
touch src/decorators/__tests__/NewDecorator.test.ts

# 5. Export in barrel file
echo "export * from './NewDecorator';" >> src/decorators/index.ts

# 6. Build and test
npm run build
npm test
```

#### Code Template
```typescript
// src/decorators/NewDecorator.ts
import { getMetadata, setMetadata } from '../__internals/stores/metadata.store';
import { DECORATOR_CONSTANTS } from '../constants';

export function NewDecorator(config?: DecoratorConfig) {
  return function (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
    // Get existing metadata
    const existing = getMetadata(DECORATOR_CONSTANTS.NEW_DECORATOR, target) || [];
    
    // Add new metadata
    const metadata = {
      config,
      propertyKey,
      target: target.constructor.name
    };
    
    // Store updated metadata
    setMetadata(DECORATOR_CONSTANTS.NEW_DECORATOR, [...existing, metadata], target);
    
    return descriptor;
  };
}
```

### 2. Adding Route Optimization (Routing Package)

#### Workflow Steps
```bash
# 1. Navigate to routing package  
cd packages/routing

# 2. Identify optimization area
# - Static routes (Map-based)
# - Dynamic routes (Trie-based)
# - Middleware chain

# 3. Implement optimization
# See .ai-context/knowledge/routing-architecture.md

# 4. Add performance tests
touch src/__tests__/performance/new-optimization.bench.ts

# 5. Benchmark before/after
npm run benchmark
```

#### Performance Testing Template
```typescript
// src/__tests__/performance/route-matching.bench.ts
import { describe, bench } from 'vitest';
import { Router } from '../Router';

describe('Route Matching Performance', () => {
  const router = new Router();
  
  // Setup routes
  for (let i = 0; i < 1000; i++) {
    router.addRoute('GET', `/api/static/${i}`, () => {});
  }
  
  bench('static route lookup - should be O(1)', () => {
    router.match('GET', '/api/static/500');
  });
  
  bench('dynamic route lookup - should be <1μs', () => {
    router.match('GET', '/api/users/123/posts/456');
  });
});
```

### 3. Integration Layer Development (Main Package)

#### Workflow Steps
```bash
# 1. Navigate to main package
cd packages/hyper-decor

# 2. Implement integration feature
# - Application factory
# - Decorator-router bridge
# - Unified API

# 3. Test integration
npm run test:integration

# 4. Update examples
touch examples/new-feature.ts
```

#### Integration Pattern
```typescript
// src/application/HyperApplication.ts
import { Container } from '@zenofolio/hyper-decor-core';
import { Router } from '@zenofolio/hyper-decor-routing';

export class HyperApplication {
  private container = new Container();
  private router = new Router();
  
  registerController(ControllerClass: any) {
    // Extract metadata from core package
    const routes = this.container.getMetadata('routes', ControllerClass);
    
    // Register routes in router
    routes.forEach(route => {
      this.router.addRoute(route.method, route.path, route.handler);
    });
  }
}
```

## 🧪 Testing Workflows

### Test-Driven Development (TDD)
```bash
# 1. Write failing test first
npm test -- --watch NewFeature.test.ts

# 2. Implement minimum code to pass
# 3. Refactor while keeping tests green
# 4. Add edge cases and error handling tests
```

### Performance Testing
```bash
# Run benchmarks
npm run benchmark

# Profile memory usage  
npm run profile

# Load testing
npm run load-test

# Generate performance report
npm run perf-report
```

### Integration Testing
```bash
# Test package interactions
npm run test:integration

# Test with real HTTP server
npm run test:e2e

# Test examples work correctly
npm run test:examples
```

## 🔧 Debugging Workflows

### TypeScript Compilation Issues
```bash
# Check specific package compilation
cd packages/core
npx tsc --noEmit --listFiles

# Trace import resolution
npx tsc --traceResolution --noEmit src/index.ts

# Check project references
npx tsc --build --verbose
```

### Import Path Debugging
```bash
# Find all relative imports
grep -r "import.*'\.\." packages/*/src/

# Check for circular dependencies
npx madge --circular packages/*/src/

# Validate barrel exports
find packages/*/src -name "index.ts" -exec echo "=== {} ===" \; -exec cat {} \;
```

### Runtime Debugging
```bash
# Debug with Node.js inspector
node --inspect-brk ./node_modules/.bin/jest

# Profile performance
node --prof app.js
node --prof-process isolate-*.log > profile.txt

# Memory leak detection
node --inspect --heap-prof app.js
```

## 🚀 Release Workflow

### Pre-Release Checklist
```bash
# 1. All tests pass
npm test

# 2. Build succeeds
npm run build

# 3. No TypeScript errors
npm run type-check

# 4. Linting passes
npm run lint

# 5. Performance benchmarks meet targets
npm run benchmark -- --compare

# 6. Documentation is updated
npm run docs:generate

# 7. Examples work
npm run test:examples
```

### Version Management
```bash
# Update version (use npm workspaces)
npm version patch --workspaces

# Generate changelog
npm run changelog

# Tag release
git tag v$(node -p "require('./package.json').version")

# Publish (dry run first)
npm publish --dry-run --workspaces
npm publish --workspaces
```

### Post-Release
```bash
# Update documentation
npm run docs:deploy

# Create GitHub release
gh release create v1.0.0 --auto

# Notify community
# - Update README
# - Post in discussions
# - Tweet/social media
```

## 🔄 Hot Reload Development

### Watch Mode Setup
```bash
# Start all packages in watch mode
npm run dev

# Or individual packages
cd packages/core && npm run dev &
cd packages/routing && npm run dev &  
cd packages/hyper-decor && npm run dev &
```

### Live Testing Server
```bash
# Start development server with hot reload
cd examples
npm run dev

# Server auto-restarts on changes to:
# - packages/*/src/**/*.ts
# - examples/**/*.ts
```

### Editor Integration
**VS Code Tasks** (`.vscode/tasks.json`):
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "dev:all",
      "type": "shell", 
      "command": "npm run dev",
      "group": "build",
      "isBackground": true,
      "problemMatcher": "$tsc-watch"
    },
    {
      "label": "test:watch",
      "type": "shell",
      "command": "npm run test -- --watch",
      "group": "test",
      "isBackground": true
    }
  ]
}
```

## 🎯 Productivity Tips

### Useful Aliases
```bash
# Add to ~/.bashrc or ~/.zshrc
alias hd-build='npm run build --workspaces'
alias hd-test='npm test --workspaces'  
alias hd-core='cd packages/core'
alias hd-routing='cd packages/routing'
alias hd-main='cd packages/hyper-decor'
```

### VS Code Snippets
**TypeScript Decorators** (`.vscode/typescript.json`):
```json
{
  "Hyper Decorator": {
    "prefix": "hd-decorator",
    "body": [
      "export function ${1:DecoratorName}(${2:config}: ${3:ConfigType}) {",
      "  return function (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {",
      "    const metadata = { ${2:config}, propertyKey };",
      "    setMetadata('${4:metadata-key}', metadata, target);",
      "    return descriptor;",
      "  };",
      "}"
    ],
    "description": "Create a new Hyper-Decor decorator"
  }
}
```

### Quick Commands
```bash
# Check what changed since last commit
git diff --name-only HEAD~1

# Run tests for changed files only
npm test -- --changedSince=HEAD~1

# Build only changed packages
npm run build --if-present --workspaces

# Format and lint staged files
npx lint-staged
```

This workflow system ensures consistent, efficient development across all packages while maintaining high code quality and performance standards.