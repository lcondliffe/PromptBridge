# E2E Tests

This directory contains end-to-end tests for PromptBridge using Playwright and Clerk's testing utilities. The tests verify core application functionality, authentication flows, and protected route access.

## Overview

The E2E test suite is designed to work both in development environments with real Clerk credentials and in CI environments without secrets. It uses Playwright for browser automation and integrates with Clerk for authentication testing.

## Test Structure

### Global Setup (`global.setup.ts`)
- Initializes Clerk's testing environment using `clerkSetup()`
- Must run serially before all other tests
- Required for proper Clerk testing integration

### Authentication Setup (`auth.setup.ts`)
- Bootstraps authentication state for other tests
- Creates authenticated user session using Clerk credentials when available
- Falls back to minimal auth state for CI environments without secrets
- Saves authentication state to `e2e/.auth/user.json`

### Test Files

#### `smoke.spec.ts` - Health Checks & Basic Functionality
- **Health endpoint test**: Verifies `/api/health` responds correctly
- **History page authentication**: Ensures authenticated users can access `/history`
- Gracefully skips tests when Clerk credentials are unavailable

#### `home.spec.ts` - Home Page Smoke Tests  
- **Home page accessibility**: Verifies home page loads and renders properly
- **Authentication check**: Ensures authenticated users aren't redirected to login
- **Basic DOM presence**: Confirms client-side rendering works

#### `authenticated-user.spec.ts` - Complete Authentication Flow
- **Protected route access**: Tests navigation to `/history` and `/settings`
- **Authentication indicators**: Verifies user authentication state
- **Sign-out flow**: Tests complete sign-out process using Clerk utilities
- **Unauthenticated redirect**: Ensures unauthenticated users are redirected to login

## Configuration

### Playwright Config (`playwright.config.ts`)
- **Test directory**: `e2e/`
- **Base URL**: `http://localhost:3000`
- **Timeout**: 60 seconds per test, 10 seconds for assertions
- **Parallelization**: Disabled (required for Clerk testing)
- **Workers**: Limited to 1 in CI for stability
- **Storage state**: Uses `e2e/.auth/user.json` for authentication persistence

### Project Structure
The configuration defines three projects:
1. **global setup** - Runs `global.setup.ts`
2. **auth setup** - Runs `auth.setup.ts` (depends on global setup)
3. **chromium** - Runs all test specs (depends on auth setup)

## Environment Variables

### Required for Full Testing
```bash
E2E_CLERK_USER_USERNAME=your-test-user-email
E2E_CLERK_USER_PASSWORD=your-test-user-password
```

### Optional (Auto-detected)
```bash
CI=true  # Enables CI-specific behaviors
```

## Running Tests

### Development (with Clerk credentials)
```bash
# Run all E2E tests
pnpm test:e2e

# Run specific test file
pnpm test:e2e home.spec.ts

# Run with headed browser (see tests run)
pnpm test:e2e --headed
```

### CI Environment (without credentials)
```bash
# Use CI reporter
pnpm test:e2e:ci
```

### Debug Mode
```bash
# Run with debug mode (opens browser dev tools)
pnpm test:e2e --debug

# Generate trace for failed tests
pnpm test:e2e --trace on
```

## Test Features

### Graceful Credential Handling
- Tests automatically detect when Clerk credentials are unavailable
- Authenticated tests skip gracefully with informative messages
- Basic functionality tests (health checks, page loads) run regardless

### Authentication State Management
- Uses Clerk's official testing utilities for reliable authentication
- Persists authentication state between tests for efficiency
- Properly cleans up authentication state for isolation

### Failure Analysis
- Screenshots captured on failure
- Video recordings for failed tests
- Trace files for debugging (retained on failure)
- HTML reports generated for detailed analysis

## Adding New Tests

When adding new E2E tests:

1. **Use existing patterns**: Follow the credential checking pattern from existing tests
2. **Consider authentication**: Decide if your test needs authentication or should work without it
3. **Add to appropriate file**: Put related tests together (smoke, auth flow, specific features)
4. **Update this README**: Document any new test categories or setup requirements

### Example Test Pattern

```typescript
test('your new test', async ({ page }) => {
  // Check for credentials if authentication is needed
  const hasCredentials = !!(process.env.E2E_CLERK_USER_USERNAME && process.env.E2E_CLERK_USER_PASSWORD);
  if (!hasCredentials) {
    test.skip('Skipping: E2E Clerk credentials not set');
  }

  // Your test logic here
  await page.goto('/your-route');
  await expect(page).toHaveURL('/your-route');
});
```

## Troubleshooting

### Common Issues

1. **Tests failing in CI**: Ensure tests can run without Clerk credentials
2. **Authentication not persisting**: Check that `auth.setup.ts` completes successfully
3. **Timeout errors**: Increase timeout in config or optimize test performance
4. **Parallel execution issues**: Keep `fullyParallel: false` for Clerk compatibility

### Debug Commands

```bash
# View test execution with browser
pnpm test:e2e --headed --slowMo=1000

# Run only setup to debug authentication
pnpm test:e2e auth.setup.ts --headed

# Generate detailed trace
pnpm test:e2e --trace on --reporter=html
```

## Dependencies

- **@playwright/test**: Browser automation and testing framework
- **@clerk/testing/playwright**: Official Clerk testing utilities
- **dotenv**: Environment variable loading for local development

## Notes

- Tests are designed to work in both authenticated and non-authenticated environments
- The test suite automatically starts the development server (`pnpm dev`) when running
- Authentication state is shared between tests for efficiency
- All tests use the same chromium browser configuration for consistency
