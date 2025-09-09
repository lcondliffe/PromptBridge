# Testing Plan

This document outlines PromptBridge's E2E testing strategy and implementation details.

## Overview

PromptBridge uses Playwright for end-to-end testing with optional real OpenRouter API integration for comprehensive testing of the streaming functionality.

## API Key Setup

### Environment Variables

Real API integration is controlled by the `E2E_OPENROUTER_API_KEY` environment variable:

```bash
# Enable real API testing
export E2E_OPENROUTER_API_KEY=sk-or-v1-your-actual-api-key

# Skip API tests (recommended for CI without secrets)
unset E2E_OPENROUTER_API_KEY
```

### Test Configuration

**Model Selection**: Tests use cost-effective models:
- `openai/gpt-3.5-turbo` - Fast, inexpensive, reliable for testing

**Graceful Skipping**: Tests automatically skip when no API key is provided:
```typescript
test('can send a prompt and receive a streaming result', async ({ page }) => {
  const apiKey = process.env.E2E_OPENROUTER_API_KEY;
  test.skip(!apiKey, 'Skipping: E2E_OPENROUTER_API_KEY not set');
  // ... test implementation
});
```

## Playwright Configuration

### WebServer Setup

```typescript
webServer: {
  command: 'pnpm dev',
  port: 3000,
  reuseExistingServer: !process.env.CI,
  timeout: 180_000,
}
```

Playwright automatically starts the development server before running tests.

### Test Environment

- **Base URL**: `http://localhost:3000`
- **Browser**: Chromium (Desktop Chrome simulation)
- **Authentication**: Uses persisted storage state from `e2e/.auth/user.json`
- **Parallelization**: Disabled (required for Clerk authentication)

## Test Implementation

### localStorage Seeding

Tests seed browser localStorage to set up initial state:

```typescript
await page.addInitScript(() => {
  localStorage.setItem('openrouter_api_key', 'test');
  localStorage.setItem('selected_models', JSON.stringify(['openai/gpt-5-chat']));
});
```

### Core Test Cases

#### 1. API Key Validation (`e2e/home.send.spec.ts`)
```typescript
test('shows UI error when API key is missing', async ({ page }) => {
  // Clear API key and models
  await page.addInitScript(() => {
    localStorage.removeItem('openrouter_api_key');
    localStorage.setItem('selected_models', JSON.stringify([]));
  });
  
  // Attempt to send prompt
  await page.goto('/');
  await page.getByPlaceholder('Enter your prompt…').fill('Hello');
  await page.getByRole('button', { name: 'Send' }).click();
  
  // Verify error banner appears
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('Please set your OpenRouter API key first.');
});
```

#### 2. Real API Streaming Flow
```typescript
test('can send a prompt and receive a streaming result', async ({ page }) => {
  // Skip test if no API key is provided
  const apiKey = process.env.E2E_OPENROUTER_API_KEY;
  test.skip(!apiKey, 'Skipping: E2E_OPENROUTER_API_KEY not set');

  await page.addInitScript((key) => {
    localStorage.setItem('openrouter_api_key', key);
    // Use faster, cheaper models for testing
    localStorage.setItem('selected_models', JSON.stringify(['openai/gpt-3.5-turbo']));
  }, apiKey);
  
  await page.goto('/');
  await page.getByPlaceholder('Enter your prompt…').fill('Say "test complete"');
  await page.getByRole('button', { name: 'Send' }).click();

  // Wait for streaming to start
  await expect(page.getByText('Streaming…', { exact: false })).toBeVisible({ timeout: 10000 });

  // Wait for streaming to complete and show content
  await expect(page.locator('text=test complete')).toBeVisible({ timeout: 30000 });

  // Verify UI controls are present after completion
  await expect(page.getByRole('button', { name: /Copy/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Stop/i })).toBeDisabled();
});
```

## Running Tests

### Local Development

```bash
# Run all E2E tests
pnpm test:e2e

# Run specific test file  
pnpm test:e2e home.send.spec.ts

# Run with headed browser (watch tests run)
pnpm test:e2e --headed

# Debug mode
pnpm test:e2e --debug
```

### CI Environment

```bash
# Use CI reporter
pnpm test:e2e:ci
```

## Test Coverage

### Current Coverage
- ✅ Home page loads and accessibility
- ✅ Health endpoint verification
- ✅ Authentication flows (with/without credentials)
- ✅ API key validation error handling
- ✅ Mock streaming functionality
- ✅ UI controls state verification

### Planned Additions
- History page interactions (load, delete)
- Settings page functionality
- Model selection workflows
- Advanced parameter validation
- Error recovery flows

## Benefits of Real API Testing

1. **Realistic**: Tests actual API responses and streaming behavior
2. **Comprehensive**: Covers full integration including network layer
3. **Error detection**: Catches real API changes, rate limits, and issues
4. **Confidence**: Provides high confidence in production behavior
5. **Flexible**: Gracefully skips when API key not available

## API Testing Strategy

| Aspect | Without API Key | With API Key |
|--------|-----------------|---------------|
| Speed | ⚡ Very fast | 🐌 Moderate |
| Coverage | 🎯 UI/UX only | 🔗 Full integration |
| Cost | 💰 Free | 💸 Minimal (cheap models) |
| CI/CD | ✅ Always runs | ⚙️ Requires secret |
| Reliability | ✅ No dependencies | 🌐 Network dependent |

**Recommended approach**: 
- Local development: Use real API key for comprehensive testing
- CI/CD: Skip API tests or use secrets for critical pipelines
- Models: Use cost-effective options like `gpt-3.5-turbo`
