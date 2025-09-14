import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  schemas,
  validators,
  validateSafely,
  getValidationErrorMessage,
  requestSchemas,
  responseSchemas,
  sanitizeInput,
  normalizeWhitespace,
  truncateString,
  ValidationResult,
} from '../../../src/utils/validation';

describe('Validation Utilities', () => {
  describe('schemas', () => {
    describe('nonEmptyString', () => {
      it('should validate non-empty strings', () => {
        expect(schemas.nonEmptyString.parse('hello')).toBe('hello');
        expect(schemas.nonEmptyString.parse('a')).toBe('a');
        expect(schemas.nonEmptyString.parse('  text  ')).toBe('  text  ');
      });

      it('should reject empty strings', () => {
        expect(() => schemas.nonEmptyString.parse('')).toThrow();
        expect(() => schemas.nonEmptyString.parse('   ')).not.toThrow(); // Whitespace is valid
      });
    });

    describe('email', () => {
      it('should validate valid emails', () => {
        const validEmails = [
          'test@example.com',
          'user.name+label@domain.co.uk',
          'simple@domain.org',
          'complex.email+123@subdomain.domain.com',
        ];

        validEmails.forEach(email => {
          expect(schemas.email.parse(email)).toBe(email);
        });
      });

      it('should reject invalid emails', () => {
        const invalidEmails = [
          'not-an-email',
          '@domain.com',
          'user@',
          'user space@domain.com',
          'user..double.dot@domain.com',
        ];

        invalidEmails.forEach(email => {
          expect(() => schemas.email.parse(email)).toThrow();
        });
      });
    });

    describe('url', () => {
      it('should validate valid URLs', () => {
        const validUrls = [
          'https://example.com',
          'http://localhost:3000',
          'https://api.example.com/v1/endpoint',
          'ftp://files.example.com',
        ];

        validUrls.forEach(url => {
          expect(schemas.url.parse(url)).toBe(url);
        });
      });

      it('should reject invalid URLs', () => {
        const invalidUrls = [
          'not-a-url',
          'example.com',
          '//incomplete',
          'https://',
        ];

        invalidUrls.forEach(url => {
          expect(() => schemas.url.parse(url)).toThrow();
        });
      });
    });

    describe('uuid', () => {
      it('should validate valid UUIDs', () => {
        const validUuids = [
          'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          '550e8400-e29b-41d4-a716-446655440000',
          '00000000-0000-0000-0000-000000000000',
        ];

        validUuids.forEach(uuid => {
          expect(schemas.uuid.parse(uuid)).toBe(uuid);
        });
      });

      it('should reject invalid UUIDs', () => {
        const invalidUuids = [
          'not-a-uuid',
          'f47ac10b-58cc-4372-a567',
          'f47ac10b-58cc-4372-a567-0e02b2c3d479-extra',
          // Note: '12345678-1234-1234-1234-123456789012' might be valid in some UUID parsers
        ];

        invalidUuids.forEach(uuid => {
          expect(() => schemas.uuid.parse(uuid)).toThrow();
        });
      });
    });

    describe('messageContent', () => {
      it('should validate message content within limits', () => {
        expect(schemas.messageContent.parse('Hello')).toBe('Hello');
        expect(schemas.messageContent.parse('a'.repeat(1000))).toBe('a'.repeat(1000));
        expect(schemas.messageContent.parse('a'.repeat(10000))).toBe('a'.repeat(10000));
      });

      it('should reject empty or too long content', () => {
        expect(() => schemas.messageContent.parse('')).toThrow();
        expect(() => schemas.messageContent.parse('a'.repeat(10001))).toThrow();
      });
    });

    describe('conversationTitle', () => {
      it('should validate titles within limits', () => {
        expect(schemas.conversationTitle.parse('My Chat')).toBe('My Chat');
        expect(schemas.conversationTitle.parse('a'.repeat(200))).toBe('a'.repeat(200));
      });

      it('should reject empty or too long titles', () => {
        expect(() => schemas.conversationTitle.parse('')).toThrow();
        expect(() => schemas.conversationTitle.parse('a'.repeat(201))).toThrow();
      });
    });

    describe('messageRole', () => {
      it('should validate valid roles', () => {
        expect(schemas.messageRole.parse('user')).toBe('user');
        expect(schemas.messageRole.parse('assistant')).toBe('assistant');
        expect(schemas.messageRole.parse('system')).toBe('system');
      });

      it('should reject invalid roles', () => {
        expect(() => schemas.messageRole.parse('invalid')).toThrow();
        expect(() => schemas.messageRole.parse('admin')).toThrow();
        expect(() => schemas.messageRole.parse('')).toThrow();
      });
    });

    describe('isoDateTime', () => {
      it('should validate valid ISO datetime strings', () => {
        const validDates = [
          '2024-01-01T00:00:00.000Z',
          '2024-12-31T23:59:59.999Z',
          '2024-06-15T12:30:45.123Z',
        ];

        validDates.forEach(date => {
          expect(schemas.isoDateTime.parse(date)).toBe(date);
        });
      });

      it('should reject invalid datetime strings', () => {
        const invalidDates = [
          '2024-01-01',
          '2024-01-01T00:00:00',
          'not-a-date',
          '2024-13-01T00:00:00.000Z', // Invalid month
        ];

        invalidDates.forEach(date => {
          expect(() => schemas.isoDateTime.parse(date)).toThrow();
        });
      });
    });

    describe('pagination', () => {
      it('should validate pagination with defaults', () => {
        const result = schemas.pagination.parse({});
        expect(result).toEqual({ page: 1, limit: 20 });
      });

      it('should validate custom pagination values', () => {
        const result = schemas.pagination.parse({ page: 5, limit: 50 });
        expect(result).toEqual({ page: 5, limit: 50 });
      });

      it('should reject invalid pagination values', () => {
        expect(() => schemas.pagination.parse({ page: 0 })).toThrow();
        expect(() => schemas.pagination.parse({ page: -1 })).toThrow();
        expect(() => schemas.pagination.parse({ limit: 0 })).toThrow();
        expect(() => schemas.pagination.parse({ limit: 101 })).toThrow();
      });
    });
  });

  describe('validators', () => {
    describe('isValidEmail', () => {
      it('should return true for valid emails', () => {
        expect(validators.isValidEmail('test@example.com')).toBe(true);
        expect(validators.isValidEmail('user+label@domain.org')).toBe(true);
      });

      it('should return false for invalid emails', () => {
        expect(validators.isValidEmail('invalid-email')).toBe(false);
        expect(validators.isValidEmail('@domain.com')).toBe(false);
      });
    });

    describe('isValidUrl', () => {
      it('should return true for valid URLs', () => {
        expect(validators.isValidUrl('https://example.com')).toBe(true);
        expect(validators.isValidUrl('http://localhost:3000')).toBe(true);
      });

      it('should return false for invalid URLs', () => {
        expect(validators.isValidUrl('not-a-url')).toBe(false);
        expect(validators.isValidUrl('example.com')).toBe(false);
      });
    });

    describe('isValidUuid', () => {
      it('should return true for valid UUIDs', () => {
        expect(validators.isValidUuid('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true);
      });

      it('should return false for invalid UUIDs', () => {
        expect(validators.isValidUuid('not-a-uuid')).toBe(false);
        expect(validators.isValidUuid('f47ac10b-58cc-4372')).toBe(false);
      });
    });

    describe('isValidMessageRole', () => {
      it('should return true for valid roles', () => {
        expect(validators.isValidMessageRole('user')).toBe(true);
        expect(validators.isValidMessageRole('assistant')).toBe(true);
        expect(validators.isValidMessageRole('system')).toBe(true);
      });

      it('should return false for invalid roles', () => {
        expect(validators.isValidMessageRole('invalid')).toBe(false);
        expect(validators.isValidMessageRole('admin')).toBe(false);
      });

      it('should provide proper type narrowing', () => {
        const role = 'user' as string;
        if (validators.isValidMessageRole(role)) {
          // TypeScript should narrow the type here
          expect(['user', 'assistant', 'system']).toContain(role);
        }
      });
    });

    describe('isValidConversationTitle', () => {
      it('should return true for valid titles', () => {
        expect(validators.isValidConversationTitle('My Chat')).toBe(true);
        expect(validators.isValidConversationTitle('a'.repeat(200))).toBe(true);
      });

      it('should return false for invalid titles', () => {
        expect(validators.isValidConversationTitle('')).toBe(false);
        expect(validators.isValidConversationTitle('a'.repeat(201))).toBe(false);
      });
    });

    describe('isValidMessageContent', () => {
      it('should return true for valid content', () => {
        expect(validators.isValidMessageContent('Hello')).toBe(true);
        expect(validators.isValidMessageContent('a'.repeat(1000))).toBe(true);
      });

      it('should return false for invalid content', () => {
        expect(validators.isValidMessageContent('')).toBe(false);
        expect(validators.isValidMessageContent('a'.repeat(10001))).toBe(false);
      });
    });

    describe('isValidIsoDateTime', () => {
      it('should return true for valid ISO datetime', () => {
        expect(validators.isValidIsoDateTime('2024-01-01T00:00:00.000Z')).toBe(true);
      });

      it('should return false for invalid datetime', () => {
        expect(validators.isValidIsoDateTime('2024-01-01')).toBe(false);
        expect(validators.isValidIsoDateTime('not-a-date')).toBe(false);
      });
    });
  });

  describe('validateSafely', () => {
    const testSchema = z.object({
      name: z.string().min(1),
      age: z.number().int().min(0),
    });

    it('should return success result for valid data', () => {
      const result = validateSafely(testSchema, { name: 'John', age: 30 });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ name: 'John', age: 30 });
      }
    });

    it('should return error result for invalid data', () => {
      const result = validateSafely(testSchema, { name: '', age: -1 });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(2);
        expect(result.errors[0]).toContain('name');
        expect(result.errors[1]).toContain('age');
      }
    });

    it('should handle nested validation errors', () => {
      const nestedSchema = z.object({
        user: z.object({
          profile: z.object({
            name: z.string().min(1),
          }),
        }),
      });

      const result = validateSafely(nestedSchema, { user: { profile: { name: '' } } });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0]).toContain('user.profile.name');
      }
    });

    it('should handle non-ZodError exceptions', () => {
      const throwingSchema = z.any().transform(() => {
        throw new Error('Custom error');
      });

      const result = validateSafely(throwingSchema, {});
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toEqual(['Validation failed']);
      }
    });
  });

  describe('getValidationErrorMessage', () => {
    it('should format single field error', () => {
      try {
        z.object({ name: z.string().min(1) }).parse({ name: '' });
      } catch (error) {
        if (error instanceof z.ZodError) {
          const message = getValidationErrorMessage(error);
          expect(message).toBe('name: String must contain at least 1 character(s)');
        }
      }
    });

    it('should format multiple field errors', () => {
      try {
        z.object({ 
          name: z.string().min(1),
          age: z.number().min(0)
        }).parse({ name: '', age: -1 });
      } catch (error) {
        if (error instanceof z.ZodError) {
          const message = getValidationErrorMessage(error);
          expect(message).toContain('name:');
          expect(message).toContain('age:');
          expect(message).toContain(', ');
        }
      }
    });

    it('should format nested field errors', () => {
      try {
        z.object({
          user: z.object({
            name: z.string().min(1)
          })
        }).parse({ user: { name: '' } });
      } catch (error) {
        if (error instanceof z.ZodError) {
          const message = getValidationErrorMessage(error);
          expect(message).toContain('user.name:');
        }
      }
    });
  });

  describe('requestSchemas', () => {
    describe('createConversation', () => {
      it('should validate valid conversation creation data', () => {
        const result = requestSchemas.createConversation.parse({
          title: 'My New Chat',
        });
        expect(result).toEqual({ title: 'My New Chat' });
      });

      it('should reject invalid conversation creation data', () => {
        expect(() => requestSchemas.createConversation.parse({ title: '' })).toThrow();
        expect(() => requestSchemas.createConversation.parse({})).toThrow();
      });
    });

    describe('createMessage', () => {
      it('should validate valid message creation data', () => {
        const result = requestSchemas.createMessage.parse({
          role: 'user',
          content: 'Hello world',
          model: 'gpt-4',
        });
        expect(result).toEqual({
          role: 'user',
          content: 'Hello world',
          model: 'gpt-4',
        });
      });

      it('should handle null model', () => {
        const result = requestSchemas.createMessage.parse({
          role: 'user',
          content: 'Hello world',
          model: null,
        });
        expect(result.model).toBeNull();
      });

      it('should reject invalid message creation data', () => {
        expect(() => requestSchemas.createMessage.parse({
          role: 'invalid',
          content: 'Hello',
          model: null,
        })).toThrow();
        
        expect(() => requestSchemas.createMessage.parse({
          role: 'user',
          content: '',
          model: null,
        })).toThrow();
      });
    });

    describe('paginationQuery', () => {
      it('should parse string numbers to integers', () => {
        const result = requestSchemas.paginationQuery.parse({
          page: '3',
          limit: '50',
        });
        expect(result).toEqual({ page: 3, limit: 50 });
      });

      it('should apply defaults for missing values', () => {
        const result = requestSchemas.paginationQuery.parse({});
        expect(result).toEqual({ page: 1, limit: 20 });
      });

      it('should reject invalid string numbers', () => {
        expect(() => requestSchemas.paginationQuery.parse({
          page: 'invalid',
        })).toThrow();

        expect(() => requestSchemas.paginationQuery.parse({
          page: '0',
        })).toThrow();
      });
    });
  });

  describe('responseSchemas', () => {
    describe('conversation', () => {
      it('should validate conversation response', () => {
        const conversation = {
          id: 'conv_123',
          title: 'My Chat',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        };

        const result = responseSchemas.conversation.parse(conversation);
        expect(result).toEqual(conversation);
      });

      it('should reject invalid conversation response', () => {
        expect(() => responseSchemas.conversation.parse({
          id: 'conv_123',
          title: '',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        })).toThrow();
      });
    });

    describe('message', () => {
      it('should validate message response', () => {
        const message = {
          id: 'msg_123',
          conversationId: 'conv_123',
          role: 'user' as const,
          content: 'Hello world',
          model: null,
          createdAt: '2024-01-01T00:00:00.000Z',
        };

        const result = responseSchemas.message.parse(message);
        expect(result).toEqual(message);
      });

      it('should handle model field correctly', () => {
        const messageWithModel = {
          id: 'msg_123',
          conversationId: 'conv_123',
          role: 'assistant' as const,
          content: 'Hello!',
          model: 'gpt-4',
          createdAt: '2024-01-01T00:00:00.000Z',
        };

        const result = responseSchemas.message.parse(messageWithModel);
        expect(result.model).toBe('gpt-4');
      });
    });

    describe('healthCheck', () => {
      it('should validate health check response', () => {
        const health = {
          ok: true,
          now: '2024-01-01T00:00:00.000Z',
        };

        const result = responseSchemas.healthCheck.parse(health);
        expect(result).toEqual(health);
      });
    });

    describe('apiError', () => {
      it('should validate API error response', () => {
        const error = {
          error: 'Something went wrong',
          status: 500,
          details: { code: 'INTERNAL_ERROR' },
        };

        const result = responseSchemas.apiError.parse(error);
        expect(result).toEqual(error);
      });

      it('should handle minimal error response', () => {
        const error = { error: 'Not found' };
        const result = responseSchemas.apiError.parse(error);
        expect(result).toEqual(error);
      });
    });
  });

  describe('String utilities', () => {
    describe('sanitizeInput', () => {
      it('should remove script tags', () => {
        const input = 'Hello <script>alert("XSS")</script> World';
        expect(sanitizeInput(input)).toBe('Hello  World');
      });

      it('should remove javascript: URLs', () => {
        const input = 'Click <a href="javascript:alert()">here</a>';
        expect(sanitizeInput(input)).toBe('Click <a href="alert()">here</a>');
      });

      it('should remove event handlers', () => {
        const input = '<div onclick="alert()">Click me</div>';
        expect(sanitizeInput(input)).toBe('<div>Click me</div>');
      });

      it('should handle multiple threats', () => {
        const input = '<div onload="bad()" onclick="worse()"><script>evil()</script>Safe text</div>';
        const result = sanitizeInput(input);
        expect(result).not.toContain('onload');
        expect(result).not.toContain('onclick');
        expect(result).not.toContain('<script>');
        expect(result).toContain('Safe text');
      });

      it('should trim whitespace', () => {
        expect(sanitizeInput('  hello  ')).toBe('hello');
      });

      it('should handle empty strings', () => {
        expect(sanitizeInput('')).toBe('');
        expect(sanitizeInput('   ')).toBe('');
      });
    });

    describe('normalizeWhitespace', () => {
      it('should replace multiple spaces with single space', () => {
        expect(normalizeWhitespace('hello    world')).toBe('hello world');
      });

      it('should handle tabs and newlines', () => {
        expect(normalizeWhitespace('hello\t\n  world')).toBe('hello world');
      });

      it('should trim leading and trailing whitespace', () => {
        expect(normalizeWhitespace('  hello world  ')).toBe('hello world');
      });

      it('should handle empty strings', () => {
        expect(normalizeWhitespace('')).toBe('');
        expect(normalizeWhitespace('   ')).toBe('');
      });
    });

    describe('truncateString', () => {
      it('should return original string if within limit', () => {
        expect(truncateString('hello', 10)).toBe('hello');
        expect(truncateString('hello', 5)).toBe('hello');
      });

      it('should truncate with ellipsis if over limit', () => {
        expect(truncateString('hello world', 8)).toBe('hello...');
        expect(truncateString('abcdefghijk', 5)).toBe('ab...');
      });

      it('should handle edge cases', () => {
        expect(truncateString('', 5)).toBe('');
        expect(truncateString('abc', 3)).toBe('abc');
        expect(truncateString('abcd', 3)).toBe('...');
      });

      it('should handle very small max lengths', () => {
        expect(truncateString('hello', 0)).toBe('');
        expect(truncateString('hello', 1)).toBe('...');
        expect(truncateString('hello', 2)).toBe('...');
        expect(truncateString('hello', 3)).toBe('...');
        expect(truncateString('hello', 4)).toBe('h...');
      });
    });
  });

  describe('Type definitions', () => {
    it('should properly type ValidationResult', () => {
      const successResult: ValidationResult<{ name: string }> = {
        success: true,
        data: { name: 'test' },
      };

      const errorResult: ValidationResult<{ name: string }> = {
        success: false,
        errors: ['validation failed'],
      };

      expect(successResult.success).toBe(true);
      expect(errorResult.success).toBe(false);

      // Type narrowing should work
      if (successResult.success) {
        expect(successResult.data.name).toBe('test');
      }

      if (!errorResult.success) {
        expect(errorResult.errors).toHaveLength(1);
      }
    });
  });
});