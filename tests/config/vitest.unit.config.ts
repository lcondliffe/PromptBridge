/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: [
      'tests/unit/**/*.{test,spec}.{js,ts}',
    ],
    exclude: [
      ...baseConfig.test?.exclude || [],
      'src/app/api/**/*',  // Exclude API routes for unit tests
      '**/*integration*',   // Exclude integration tests
      'node_modules/**',    // Exclude all node_modules tests
      'packages/api/node_modules/**',  // Explicitly exclude api node_modules
    ],
  },
});