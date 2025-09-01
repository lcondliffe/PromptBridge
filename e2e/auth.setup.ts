import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Bootstrap an authenticated storage state by registering the initial admin (first run)
// or signing in if a user already exists.
// The resulting storage is saved for use by other tests.

test.describe.configure({ mode: 'serial' });

test('bootstrap auth state', async ({ page, context }) => {
  // Ensure target directory exists
  await mkdir('e2e/.auth', { recursive: true });

  const email = 'e2e@example.com';
  const password = 'e2etest123';

  // Check status to decide whether to register the initial admin
  const status = await page.request.get('/api/status');
  const json = await status.json().catch(() => ({ hasUsers: true }));

  if (!json?.hasUsers) {
    // First run: go through the Register UI (it will create initial admin)
    await page.goto('/register', { waitUntil: 'networkidle' });
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    await emailInput.waitFor({ state: 'visible' });
    await emailInput.fill(email);
    await passwordInput.fill(password);
    await page.getByRole('button', { name: /create account/i }).click();
  } else {
    // Users exist already: ensure our test user exists via API
    const res = await page.request.post('/api/register', {
      data: { email, password },
      headers: { 'content-type': 'application/json' },
    });
    // 200 OK creates user, 409 if already exists — both are fine
    if (!(res.ok() || res.status() === 409)) {
      throw new Error(`Failed to ensure test user exists: ${res.status()} ${await res.text()}`);
    }
  }

  // Programmatic sign-in via Credentials provider to avoid UI flake & CSRF issues
  const csrfRes = await page.request.get('/api/auth/csrf');
  const csrfJson = await csrfRes.json().catch(() => ({}));
  const csrfToken = csrfJson?.csrfToken as string | undefined;
  if (!csrfToken) throw new Error('Failed to obtain CSRF token');
  const signinRes = await page.request.post('/api/auth/callback/credentials?json=true', {
    form: {
      csrfToken,
      callbackUrl: '/',
      email,
      password,
      json: 'true',
    },
  });
  if (signinRes.status() >= 400) {
    throw new Error(`Sign-in failed: ${signinRes.status()} ${await signinRes.text()}`);
  }

  // After successful auth, ensure we can reach /
  await page.goto('/', { waitUntil: 'networkidle' });

  // Persist storage for dependent projects
  await context.storageState({ path: 'e2e/.auth/user.json' });

  // Quick sanity check: authenticated route should not redirect
  const resp = await page.goto('/history');
  expect(resp?.ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/history$/);
});

