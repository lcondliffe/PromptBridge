import { beforeAll, afterEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import 'dotenv/config';

// Mock service worker server for HTTP interception
export const server = setupServer();

beforeAll(() => {
  // Start MSW server
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  // Reset handlers between tests
  server.resetHandlers();
});

afterEach(() => {
  // Clean up any test state
  vi.clearAllMocks();
});

// Global test environment setup
beforeAll(() => {
  // Set up test environment variables
  // Note: NODE_ENV is typically set by the test runner, but we ensure DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'file:./test.db';
  }
  
  // Mock console methods to reduce noise in tests unless debugging
  if (!process.env.DEBUG_TESTS) {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  }
});

// Cleanup after all tests
afterEach(() => {
  // Reset modules between tests to prevent state leaking
  vi.resetModules();
});
