# Task 4: Fix Tests & Improve Coverage

**Description:**
Address the remaining test issues, particularly the DI-related problems, and improve overall test coverage and reliability.

## Current Test Status
- ✅ **8 tests passing** (merge, openapi, scopes, server, service, store)
- ⚠️ **3 tests skipped** (middleware DI, dependencies DI)
- 🎯 **Target**: 100% passing, >80% coverage

## Objectives
1. Fix skipped DI integration tests
2. Improve test reliability and reduce flakiness
3. Add missing test coverage for core features  
4. Implement proper test isolation
5. Create comprehensive E2E test suite

## Steps to Execute

### 1. Fix DI Container Issues
**Problem**: `TypeInfo not known for "TestMiddleware"` and similar DI errors

**Root Cause Analysis**:
- tsyringe container not properly initialized in tests
- Missing registration of classes before resolution
- Incorrect lifecycle management between tests

**Solution Approach**:
```typescript
// Proper container setup in tests
beforeEach(() => {
  container.clearInstances();
  container.registerSingleton(TestClass);
});

afterEach(() => {
  container.clearInstances();
});
```

### 2. Test Infrastructure Improvements
- Create shared test utilities for DI setup
- Implement proper test isolation with container cleanup
- Add test helpers for common scenarios
- Create mock factories for external dependencies

### 3. Missing Test Coverage Areas
- **Parameter Decorators**: @Headers, @Cookies, @IP comprehensive tests
- **Middleware System**: Complex middleware chains and error handling
- **Security**: Role and scope validation edge cases  
- **OpenAPI**: Complete schema generation validation
- **Error Handling**: Custom exceptions and error flows
- **Performance**: Decorator execution overhead tests

### 4. E2E Test Suite
- Real HTTP request/response testing
- Complete application lifecycle testing
- Integration with actual HyperExpress server
- Multi-route application scenarios
- File upload and handling tests

### 5. Test Quality Improvements
- Remove test.skip() usage by fixing underlying issues
- Add proper async/await handling in all tests
- Implement timeout management for HTTP tests
- Add test documentation and examples

## Implementation Plan

### Phase 1: DI Container Fix (High Priority)
1. Create `tests/helpers/container.helper.ts` with proper setup/teardown
2. Fix `tests/middleware.test.ts` DI registration
3. Fix `tests/dependecies.test.ts` lifecycle management
4. Validate all existing tests still pass

### Phase 2: Coverage Expansion
1. Add comprehensive parameter decorator tests
2. Test error scenarios and edge cases
3. Add performance benchmark tests
4. Test middleware execution order

### Phase 3: E2E Suite
1. Create `tests/e2e/` directory structure
2. Implement full application integration tests
3. Add file upload/download E2E scenarios
4. Test security and auth flows

## Expected Files to Create/Modify

```
tests/
├── helpers/
│   ├── container.helper.ts    # DI setup utilities
│   ├── server.helper.ts       # Server setup utilities
│   └── mock.factories.ts      # Mock object factories
├── e2e/
│   ├── application.e2e.test.ts
│   ├── security.e2e.test.ts
│   └── file-upload.e2e.test.ts
└── unit/
    ├── decorators.extended.test.ts
    └── performance.test.ts
```

## Success Criteria
- All tests passing (0 skipped)
- Test coverage >80% on core functionality
- E2E tests validating real-world scenarios  
- Reliable test execution (no flaky tests)
- Fast test execution (<5 seconds total)

## Testing Best Practices to Enforce
1. **Isolation**: Each test should be independent
2. **Cleanup**: Proper teardown of resources
3. **Mocking**: Use mocks for external dependencies
4. **Assertions**: Clear, specific assertions
5. **Documentation**: Well-documented test cases