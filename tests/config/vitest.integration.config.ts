/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: [
      'tests/integration/**/*.{test,spec}.{js,ts}',
    ],
    testTimeout: 30_000, // Integration tests may take longer
    hookTimeout: 30_000,
    setupFiles: ['./tests/utils/setup.ts', './tests/utils/integration-setup.ts'],
  },
});