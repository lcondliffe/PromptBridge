import { ChatMessage } from '@/lib/types';

/**
 * Test data factories for generating consistent test objects
 * Note: These create real test data, not mocks, to ensure close-to-production testing
 */

export const TestData = {
  /**
   * Create a test user with real Clerk ID format
   */
  user: {
    clerkId: () => `user_test_${Math.random().toString(36).slice(2, 15)}`,
    email: () => `test.user.${Math.random().toString(36).slice(2, 8)}@example.com`,
    role: () => 'USER' as const,
  },

  /**
   * Create a test conversation
   */
  conversation: {
    title: () => `Test Conversation ${Math.random().toString(36).slice(2, 8)}`,
    id: () => Math.random().toString(36).slice(2, 15),
  },

  /**
   * Create test chat messages
   */
  message: {
    user: (content: string = 'Test user message'): ChatMessage => ({
      role: 'user',
      content,
    }),
    assistant: (content: string = 'Test assistant response', model?: string): ChatMessage & { model?: string } => ({
      role: 'assistant',
      content,
      ...(model && { model }),
    }),
    system: (content: string = 'You are a helpful assistant'): ChatMessage => ({
      role: 'system',
      content,
    }),
  },

  /**
   * Create test OpenRouter API key (format: sk-or-...)
   */
  apiKey: () => `sk-or-v1-test-${Math.random().toString(36).slice(2, 32)}`,

  /**
   * Create test model IDs
   */
  model: {
    openai: () => 'openai/gpt-3.5-turbo',
    anthropic: () => 'anthropic/claude-3-haiku',
    meta: () => 'meta-llama/llama-3.1-8b-instruct',
    google: () => 'google/gemini-pro',
    custom: (provider: string, name: string) => `${provider}/${name}`,
  },

  /**
   * Create test streaming responses
   */
  streaming: {
    chunk: (content: string) => ({
      choices: [{ delta: { content } }],
    }),
    done: () => 'data: [DONE]\\n\\n',
    error: (message: string) => ({
      error: { message },
    }),
  },

  /**
   * Create test OpenRouter model info
   */
  modelInfo: {
    basic: (id: string) => ({
      id,
      name: `Test Model ${id.split('/')[1] || id}`,
      context_length: 4096,
      pricing: {
        prompt: '0.0015',
        completion: '0.002',
      },
    }),
    withWebSearch: (id: string) => ({
      id,
      name: `Test Model with Web Search ${id.split('/')[1] || id}`,
      context_length: 8192,
      pricing: {
        prompt: '0.003',
        completion: '0.006',
        web_search: '0.001',
      },
    }),
  },
};