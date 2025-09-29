# Integration Tests

This directory contains integration tests for the PromptBridge API endpoints.

## Overview

The integration test suite provides minimal coverage of the main features:

- **Health API** (`health.test.ts`) - Tests the health check endpoint
- **Status API** (`status.test.ts`) - Tests the user status endpoint
- **Conversations API** (`conversations.test.ts`) - Tests conversation listing and creation
- **Conversation [id] API** (`conversations.[id].test.ts`) - Tests conversation deletion

## Running Tests

```bash
# Run all integration tests
pnpm test:integration

# Run in watch mode
pnpm test:integration --watch

# Run specific test file
pnpm test:integration tests/integration/health.test.ts
```

## Test Structure

Each test file follows a simple pattern:

1. **Mock external dependencies** - Uses Vitest's `vi.mock()` to mock API calls and authentication
2. **Test the route handler directly** - Calls the Next.js route handlers directly without HTTP overhead
3. **Assert responses** - Validates status codes and response data

## Key Features

- **Fast execution** - Tests run in ~600ms total
- **No HTTP server required** - Tests call route handlers directly
- **Comprehensive mocking** - All external dependencies (database, auth) are mocked
- **Minimal but effective** - Covers main success and error paths

## Test Coverage

### Health API (2 tests)
- ✓ Returns health status with timestamp
- ✓ Returns valid ISO timestamp

### Status API (3 tests)
- ✓ Returns hasUsers: true when users exist
- ✓ Returns hasUsers: false when no users exist
- ✓ Handles database errors

### Conversations API (6 tests)
- ✓ Returns conversations for authenticated user
- ✓ Returns 401 for unauthenticated user
- ✓ Returns empty array when user has no conversations
- ✓ Creates new conversation for authenticated user
- ✓ Returns 401 for unauthenticated user on POST
- ✓ Validates input and returns 400 for invalid data

### Conversation [id] API (3 tests)
- ✓ Deletes conversation owned by authenticated user
- ✓ Returns 401 for unauthenticated user
- ✓ Returns 404 when conversation not found

## Maintenance

The test suite is designed to be minimal and maintainable:

- Tests focus on core functionality rather than edge cases
- Mocking is straightforward using Vitest's built-in mocking
- No complex test utilities or helpers required
- Easy to add new tests following the existing patterns
