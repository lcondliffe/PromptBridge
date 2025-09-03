import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Bootstrap an authenticated storage state by signing up/in via Clerk UI.
// The resulting storage is saved for use by other tests.

test.describe.configure({ mode: 'serial' });

test('bootstrap auth state', async ({ page, context }) => {
  // Ensure target directory exists
  await mkdir('e2e/.auth', { recursive: true });

  const email = 'e2e@example.com';
  const password = 'e2etest123';

  // Go to register page and create/sign in to test account
  await page.goto('/register', { waitUntil: 'networkidle' });
  
  // Wait for Clerk component to load
  await page.waitForSelector('[data-clerk-element="rootBox"]', { timeout: 10000 });
  
  // Try to sign in first (user might already exist)
  try {
    const signInLink = page.getByText('Sign in');
    if (await signInLink.isVisible()) {
      await signInLink.click();
      await page.waitForURL('/login/**');
    }
  } catch {
    // Continue with registration if sign-in link not found
  }
  
  // Fill in credentials
  const emailInput = page.locator('input[type="email"]').first();
  const passwordInput = page.locator('input[type="password"]').first();
  
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill(email);
  await passwordInput.fill(password);
  
  // Submit form
  const submitButton = page.locator('button[type="submit"]').first();
  await submitButton.click();
  
  // Wait for redirect to home page (successful auth)
  await page.waitForURL('/', { timeout: 15000 });
  
  // Persist storage for dependent tests
  await context.storageState({ path: 'e2e/.auth/user.json' });

  // Quick sanity check: authenticated route should be accessible
  const resp = await page.goto('/history');
  expect(resp?.ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/history$/);
});

