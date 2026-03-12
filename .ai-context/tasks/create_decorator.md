# Task 2: Create New Decorator

**Description:**
Generate new decorators following hyper-decor patterns and conventions. This task helps maintain consistency across the library.

## Objectives
1. Create new decorators using established patterns
2. Ensure TypeScript type safety
3. Add proper metadata handling
4. Include comprehensive tests
5. Update documentation

## Parameters
- **Decorator Name**: (e.g., `@Body`, `@Param`, `@Query`)
- **Decorator Type**: (e.g., Parameter, Method, Class, Property)
- **Target Use Case**: (e.g., Request parameter extraction, Validation)

## Steps to Execute

### 1. Decorator Implementation
- Create decorator file in appropriate `src/decorators/` location
- Follow naming conventions (PascalCase)
- Implement metadata storage using `Reflect.defineMetadata`
- Add proper TypeScript types and interfaces

### 2. Type Definitions
- Add types to `src/decorators/types/`
- Export from main types index
- Ensure compatibility with existing type system

### 3. Internal Integration
- Update internal helpers if needed
- Add to metadata processing pipeline
- Integrate with request/response handling

### 4. Testing
- Create unit tests in mirrored test structure
- Test decorator functionality in isolation
- Add integration tests with HyperExpress
- Include edge cases and error scenarios

### 5. Documentation
- Add JSDoc comments to decorator
- Create usage examples
- Update main documentation
- Add to examples folder if applicable

## Example Template

```typescript
import { DECORATOR_METADATA_KEY } from '../__internals/constants';

export interface DecoratorOptions {
  // Define options interface
}

/**
 * Decorator description and usage
 * @param options - Configuration options
 */
export function NewDecorator(options?: DecoratorOptions) {
  return function(target: any, propertyKey?: string, parameterIndex?: number) {
    // Decorator implementation
    const metadata = {
      type: 'decorator-type',
      options,
      // Additional metadata
    };
    
    Reflect.defineMetadata(DECORATOR_METADATA_KEY, metadata, target, propertyKey);
  };
}
```

## Expected Output
- Fully implemented decorator following project conventions
- Complete test suite with high coverage
- Updated type definitions and exports
- Documentation and usage examples
- Integration with existing library architecture

## Success Criteria
- Decorator works seamlessly with HyperExpress
- All tests pass with good coverage
- Code follows established patterns
- Documentation is clear and complete