import { test, expect } from '@playwright/test';

// Minimal UI smoke for the home page
// Ensures authenticated user is not redirected and page responds successfully.

test('home page loads and is accessible', async ({ page }) => {
  const resp = await page.goto('/');
  expect(resp?.ok()).toBeTruthy();
  await expect(page).not.toHaveURL(/\/login$/);
  await expect(page).toHaveURL('http://localhost:3000/');
  // Basic DOM presence to ensure client renders
  await expect(page.locator('body')).toBeVisible();
});

