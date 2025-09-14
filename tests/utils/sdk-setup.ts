import { beforeEach, afterEach, vi } from 'vitest';
import 'dotenv/config';

// Store original window object
let originalWindow: any;

beforeEach(() => {
  // Store original window state
  originalWindow = global.window;
  
  // Clear all mocks before each test
  vi.clearAllMocks();
  
  // Set up default environment
  process.env.NODE_ENV = 'test';
  delete process.env.NEXT_PUBLIC_API_BASE_URL;
  delete process.env.API_BASE_URL;
});

afterEach(() => {
  // Restore original window state
  if (originalWindow !== undefined) {
    global.window = originalWindow;
  } else {
    // If there was no window originally, properly remove it
    Object.defineProperty(global, 'window', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  }
  
  // Clean up environment variables
  delete process.env.NEXT_PUBLIC_API_BASE_URL;
  delete process.env.API_BASE_URL;
});

// Global test environment setup
beforeEach(() => {
  // Mock console methods to reduce noise in tests unless debugging
  if (!process.env.DEBUG_TESTS) {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  }
});

// Helper function to create window mock
export function createWindowMock(origin = 'http://localhost:3000') {
  const mockWindow = {
    location: {
      origin,
    },
  };
  
  Object.defineProperty(global, 'window', {
    value: mockWindow,
    writable: true,
    configurable: true,
  });
  
  return mockWindow;
}

// Helper function to simulate server-side environment
export function simulateServerSide() {
  Object.defineProperty(global, 'window', {
    value: undefined,
    writable: true,
    configurable: true,
  });
}