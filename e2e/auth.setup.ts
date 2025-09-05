import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { mkdir } from 'node:fs/promises';

test.describe.configure({ mode: 'serial' });

test('bootstrap auth state', async ({ page, context }) => {
  // Ensure target directory exists
  await mkdir('e2e/.auth', { recursive: true });

  // Get test user credentials from environment variables
  const username = process.env.E2E_CLERK_USER_USERNAME;
  const password = process.env.E2E_CLERK_USER_PASSWORD;

  // Check if we have valid test credentials
  if (!username || !password) {
    console.warn('E2E Clerk credentials not found - creating minimal auth state for CI');
    
    // Create a minimal auth state for CI environments without real Clerk credentials
    await context.storageState({ path: 'e2e/.auth/user.json' });
    
    // Verify the app loads (basic smoke test)
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    
    console.log('Minimal auth state created for CI testing');
    return;
  }

  // Real Clerk authentication flow using @clerk/testing
  console.log('Using Clerk testing utilities for authentication');
  
  // Navigate to sign-in page
  await page.goto('/login');
  
  // Use Clerk's testing utilities to sign in
  // This automatically handles setupClerkTestingToken() under the hood
  await clerk.signIn({
    page,
    signInParams: {
      strategy: 'password',
      identifier: username,
      password: password,
    },
  });

  // Wait for successful authentication and redirect
  await expect(page).toHaveURL('/');
  
  // Persist the authenticated storage state for other tests
  await context.storageState({ path: 'e2e/.auth/user.json' });

  // Quick sanity check: authenticated route should be accessible
  const resp = await page.goto('/history');
  expect(resp?.ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/history$/);
  
  console.log('Authenticated storage state saved successfully');
});

