# Templates

This folder contains code templates for rapid development in hyper-decor.

## Available Templates

### Decorators
- **decorator-template.ts** - Base template for new decorators
- **parameter-decorator.ts** - Template for parameter decorators (@Body, @Param, etc.)
- **method-decorator.ts** - Template for method decorators (@Get, @Post, etc.)
- **class-decorator.ts** - Template for class decorators (@HyperController, @HyperModule)

### Controllers & Services
- **controller-template.ts** - Complete controller example
- **service-template.ts** - Service class template
- **module-template.ts** - Module configuration template

### Tests
- **decorator-test.ts** - Test template for decorators
- **controller-test.ts** - Integration test template for controllers
- **e2e-test.ts** - End-to-end test template

## Usage

Copy the appropriate template and customize:
1. Replace placeholder names with actual values
2. Implement required functionality
3. Add proper type definitions
4. Include comprehensive tests
5. Update documentation

## Template Variables

Common variables used in templates:
- `{{DecoratorName}}` - Name of the decorator (PascalCase)
- `{{decoratorName}}` - Name in camelCase
- `{{DECORATOR_NAME}}` - Name in CONSTANT_CASE
- `{{description}}` - Decorator description
- `{{author}}` - Author name
- `{{date}}` - Creation date