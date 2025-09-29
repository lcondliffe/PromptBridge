import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiError, createApiError, handleApiError } from '../../../src/utils/api';

describe('API Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ApiError', () => {
    it('should create an ApiError with correct properties', () => {
      const error = new ApiError('Test error message', 400, { error: 'Bad Request' });

      expect(error.name).toBe('ApiError');
      expect(error.message).toBe('Test error message');
      expect(error.status).toBe(400);
      expect(error.body).toEqual({ error: 'Bad Request' });
      expect(error.stack).toBeDefined();
    });

    it('should create an ApiError without body', () => {
      const error = new ApiError('Test error message', 404);

      expect(error.name).toBe('ApiError');
      expect(error.message).toBe('Test error message');
      expect(error.status).toBe(404);
      expect(error.body).toBeUndefined();
    });

    it('should extend Error correctly', () => {
      const error = new ApiError('Test error', 500);

      expect(error instanceof Error).toBe(true);
      expect(error instanceof ApiError).toBe(true);
    });

    it('should be serializable', () => {
      const error = new ApiError('Serialization test', 422, { field: 'invalid' });
      
      const serialized = JSON.stringify(error);
      const parsed = JSON.parse(serialized);

      expect(parsed.name).toBe('ApiError');
      expect(parsed.message).toBe('Serialization test');
      expect(parsed.status).toBe(422);
      expect(parsed.body).toEqual({ field: 'invalid' });
    });

    it('should handle circular references in body', () => {
      const circularObj: { prop: string; circular?: unknown } = { prop: 'value' };
      circularObj.circular = circularObj;

      expect(() => {
        new ApiError('Circular test', 500, circularObj);
      }).not.toThrow();
    });
  });

  describe('createApiError', () => {
    it('should create ApiError from Response object', async () => {
      const mockResponse = {
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('{"error":"Resource not found"}'),
      } as Response;

      const error = await createApiError(mockResponse);

      expect(error.name).toBe('ApiError');
      expect(error.status).toBe(404);
      expect(error.body).toBe('{"error":"Resource not found"}');
      expect(error.message).toBe('{"error":"Resource not found"}');
    });

    it('should handle response.text() rejection', async () => {
      const mockResponse = {
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.reject(new Error('Cannot read response')),
      } as Response;

      const error = await createApiError(mockResponse);

      expect(error.name).toBe('ApiError');
      expect(error.status).toBe(500);
      expect(error.body).toBeUndefined();
      expect(error.message).toBe('Request failed: 500');
    });

    it('should handle empty response body', async () => {
      const mockResponse = {
        status: 204,
        statusText: 'No Content',
        text: () => Promise.resolve(''),
      } as Response;

      const error = await createApiError(mockResponse);

      expect(error.status).toBe(204);
      expect(error.body).toBe('');
      expect(error.message).toBe('Request failed: 204');
    });

    it('should handle null response text', async () => {
      const mockResponse = {
        status: 503,
        statusText: 'Service Unavailable',
        text: () => Promise.resolve(null as unknown),
      } as Response;

      const error = await createApiError(mockResponse);

      expect(error.status).toBe(503);
      expect(error.body).toBeNull();
      expect(error.message).toBe('Request failed: 503');
    });

    it('should handle different status codes', async () => {
      const statusCodes = [400, 401, 403, 404, 422, 429, 500, 502, 503, 504];

      for (const status of statusCodes) {
        const mockResponse = {
          status,
          statusText: `HTTP ${status}`,
          text: () => Promise.resolve(`Error ${status}`),
        } as Response;

        const error = await createApiError(mockResponse);

        expect(error.status).toBe(status);
        expect(error.body).toBe(`Error ${status}`);
        expect(error.message).toBe(`Error ${status}`);
      }
    });

    it('should handle long response bodies', async () => {
      const longMessage = 'x'.repeat(10000);
      const mockResponse = {
        status: 413,
        statusText: 'Payload Too Large',
        text: () => Promise.resolve(longMessage),
      } as Response;

      const error = await createApiError(mockResponse);

      expect(error.status).toBe(413);
      expect(error.body).toBe(longMessage);
      expect(error.message).toBe(longMessage);
    });
  });

  describe('handleApiError', () => {
    it('should handle ApiError instances', () => {
      const apiError = new ApiError('API failed', 400, { field: 'invalid' });

      const result = handleApiError(apiError);

      expect(result).toBe(apiError);
    });

    it('should handle generic Error instances', () => {
      const genericError = new Error('Network connection failed');

      const result = handleApiError(genericError);

      expect(result).toBe(genericError);
    });

    it('should handle string errors', () => {
      const stringError = 'Something went wrong';

      const result = handleApiError(stringError);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('Something went wrong');
    });

    it('should handle null/undefined errors', () => {
      const nullError = handleApiError(null);
      const undefinedError = handleApiError(undefined);

      expect(nullError).toBeInstanceOf(Error);
      expect(nullError.message).toBe('Unknown error');

      expect(undefinedError).toBeInstanceOf(Error);
      expect(undefinedError.message).toBe('Unknown error');
    });

    it('should handle object errors', () => {
      const objectError = { message: 'Object error', code: 'ERR_001' };

      const result = handleApiError(objectError);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toContain('Object error');
      // Note: handleApiError only uses the message property, not other properties
    });

    it('should handle errors without message property', () => {
      const noMessageError = { code: 'ERR_002', details: 'Some details' };

      const result = handleApiError(noMessageError);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('{"code":"ERR_002","details":"Some details"}');
    });

    it('should handle number errors', () => {
      const numberError = 404;

      const result = handleApiError(numberError);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('404');
    });

    it('should handle boolean errors', () => {
      const booleanError = false;

      const result = handleApiError(booleanError);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('false');
    });

    it('should preserve stack trace for Error instances', () => {
      const originalError = new Error('Original error');
      const originalStack = originalError.stack;

      const result = handleApiError(originalError);

      expect(result.stack).toBe(originalStack);
    });

    it('should handle circular reference objects', () => {
      const circularObj: { prop: string; circular?: unknown } = { prop: 'value' };
      circularObj.circular = circularObj;

      expect(() => {
        handleApiError(circularObj);
      }).not.toThrow();
    });
  });

  describe('Error Integration', () => {
    it('should work together in typical API flow', async () => {
      // Simulate a failed API response
      const mockResponse = {
        status: 422,
        statusText: 'Unprocessable Entity',
        text: () => Promise.resolve('{"errors":{"email":["is required"]}}'),
      } as Response;

      // Create error from response
      const apiError = await createApiError(mockResponse);
      
      // Handle the error
      const handledError = handleApiError(apiError) as ApiError;

      expect(handledError).toBeInstanceOf(ApiError);
      expect(handledError.status).toBe(422);
      expect(handledError.body).toBe('{"errors":{"email":["is required"]}}');
      expect(handledError.message).toBe('{"errors":{"email":["is required"]}}');
    });

    it('should handle network errors in API flow', () => {
      // Simulate a network error
      const networkError = new Error('fetch failed: network timeout');
      
      // Handle the error
      const handledError = handleApiError(networkError);

      expect(handledError).toBeInstanceOf(Error);
      expect(handledError.message).toBe('fetch failed: network timeout');
    });

    it('should handle response parsing errors', async () => {
      // Simulate a response that fails to parse
      const mockResponse = {
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.reject(new Error('Response body is not readable')),
      } as Response;

      const apiError = await createApiError(mockResponse);
      const handledError = handleApiError(apiError) as ApiError;

      expect(handledError.status).toBe(500);
      expect(handledError.body).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle responses with non-standard status codes', async () => {
      const mockResponse = {
        status: 299,
        statusText: 'Custom Success',
        text: () => Promise.resolve('Custom response'),
      } as Response;

      const error = await createApiError(mockResponse);

      expect(error.status).toBe(299);
      expect(error.message).toBe('Custom response');
    });

    it('should handle responses with very large status codes', async () => {
      const mockResponse = {
        status: 999,
        statusText: 'Custom Error',
        text: () => Promise.resolve('Large status code'),
      } as Response;

      const error = await createApiError(mockResponse);

      expect(error.status).toBe(999);
      expect(error.message).toBe('Large status code');
    });

    it('should handle ApiError inheritance correctly', () => {
      class CustomApiError extends ApiError {
        constructor(message: string, status: number, body?: unknown, public customProp?: string) {
          super(message, status, body);
        }
      }

      const customError = new CustomApiError('Custom error', 400, { test: true }, 'custom');
      const handled = handleApiError(customError);

      expect(handled).toBeInstanceOf(ApiError);
      expect(handled).toBe(customError);
      expect((handled as CustomApiError).customProp).toBe('custom');
    });

    it('should handle complex response body structures', async () => {
      const complexBody = {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Validation failed',
          details: [
            { field: 'email', message: 'Invalid format' },
            { field: 'password', message: 'Too short' }
          ],
          timestamp: '2024-01-01T00:00:00Z',
          requestId: 'req-123'
        }
      };

      const mockResponse = {
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve(JSON.stringify(complexBody)),
      } as Response;

      const error = await createApiError(mockResponse);

      expect(error.body).toBe(JSON.stringify(complexBody));
    });
  });
});
