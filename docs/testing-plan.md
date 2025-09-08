# Testing Plan

This document outlines PromptBridge's E2E testing strategy and implementation details.

## Overview

PromptBridge uses Playwright for end-to-end testing with a mock OpenRouter API to ensure deterministic, reliable tests without requiring real API keys or network calls.

## Mock Setup

### Enabling Mocks

Mocks are controlled by the `NEXT_PUBLIC_E2E_MOCK_OPENROUTER` environment variable:

```bash
# Enable mock (for E2E tests)
export NEXT_PUBLIC_E2E_MOCK_OPENROUTER=1

# Disable mock (normal operation)
unset NEXT_PUBLIC_E2E_MOCK_OPENROUTER
```

### Mock Implementation

Located in `src/lib/openrouter.ts`:

```typescript
export const isMockOpenRouter = () => process.env.NEXT_PUBLIC_E2E_MOCK_OPENROUTER === '1';
```

**Mock Models**: Returns three predefined models:
- `openai/gpt-5-chat` - "OpenAI: GPT-5 Chat"
- `anthropic/claude-sonnet-4` - "Anthropic: Claude Sonnet 4"  
- `google/gemini-2.5-flash` - "Google: Gemini 2.5 Flash"

**Mock Streaming**: Simulates token-by-token streaming with deterministic content:
- Message: "Mock reply: Hello from {model}."
- Chunks: ["Mock reply: ", "Hello ", "from ", "{model}", "."]
- Interval: 60ms between chunks
- Proper abort controller support

## Package.json Scripts

```json
{
  "dev:e2e": "NEXT_PUBLIC_E2E_MOCK_OPENROUTER=1 next dev"
}
```

This script starts the Next.js development server with mocks enabled.

## Playwright Configuration

### WebServer Setup

```typescript
webServer: {
  command: 'pnpm dev:e2e',
  port: 3000,
  reuseExistingServer: !process.env.CI,
  timeout: 180_000,
}
```

Playwright automatically starts the development server with mocks enabled before running tests.

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

#### 2. Mock Streaming Flow
```typescript
test('can send a prompt and receive a mock streaming result', async ({ page }) => {
  // Set up valid state
  await page.addInitScript(() => {
    localStorage.setItem('openrouter_api_key', 'test');
    localStorage.setItem('selected_models', JSON.stringify(['openai/gpt-5-chat', 'anthropic/claude-sonnet-4']));
  });
  
  await page.goto('/');
  await page.getByPlaceholder('Enter your prompt…').fill('Test prompt');
  await page.getByRole('button', { name: 'Send' }).click();

  // Verify streaming indicator
  const streaming = page.getByText('Streaming…', { exact: false });
  await expect(streaming).toBeVisible();

  // Verify mock content appears
  await expect(page.getByText('Mock reply', { exact: false })).toBeVisible();

  // Verify UI controls
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

## Benefits of Mock Approach

1. **Deterministic**: Tests always produce the same results
2. **Fast**: No network calls, instant responses
3. **Reliable**: No dependency on external API availability
4. **Cost-effective**: No API key usage during testing
5. **Offline-capable**: Tests run without internet connection
6. **Secure**: No real credentials needed in CI/CD

## Mock vs Real API Testing

| Aspect | Mock Tests | Real API Tests |
|--------|------------|----------------|
| Speed | ⚡ Very fast | 🐌 Slow |
| Reliability | ✅ 100% reliable | ❌ Network dependent |
| Cost | 💰 Free | 💸 API usage fees |
| Coverage | 🎯 UI/UX focused | 🔗 Integration focused |
| CI/CD | ✅ Always available | ❌ Requires secrets |

The mock approach covers UI flows and user interactions, while real API testing should be done manually or in a separate integration test suite.
