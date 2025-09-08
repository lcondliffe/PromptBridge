import { test, expect } from '@playwright/test';

test('shows UI error when API key is missing', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('openrouter_api_key');
    localStorage.setItem('selected_models', JSON.stringify([]));
  });
  
  await page.goto('/');
  await page.getByPlaceholder('Enter your prompt…').fill('Hello');
  await page.getByRole('button', { name: 'Send' }).click();
  
  const alert = page.getByRole('alert').filter({ hasText: 'Please set your OpenRouter API key first.' });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('Please set your OpenRouter API key first.');
});

test('can send a prompt and receive a streaming result', async ({ page }) => {
  // Skip test if no API key is provided
  const apiKey = process.env.E2E_OPENROUTER_API_KEY;
  test.skip(!apiKey, 'Skipping: E2E_OPENROUTER_API_KEY not set');

  // Navigate to settings page to set API key through the UI
  await page.goto('/settings');
  
  // Set the API key using the settings form (this uses the proper setter)
  await page.getByPlaceholder('sk-or-...').fill(apiKey!);
  
  // Verify the API key was set (should show some characters)
  await expect(page.getByPlaceholder('sk-or-...')).toHaveValue(apiKey!);
  
  // Navigate back to home page
  await page.goto('/');
  
  // Wait for models to load - the "Set your API key" message should disappear
  await expect(page.getByText('Set your API key to load models.')).not.toBeVisible({ timeout: 20000 });
  
  // Click "Select defaults" to choose some models
  await page.getByRole('button', { name: 'Select defaults' }).click();
  
  // Wait for models to be selected
  await expect(page.getByText(/Selected \([1-9]\d*\)/)).toBeVisible({ timeout: 10000 });
  
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
