# Testing Guide for PromptBridge

This document outlines the comprehensive testing strategy implemented for the PromptBridge project.

## Testing Strategy Overview

The project uses a multi-layered testing approach:

1. **Unit Tests** - Test individual components in isolation
2. **SDK Tests** - Test the SDK package with proper mocking
3. **Integration Tests** - Test API endpoints with database integration
4. **End-to-End Tests** - Test complete user workflows (existing Playwright setup)

## Test Infrastructure

### Test Frameworks and Tools
- **Vitest** - Primary test runner for unit and integration tests
- **Happy-DOM** - Lightweight DOM implementation for browser-like testing
- **MSW (Mock Service Worker)** - HTTP request mocking for integration tests
- **Supertest** - HTTP assertion testing for API routes
- **Playwright** - End-to-end testing (existing)

### Test Configuration Files
- `vitest.config.ts` - Base configuration
- `vitest.unit.config.ts` - Unit test configuration
- `vitest.sdk.config.ts` - SDK test configuration  
- `vitest.integration.config.ts` - Integration test configuration

## Test Categories

### 1. Unit Tests (`test:unit`)

**Location**: `src/**/__tests__/**/*.test.ts`

**Coverage**:
- ✅ **Utility Functions** (`src/utils/`)
  - API error handling (`api.ts`) - 28 tests
  - Validation utilities (`validation.ts`) - 71 tests
- ✅ **Repository Layer** (`packages/api/src/repositories/`)
  - User repository (`userRepo`) - CRUD operations, sync functionality
  - Conversation repository (`conversationRepo`) - List, create, delete operations  
  - Message repository (`messageRepo`) - Message operations with error handling

**Features**:
- Isolated component testing with mocked dependencies
- Comprehensive error handling validation
- Edge case coverage
- Type safety validation

**Run Commands**:
```bash
pnpm run test:unit                    # Run all unit tests
pnpm run test:unit src/utils/         # Run utility tests only
```

### 2. SDK Tests (`test:sdk`)

**Location**: `packages/sdk/src/__tests__/index.test.ts`

**Coverage** - 37 tests covering:
- ✅ **API Base URL Configuration** - Client vs server-side URL resolution
- ✅ **Health Endpoint** - Basic connectivity and error handling
- ✅ **Conversations API** - CRUD operations with proper error handling
- ✅ **Messages API** - Message creation and retrieval
- ✅ **Error Handling** - Network errors, API errors, response parsing
- ✅ **Request Configuration** - Headers, credentials, concurrent requests
- ✅ **URL Construction** - Nested URLs, special characters
- ✅ **Type Safety** - TypeScript type inference validation

**Features**:
- Isolated from MSW to avoid conflicts
- Proper window object mocking for client/server-side testing
- Fetch API mocking for HTTP requests
- Comprehensive error scenario testing

**Run Commands**:
```bash
pnpm run test:sdk                     # Run SDK tests
```

### 3. Integration Tests (`test:integration`)

**Location**: `src/app/api/**/__tests__/**/*.test.ts`

**Coverage**:
- ✅ **Health API** (`/api/health`) - 9 tests
- ✅ **Status API** (`/api/status`) - 11 tests  
- ✅ **Conversations API** (`/api/conversations`) - 17 tests
- ✅ **Individual Conversation API** (`/api/conversations/[id]`) - 9 tests

**Features**:
- Real database integration with test database setup
- Authentication mocking with Clerk
- HTTP request/response testing with Supertest
- Database state validation
- Error handling and edge cases

**Run Commands**:
```bash
pnpm run test:integration             # Run integration tests
```

### 4. End-to-End Tests (Existing)

**Location**: `e2e/`

**Coverage**: 
- ✅ OpenRouter API integration with streaming
- ✅ Authentication workflows
- ✅ Conversation management

**Run Commands**:
```bash
pnpm run test:e2e                     # Run E2E tests
pnpm run test:e2e:ci                  # Run E2E tests in CI mode
```

## Test Utilities and Helpers

### Test Data Factories (`src/test-utils/factories.ts`)
Provides consistent test data generation:
- `TestData.user()` - User test data
- `TestData.conversation()` - Conversation test data  
- `TestData.message()` - Message test data
- `TestData.model()` - Model test data

