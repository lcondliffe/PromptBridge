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

  await page.addInitScript((key) => {
    localStorage.setItem('openrouter_api_key', key);
    // Use faster, cheaper models for testing
    localStorage.setItem('selected_models', JSON.stringify(['openai/gpt-3.5-turbo']));
  }, apiKey);
  
  await page.goto('/');
  await page.getByPlaceholder('Enter your prompt…').fill('Say "test complete"');
  await page.getByRole('button', { name: 'Send' }).click();

  // Wait for streaming to start ("Streaming…" indicator should appear)
  await expect(page.getByText('Streaming…', { exact: false })).toBeVisible({ timeout: 10000 });

  // Wait for streaming to complete and show content
  await expect(page.locator('text=test complete')).toBeVisible({ timeout: 30000 });

  // Verify UI controls are present after completion
  await expect(page.getByRole('button', { name: /Copy/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Stop/i })).toBeDisabled();
});
