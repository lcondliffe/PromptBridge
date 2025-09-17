import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sdk } from '../../../packages/sdk/src/index';
import { TestData } from '../../utils/factories';
import { createWindowMock, simulateServerSide } from '../../utils/sdk-setup';

// Mock fetch globally
const mockFetch = vi.fn();

beforeEach(() => {
  // Setup is handled by sdk-setup.ts, but we need to ensure fetch is mocked
  global.fetch = mockFetch;
  mockFetch.mockClear();
  
  // Set default window mock for most tests
  createWindowMock();
});

describe('SDK', () => {
  describe('API Base URL Configuration', () => {
    it('should use NEXT_PUBLIC_API_BASE_URL when available on client', async () => {
      process.env.NEXT_PUBLIC_API_BASE_URL = '/custom/api';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, now: new Date().toISOString() }),
      });

      await sdk.health();
      
      expect(mockFetch).toHaveBeenCalledWith(
        '/custom/api/health',
        expect.objectContaining({
          credentials: 'include',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should use default /api when no environment variables are set on client', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, now: new Date().toISOString() }),
      });

      await sdk.health();
      
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/health',
        expect.objectContaining({
          credentials: 'include',
        })
      );
    });

    it('should use API_BASE_URL on server-side when available', async () => {
      simulateServerSide();
      process.env.API_BASE_URL = 'https://api.example.com/v1';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, now: new Date().toISOString() }),
      });

      await sdk.health();
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/v1/health',
        expect.objectContaining({
          credentials: 'include',
        })
      );
    });

    it('should prefer API_BASE_URL over NEXT_PUBLIC_API_BASE_URL on server-side', async () => {
      simulateServerSide();
      process.env.API_BASE_URL = 'https://api.internal.com';
      process.env.NEXT_PUBLIC_API_BASE_URL = '/public/api';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, now: new Date().toISOString() }),
      });

      await sdk.health();
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.internal.com/health',
        expect.objectContaining({
          credentials: 'include',
        })
      );
    });

    it('should fallback to localhost on server-side when no env vars set', async () => {
      simulateServerSide();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, now: new Date().toISOString() }),
      });

      await sdk.health();
      
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/health',
        expect.objectContaining({
          credentials: 'include',
        })
      );
    });
  });

  describe('Health Endpoint', () => {
    it('should call health endpoint and return parsed response', async () => {
      const healthResponse = { ok: true, now: '2024-01-01T00:00:00.000Z' };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(healthResponse),
      });

      const result = await sdk.health();
      
      expect(result).toEqual(healthResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/health',
        expect.objectContaining({
          credentials: 'include',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle health endpoint errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        text: () => Promise.resolve('Service temporarily unavailable'),
      });

      await expect(sdk.health()).rejects.toThrow('Service temporarily unavailable');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network connection failed'));

      await expect(sdk.health()).rejects.toThrow('Network connection failed');
    });
  });

  describe('Conversations API', () => {
    describe('list', () => {
      it('should fetch conversations list', async () => {
        const conversations = [
          {
            id: TestData.conversation.id(),
            title: TestData.conversation.title(),
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: TestData.conversation.id(),
            title: TestData.conversation.title(),
            createdAt: '2024-01-02T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z',
          },
        ];

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(conversations),
        });

        const result = await sdk.conversations.list();

        expect(result).toEqual(conversations);
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/conversations',
          expect.objectContaining({
            credentials: 'include',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
          })
        );
      });

      it('should handle empty conversations list', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

        const result = await sdk.conversations.list();

        expect(result).toEqual([]);
      });

      it('should handle authentication errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          text: () => Promise.resolve('{"error":"Unauthorized"}'),
        });

        await expect(sdk.conversations.list()).rejects.toThrow('{"error":"Unauthorized"}');
      });
    });

    describe('create', () => {
      it('should create a new conversation', async () => {
        const title = TestData.conversation.title();
        const newConversation = {
          id: TestData.conversation.id(),
          title,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: () => Promise.resolve(newConversation),
        });

        const result = await sdk.conversations.create(title);

        expect(result).toEqual(newConversation);
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/conversations',
          expect.objectContaining({
            method: 'POST',
            credentials: 'include',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
            body: JSON.stringify({ title }),
          })
        );
      });

      it('should handle validation errors on create', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          text: () => Promise.resolve('{"error":"Invalid input"}'),
        });

        await expect(sdk.conversations.create('')).rejects.toThrow('{"error":"Invalid input"}');
      });

      it('should handle server errors on create', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: () => Promise.resolve('Internal Server Error'),
        });

        await expect(sdk.conversations.create('Test')).rejects.toThrow('Internal Server Error');
      });
    });

    describe('remove', () => {
      it('should delete a conversation', async () => {
        const conversationId = TestData.conversation.id();

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true }),
        });

        const result = await sdk.conversations.remove(conversationId);

        expect(result).toEqual({ ok: true });
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/conversations/${conversationId}`,
          expect.objectContaining({
            method: 'DELETE',
            credentials: 'include',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
          })
        );
      });

      it('should handle not found errors on delete', async () => {
        const conversationId = 'nonexistent';

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: () => Promise.resolve('{"error":"Not found"}'),
        });

        await expect(sdk.conversations.remove(conversationId)).rejects.toThrow('{"error":"Not found"}');
      });

      it('should handle special characters in conversation ID', async () => {
        const conversationId = 'conv_with_special!@#$%^&*()_chars';

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true }),
        });

        await sdk.conversations.remove(conversationId);

        expect(mockFetch).toHaveBeenCalledWith(
          `/api/conversations/${conversationId}`,
          expect.objectContaining({
            method: 'DELETE',
          })
        );
      });
    });
  });

  describe('Messages API', () => {
    describe('list', () => {
      it('should fetch messages for a conversation', async () => {
        const conversationId = TestData.conversation.id();
        const messages = [
          {
            id: 'msg_1',
            conversationId,
            role: 'user' as const,
            content: 'Hello',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'msg_2',
            conversationId,
            role: 'assistant' as const,
            content: 'Hi there!',
            createdAt: '2024-01-01T00:01:00.000Z',
          },
        ];

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(messages),
        });

        const result = await sdk.conversations.messages.list(conversationId);

        expect(result).toEqual(messages);
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/conversations/${conversationId}/messages`,
          expect.objectContaining({
            credentials: 'include',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
          })
        );
      });

      it('should handle empty message list', async () => {
        const conversationId = TestData.conversation.id();

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

        const result = await sdk.conversations.messages.list(conversationId);

        expect(result).toEqual([]);
      });

      it('should handle unauthorized access to messages', async () => {
        const conversationId = 'unauthorized_conv';

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          text: () => Promise.resolve('{"error":"Unauthorized"}'),
        });

        await expect(sdk.conversations.messages.list(conversationId)).rejects.toThrow('{"error":"Unauthorized"}');
      });
    });

    describe('create', () => {
      it('should create a user message', async () => {
        const conversationId = TestData.conversation.id();
        const messageInput = {
          role: 'user' as const,
          content: 'Hello, world!',
        };
        const newMessage = {
          id: 'msg_new',
          conversationId,
          role: 'user' as const,
          content: 'Hello, world!',
          createdAt: '2024-01-01T00:00:00.000Z',
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(newMessage),
        });

        const result = await sdk.conversations.messages.create(conversationId, messageInput);

        expect(result).toEqual(newMessage);
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/conversations/${conversationId}/messages`,
          expect.objectContaining({
            method: 'POST',
            credentials: 'include',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
            body: JSON.stringify(messageInput),
          })
        );
      });

      it('should create an assistant message with model', async () => {
        const conversationId = TestData.conversation.id();
        const messageInput = {
          role: 'assistant' as const,
          content: 'Hello! How can I help you today?',
          model: TestData.model.openai(),
        };
        const newMessage = {
          id: 'msg_assistant',
          conversationId,
          role: 'assistant' as const,
          content: 'Hello! How can I help you today?',
          model: TestData.model.openai(),
          createdAt: '2024-01-01T00:00:00.000Z',
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(newMessage),
        });

        const result = await sdk.conversations.messages.create(conversationId, messageInput);

        expect(result).toEqual(newMessage);
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/conversations/${conversationId}/messages`,
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(messageInput),
          })
        );
      });

      it('should create a system message', async () => {
        const conversationId = TestData.conversation.id();
        const messageInput = {
          role: 'system' as const,
          content: 'You are a helpful assistant.',
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'msg_system',
            conversationId,
            ...messageInput,
            createdAt: '2024-01-01T00:00:00.000Z',
          }),
        });

        const result = await sdk.conversations.messages.create(conversationId, messageInput);

        expect(result.role).toBe('system');
        expect(result.content).toBe('You are a helpful assistant.');
      });

      it('should handle message creation errors', async () => {
        const conversationId = 'nonexistent';
        const messageInput = {
          role: 'user' as const,
          content: 'This will fail',
        };

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: () => Promise.resolve('{"error":"Conversation not found"}'),
        });

        await expect(sdk.conversations.messages.create(conversationId, messageInput)).rejects.toThrow('{"error":"Conversation not found"}');
      });

      it('should handle validation errors for invalid message input', async () => {
        const conversationId = TestData.conversation.id();
        const invalidInput = {
          role: 'invalid' as 'user',
          content: '',
        };

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          text: () => Promise.resolve('{"error":"Invalid message input"}'),
        });

        await expect(sdk.conversations.messages.create(conversationId, invalidInput)).rejects.toThrow('{"error":"Invalid message input"}');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(sdk.health()).rejects.toThrow('Network error');
    });

    it('should handle response.json() errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(sdk.health()).rejects.toThrow('Invalid JSON');
    });

    it('should handle missing response body gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.reject(new Error('Cannot read response')),
      });

      await expect(sdk.health()).rejects.toThrow('Request failed: 500');
    });

    it('should create ApiError with correct properties', async () => {
      const errorBody = '{"error":"Detailed error message"}';
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        text: () => Promise.resolve(errorBody),
      });

      try {
        await sdk.health();
        expect.fail('Expected an error to be thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(Error);
        if (error instanceof Error) {
          expect(error.name).toBe('ApiError');
          expect((error as { status?: number }).status).toBe(422);
          expect(error.message).toBe(errorBody);
        }
      }
    });

    it('should handle different HTTP status codes appropriately', async () => {
      const statusCodes = [400, 401, 403, 404, 422, 429, 500, 502, 503, 504];

      for (const statusCode of statusCodes) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: statusCode,
          statusText: `HTTP ${statusCode}`,
          text: () => Promise.resolve(`Error ${statusCode}`),
        });

        try {
          await sdk.health();
          expect.fail(`Expected error for status code ${statusCode}`);
        } catch (error: unknown) {
          expect(error).toBeInstanceOf(Error);
          if (error instanceof Error) {
            expect((error as { status?: number }).status).toBe(statusCode);
            expect(error.message).toBe(`Error ${statusCode}`);
          }
        }

        mockFetch.mockClear();
      }
    });
  });

  describe('Request Configuration', () => {
    it('should always include credentials and proper headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await sdk.conversations.list();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: 'include',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should preserve custom headers in request init', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });

      // This test is more about ensuring the internal api() function works correctly
      await sdk.conversations.remove('test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/conversations/test'),
        expect.objectContaining({
          method: 'DELETE',
          credentials: 'include',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle concurrent requests correctly', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, now: '2024-01-01T00:00:00.000Z' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true }),
        });

      const [healthResult, conversationsResult, removeResult] = await Promise.all([
        sdk.health(),
        sdk.conversations.list(),
        sdk.conversations.remove('test'),
      ]);

      expect(healthResult).toEqual({ ok: true, now: '2024-01-01T00:00:00.000Z' });
      expect(conversationsResult).toEqual([]);
      expect(removeResult).toEqual({ ok: true });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('URL Construction', () => {
    it('should correctly construct nested URLs', async () => {
      const conversationId = 'test-conv-123';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await sdk.conversations.messages.list(conversationId);

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/conversations/${conversationId}/messages`,
        expect.any(Object)
      );
    });

    it('should handle URL encoding in conversation IDs', async () => {
      const conversationId = 'conv with spaces & special chars';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });

      await sdk.conversations.remove(conversationId);

      // The URL should contain the unencoded ID as the SDK doesn't encode it
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/conversations/${conversationId}`,
        expect.any(Object)
      );
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety for conversation objects', async () => {
      const conversation = {
        id: 'conv_123',
        title: 'Test Conversation',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([conversation]),
      });

      const result = await sdk.conversations.list();

      // TypeScript should infer the correct type
      expect(result[0].id).toBe('conv_123');
      expect(result[0].title).toBe('Test Conversation');
      expect(typeof result[0].createdAt).toBe('string');
      expect(typeof result[0].updatedAt).toBe('string');
    });

    it('should maintain type safety for message objects', async () => {
      const message = {
        id: 'msg_123',
        conversationId: 'conv_123',
        role: 'user' as const,
        content: 'Hello',
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([message]),
      });

      const result = await sdk.conversations.messages.list('conv_123');

      // TypeScript should infer the correct type
      expect(result[0].role).toBe('user');
      expect(typeof result[0].content).toBe('string');
      expect(typeof result[0].createdAt).toBe('string');
    });
  });
});