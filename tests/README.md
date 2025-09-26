# PromptBridge Tests Directory

This directory contains all testing files and documentation for the PromptBridge project, organized for better maintainability and clarity.

## Directory Structure

```
tests/
├── config/                          # Test configuration files
│   ├── vitest.config.ts             # Base Vitest configuration
│   ├── vitest.unit.config.ts        # Unit test configuration
│   ├── vitest.sdk.config.ts         # SDK test configuration  
│   └── vitest.integration.config.ts # Integration test configuration
├── docs/                            # Test documentation
│   └── TESTING.md                   # Comprehensive testing guide
├── unit/                            # Unit tests (isolated components)
│   ├── utils/                       # Utility function tests
│   │   ├── api.test.ts             # API error handling tests
│   │   └── validation.test.ts      # Validation utility tests
│   └── repositories/               # Repository layer tests
│       ├── userRepo.test.ts        # User repository tests
│       ├── conversationRepo.test.ts # Conversation repository tests
│       └── messageRepo.test.ts     # Message repository tests
├── sdk/                            # SDK package tests
│   └── __tests__/
│       └── index.test.ts          # Comprehensive SDK tests
├── integration/                    # Integration tests (API + database)
│   ├── health.test.ts             # Health endpoint tests
│   ├── status.test.ts             # Status endpoint tests
│   ├── conversations.test.ts      # Conversations API tests
│   └── conversations.[id].test.ts # Individual conversation tests
└── utils/                         # Test utilities and helpers
    ├── factories.ts              # Test data generation
    ├── setup.ts                 # MSW setup for integration tests
    ├── sdk-setup.ts            # SDK-specific test setup
    └── integration-setup.ts    # Database setup for integration tests
```

## Test Categories

### 1. Unit Tests (`tests/unit/`)
- **Purpose**: Test individual components in isolation
- **Framework**: Vitest with mocked dependencies
- **Coverage**: Utilities, repositories, business logic
- **Run**: `pnpm run test:unit`

### 2. SDK Tests (`tests/sdk/`)
- **Purpose**: Test the SDK package independently
- **Framework**: Vitest with fetch mocking
- **Coverage**: API client, error handling, configuration
- **Run**: `pnpm run test:sdk`

### 3. Integration Tests (`tests/integration/`)
- **Purpose**: Test API endpoints with real database
- **Framework**: Vitest + Supertest + MSW
- **Coverage**: API routes, authentication, database operations
- **Run**: `pnpm run test:integration`

## Configuration Files

### Base Configuration (`vitest.config.ts`)
- Global test settings
- Coverage thresholds
- Path aliases
- Common excludes

### Specialized Configurations
- **Unit**: Mocked dependencies, isolated testing
- **SDK**: No MSW interference, fetch mocking
- **Integration**: Database setup, HTTP mocking

## Test Utilities

### Data Factories (`utils/factories.ts`)
```typescript
import { TestData } from '../utils/factories';

const user = TestData.user();
const conversation = TestData.conversation();
const message = TestData.message();
```

### Setup Files
- **`setup.ts`**: MSW server for integration tests
- **`sdk-setup.ts`**: Clean environment for SDK tests
- **`integration-setup.ts`**: Database initialization

### Mock Helpers
- Prisma client mocking for repositories
- Clerk authentication mocking
- Window object mocking for client/server testing

## Running Tests

### Individual Categories
```bash
pnpm run test:unit          # Unit tests only
pnpm run test:sdk           # SDK tests only
pnpm run test:integration   # Integration tests only
```

### Combined Testing
```bash
pnpm run test:all           # Unit + SDK + Integration
pnpm run test               # All tests including E2E
```

### Development
```bash
pnpm run test:dev           # Watch mode
pnpm run test:ui            # Vitest UI
pnpm run test:coverage      # Coverage report
```

## Best Practices

### File Organization
- Group related tests in subdirectories
- Use descriptive file names ending in `.test.ts`
- Keep test files close to their test utilities
- Separate configuration from implementation

### Import Patterns
- Use relative imports for test utilities: `../../utils/factories`
- Use absolute paths for source code: `../../../src/utils/validation`
- Maintain consistent import order

### Test Structure
- Use descriptive `describe` blocks for organization
- Follow AAA pattern: Arrange, Act, Assert
- Include both success and error scenarios
- Test edge cases and boundary conditions

## Maintenance

### Adding New Tests
1. Choose appropriate category (unit/sdk/integration)
2. Use existing patterns and utilities
3. Update imports to match directory structure
4. Add to appropriate configuration if needed

### Updating Configurations
- Modify base config for global changes
- Update specialized configs for category-specific needs
- Maintain symlinks in root directory for backward compatibility

### Documentation
- Update this README when adding new test categories
- Keep `docs/TESTING.md` comprehensive and current
- Document any special setup or configuration requirements

## Troubleshooting

### Common Issues
- **Import Errors**: Check relative paths from tests directory
- **Mock Conflicts**: Ensure proper test isolation
- **Database Issues**: Verify integration setup configuration

### Getting Help
- Check `docs/TESTING.md` for comprehensive testing guide
- Review test output for specific error messages  
- Use `DEBUG_TESTS=true` for verbose logging

---

For detailed testing guidelines, see [`docs/TESTING.md`](./docs/TESTING.md).