import { test, expect } from '@playwright/test';

// Simple health check and authenticated page sanity

test('health endpoint responds with ok: true', async ({ page }) => {
  const response = await page.goto('/api/health');
  expect(response?.ok()).toBeTruthy();
  const text = await page.textContent('body');
  expect(text).toContain('"ok":');
});

test('history page loads for authenticated user', async ({ page }) => {
  const resp = await page.goto('/history');
  expect(resp?.ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByRole('heading', { name: /chat history/i })).toBeVisible();
});

