import { test, expect } from '@playwright/test';

// Simple health check and authenticated page sanity

test('health endpoint responds with ok: true', async ({ page }) => {
  const response = await page.goto('/api/health');
  expect(response?.ok()).toBeTruthy();
  const text = await page.textContent('body');
  expect(text).toContain('"ok":');
});

test('history page loads for authenticated user', async ({ page }) => {
  // Skip this test when Clerk E2E credentials are not provided (e.g., local or CI without secrets)
  const hasCredentials = !!(process.env.E2E_CLERK_USER_USERNAME && process.env.E2E_CLERK_USER_PASSWORD);
  test.skip(!hasCredentials, 'Skipping: E2E Clerk credentials not set');

  const resp = await page.goto('/history');
  expect(resp?.ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByRole('heading', { name: /chat history/i })).toBeVisible();
});

