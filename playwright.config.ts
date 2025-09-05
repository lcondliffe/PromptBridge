import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Read the .env.local file and set the environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // Clerk setup requires serial execution
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined, // Reduced workers for Clerk testing
  reporter: isCI
    ? [ ['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }] ]
    : [ ['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }] ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm dev',
    port: 3000,
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'global setup',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'auth setup',
      testMatch: /auth\.setup\.ts/,
      dependencies: ['global setup'],
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], browserName: 'chromium', storageState: 'e2e/.auth/user.json' },
      dependencies: ['auth setup'],
      testMatch: /.*\.(spec|test)\.ts/,
      testIgnore: [/global\.setup\.ts/, /auth\.setup\.ts/],
    },
  ],
});

