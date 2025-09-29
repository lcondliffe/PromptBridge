/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./tests/utils/setup.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/e2e/**",  // Exclude Playwright e2e tests
      "**/playwright-report/**",
      "**/test-results/**",
    ],
    coverage: {
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/**",
        "e2e/**",
        ".next/**",
        "coverage/**",
        "playwright-report/**",
        "test-results/**",
        "**/*.d.ts",
        "**/*.config.*",
        "scripts/**",
        "public/**",
        "tests/**"
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../../src"),
      "@promptbridge/api": path.resolve(__dirname, "../../packages/api/src"),
      "@promptbridge/sdk": path.resolve(__dirname, "../../packages/sdk/src"),
    },
  },
});
