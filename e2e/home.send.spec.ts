import { test, expect } from '@playwright/test';

test('shows UI error when API key is missing', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('openrouter_api_key');
    localStorage.setItem('selected_models', JSON.stringify([]));
  });
  
  await page.goto('/');
  await page.getByPlaceholder('Enter your prompt…').fill('Hello');
  await page.getByRole('button', { name: 'Send' }).click();
  
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('Please set your OpenRouter API key first.');
});

test('can send a prompt and receive a mock streaming result', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('openrouter_api_key', 'test');
    localStorage.setItem('selected_models', JSON.stringify(['openai/gpt-5-chat', 'anthropic/claude-sonnet-4']));
  });
  
  await page.goto('/');
  await page.getByPlaceholder('Enter your prompt…').fill('Test prompt');
  await page.getByRole('button', { name: 'Send' }).click();

  // Expect to see transient Streaming… indicator
  const streaming = page.getByText('Streaming…', { exact: false });
  await expect(streaming).toBeVisible();

  // Wait for mock content
  await expect(page.getByText('Mock reply', { exact: false })).toBeVisible();

  // Verify copy and stop controls presence/disabled state post-completion
  await expect(page.getByRole('button', { name: /Copy/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Stop/i })).toBeDisabled();
});