### Test Setup Files
- `src/test-utils/setup.ts` - MSW setup for integration tests
- `src/test-utils/sdk-setup.ts` - SDK-specific setup without MSW
- `src/test-utils/integration-setup.ts` - Database setup for integration tests

### Mock Implementations
- **Prisma Client Mocking** - For repository unit tests
- **Clerk Authentication Mocking** - For API integration tests
- **Fetch API Mocking** - For SDK tests

## Running Tests

### Individual Test Categories
```bash
pnpm run test:unit                    # Unit tests only
pnpm run test:sdk                     # SDK tests only  
pnpm run test:integration             # Integration tests only
pnpm run test:e2e                     # E2E tests only
```

### Comprehensive Testing
```bash
pnpm run test:all                     # Run unit + SDK + integration tests
pnpm run test                         # Run all tests including E2E
```

### Development Testing
```bash
pnpm run test:dev                     # Watch mode for development
pnpm run test:ui                      # Vitest UI interface
```

### Coverage Reports
```bash
pnpm run test:coverage                # Generate coverage report
```

## Test Coverage Standards

### Current Coverage Targets
- **Global Minimum**: 70% (branches, functions, lines, statements)
- **Critical Paths**: 85-95% coverage
  - Repository layer: 90%+ coverage requirement
  - Core OpenRouter integration: 85%+ coverage requirement

### Coverage Exclusions
- Configuration files
- Test utilities and setup files
- Build artifacts and dependencies
- Type definition files

## Best Practices

### Writing Tests

1. **Use Descriptive Test Names**
   ```typescript
   it('should create conversation with valid title and return conversation object')
   ```

2. **Follow AAA Pattern** (Arrange, Act, Assert)
   ```typescript
   it('should handle validation errors', async () => {
     // Arrange
     const invalidData = { title: '' };
     
     // Act
     const result = await validateInput(invalidData);
     
     // Assert
     expect(result.success).toBe(false);
   });
   ```

3. **Test Error Conditions**
   - Include both happy path and error scenarios
   - Test edge cases and boundary conditions
   - Validate error messages and types

4. **Use Proper Mocking**
   - Mock external dependencies
   - Use test data factories for consistent data
   - Clean up mocks between tests

### Test Organization

- Group related tests in `describe` blocks
- Use nested `describe` blocks for method/feature organization
- Put test files in `__tests__` directories
- Name test files with `.test.ts` suffix

### Debugging Tests

1. **Enable Debug Mode**
   ```bash
   DEBUG_TESTS=true pnpm run test:unit
   ```

2. **Run Specific Tests**
   ```bash
   pnpm run test:unit -- --run src/utils/__tests__/validation.test.ts
   ```

3. **Use Vitest UI**
   ```bash
   pnpm run test:ui
   ```

## Integration with CI/CD

The testing infrastructure is designed to integrate with CI/CD pipelines:

1. **Pre-commit Hooks** - Run linting and quick tests
2. **Pull Request Checks** - Run full test suite
3. **Deployment Pipeline** - Include E2E tests for production validation

## Future Enhancements

### Planned Improvements
- [ ] Add performance testing for OpenRouter streaming
- [ ] Extend E2E tests for multi-model scenarios  
- [ ] Add mutation testing for test quality validation
- [ ] Implement visual regression testing
- [ ] Add load testing for API endpoints

### Coverage Goals
- Increase repository test coverage to 95%+
- Add comprehensive OpenRouter integration testing
- Expand error recovery scenario testing

## Troubleshooting

### Common Issues

1. **MSW Conflicts**: SDK tests use separate config to avoid MSW interference
2. **Window Mocking**: Use `simulateServerSide()` and `createWindowMock()` helpers
3. **Database State**: Integration tests use isolated test database
4. **Async Testing**: Use proper async/await patterns and test timeouts

### Getting Help

- Check test output for specific error messages
- Use `DEBUG_TESTS=true` for verbose logging  
- Review test setup files for configuration issues
- Ensure all dependencies are installed with `pnpm install`

## Summary

The PromptBridge testing infrastructure provides:

- **185+ Tests** across unit, SDK, integration, and E2E categories
- **Comprehensive Coverage** of critical application components
- **Isolated Testing** environments for different test types
- **Developer-Friendly** tools and utilities for test authoring
- **CI/CD Ready** configuration for automated testing

This robust testing foundation ensures code quality, catches regressions early, and provides confidence for rapid development and deployment.