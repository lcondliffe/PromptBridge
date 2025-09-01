import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI
    ? [ ['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }] ]
    : [ ['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }] ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // storageState is filled by the setup project into e2e/.auth/user.json
  },
  webServer: {
    command: 'pnpm dev',
    port: 3000,
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], browserName: 'chromium', storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup'],
      testMatch: /.*\.(spec|test)\.ts/,
    },
  ],
});

