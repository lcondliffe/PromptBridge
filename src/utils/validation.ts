import { z } from 'zod';

/**
 * Common validation schemas
 */
export const schemas = {
  // String validation
  nonEmptyString: z.string().min(1, 'String cannot be empty'),
  email: z.string().email('Invalid email format'),
  url: z.string().url('Invalid URL format'),
  
  // ID validation
  uuid: z.string().uuid('Invalid UUID format'),
  conversationId: z.string().min(1, 'Conversation ID is required'),
  messageId: z.string().min(1, 'Message ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  
  // Content validation
  messageContent: z.string().min(1, 'Message content cannot be empty').max(10000, 'Message content too long'),
  conversationTitle: z.string().min(1, 'Title cannot be empty').max(200, 'Title too long'),
  
  // Role validation
  messageRole: z.enum(['user', 'assistant', 'system'], {
    errorMap: () => ({ message: 'Role must be user, assistant, or system' }),
  }),
  
  // Model validation
  modelName: z.string().min(1, 'Model name is required').optional(),
  
  // Date validation
  isoDateTime: z.string().datetime({ message: 'Invalid ISO datetime format' }),
  
  // Pagination
  pagination: z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
  }),
  
  // Optional fields
  optionalNonEmptyString: z.string().min(1).optional(),
};

/**
 * Common validation functions
 */
export const validators = {
  /**
   * Validate email format
   */
  isValidEmail: (email: string): boolean => {
    try {
      schemas.email.parse(email);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Validate URL format
   */
  isValidUrl: (url: string): boolean => {
    try {
      schemas.url.parse(url);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Validate UUID format
   */
  isValidUuid: (uuid: string): boolean => {
    try {
      schemas.uuid.parse(uuid);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Validate message role
   */
  isValidMessageRole: (role: string): role is 'user' | 'assistant' | 'system' => {
    return ['user', 'assistant', 'system'].includes(role);
  },

  /**
   * Validate conversation title length and content
   */
  isValidConversationTitle: (title: string): boolean => {
    try {
      schemas.conversationTitle.parse(title);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Validate message content length and presence
   */
  isValidMessageContent: (content: string): boolean => {
    try {
      schemas.messageContent.parse(content);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Validate ISO datetime string
   */
  isValidIsoDateTime: (dateTime: string): boolean => {
    try {
      schemas.isoDateTime.parse(dateTime);
      return true;
    } catch {
      return false;
    }
  },
};

/**
 * Validation result type
 */
export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; errors: string[] };

/**
 * Safe validation wrapper that returns success/error result
 */
export function validateSafely<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => 
          err.path.length > 0 
            ? `${err.path.join('.')}: ${err.message}`
            : err.message
        ),
      };
    }
    return {
      success: false,
      errors: ['Validation failed'],
    };
  }
}

/**
 * Extract validation errors as a formatted string
 */
export function getValidationErrorMessage(errors: z.ZodError): string {
  return errors.errors
    .map(err => 
      err.path.length > 0 
        ? `${err.path.join('.')}: ${err.message}`
        : err.message
    )
    .join(', ');
}

/**
 * Common request body validation schemas
 */
export const requestSchemas = {
  createConversation: z.object({
    title: schemas.conversationTitle,
  }),

  createMessage: z.object({
    role: schemas.messageRole,
    content: schemas.messageContent,
    model: schemas.modelName.nullable(),
  }),

  updateConversation: z.object({
    title: schemas.conversationTitle.optional(),
  }),

  paginationQuery: z.object({
    page: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(1)).default('1'),
    limit: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(1).max(100)).default('20'),
  }),
};

/**
 * Response validation schemas
 */
export const responseSchemas = {
  conversation: z.object({
    id: z.string(),
    title: schemas.conversationTitle,
    createdAt: schemas.isoDateTime,
    updatedAt: schemas.isoDateTime,
  }),

  message: z.object({
    id: z.string(),
    conversationId: z.string(),
    role: schemas.messageRole,
    content: schemas.messageContent,
    model: z.string().nullable(),
    createdAt: schemas.isoDateTime,
  }),

  user: z.object({
    id: z.string(),
    email: schemas.email,
    createdAt: schemas.isoDateTime,
    updatedAt: schemas.isoDateTime,
  }),

  healthCheck: z.object({
    ok: z.boolean(),
    now: schemas.isoDateTime,
  }),

  apiError: z.object({
    error: z.string(),
    status: z.number().int().optional(),
    details: z.any().optional(),
  }),
};

/**
 * Sanitize input by removing dangerous characters
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/\son\w+=["'][^"']*["']/gi, '') // Remove event handlers with quotes
    .replace(/\son\w+=\w+/gi, '') // Remove event handlers without quotes
    .trim();
}

/**
 * Normalize whitespace in strings
 */
export function normalizeWhitespace(input: string): string {
  return input
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .trim();
}

/**
 * Truncate string to specified length with ellipsis
 */
export function truncateString(input: string, maxLength: number): string {
  if (input.length <= maxLength) {
    return input;
  }
  if (maxLength <= 3) {
    return maxLength <= 0 ? '' : '...';
  }
  return input.substring(0, maxLength - 3) + '...';
}
