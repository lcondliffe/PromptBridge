/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/utils/sdk-setup.ts'],
    include: [
      'tests/sdk/**/*.{test,spec}.{js,ts}',
    ],
    exclude: [
      'node_modules/**',
      'e2e/**',
      '.next/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '**/*.d.ts',
      '**/*.config.*',
      'scripts/**',
      'public/**',
    ],
    coverage: {
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['packages/sdk/src/**'],
      exclude: [
        'node_modules/**',
        '**/__tests__/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/test-utils/**'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 85,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@promptbridge/api': path.resolve(__dirname, './packages/api/src'),
      '@promptbridge/sdk': path.resolve(__dirname, './packages/sdk/src'),
    },
  },
});