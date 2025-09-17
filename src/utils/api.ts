/**
 * API Error class for handling HTTP errors with status codes and response bodies
 */
export class ApiError extends Error {
  public readonly name = 'ApiError';
  public readonly status: number;
  public readonly body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;

    // Ensure prototype chain is correct
    Object.setPrototypeOf(this, ApiError.prototype);

    // Capture stack trace if available
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  /**
   * Make ApiError serializable to JSON
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      body: this.body,
      stack: this.stack,
    };
  }
}

/**
 * Create an ApiError from a fetch Response object
 * @param response - The HTTP response object
 * @returns Promise that resolves to an ApiError
 */
export async function createApiError(response: Response): Promise<ApiError> {
  let body: unknown;
  
  try {
    body = await response.text();
  } catch {
    // If we can't read the response body, leave it undefined
    body = undefined;
  }

  const message = body || `Request failed: ${response.status}`;
  
  return new ApiError(message, response.status, body);
}

/**
 * Handle various types of errors and normalize them to Error instances
 * @param error - The error to handle (can be any type)
 * @returns A normalized Error instance
 */
export function handleApiError(error: unknown): Error {
  // If it's already an Error instance (including ApiError), return as-is
  if (error instanceof Error) {
    return error;
  }

  // Handle string errors
  if (typeof error === 'string') {
    return new Error(error);
  }

  // Handle null/undefined
  if (error == null) {
    return new Error('Unknown error');
  }

  // Handle objects with message property
  if (typeof error === 'object' && error.message) {
    return new Error(error.message);
  }

  // Handle other objects by stringifying
  if (typeof error === 'object') {
    try {
      const message = JSON.stringify(error);
      if (message && message !== '{}') {
        return new Error(message);
      }
    } catch {
      // JSON.stringify failed (e.g., circular reference)
      return new Error('Unknown error');
    }
  }

  // Handle primitive values
  return new Error(String(error));
}

/**
 * Type guard to check if an error is an ApiError
 * @param error - The error to check
 * @returns True if the error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Extract error message from various error types
 * @param error - The error to extract message from
 * @returns The error message string
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && error.message) {
    return String(error.message);
  }

  return 'Unknown error';
}

/**
 * Create a standardized error response structure
 * @param error - The error to convert
 * @returns Standardized error object
 */
export function createErrorResponse(error: unknown): {
  error: string;
  status?: number;
  details?: unknown;
} {
  if (isApiError(error)) {
    return {
      error: error.message,
      status: error.status,
      details: error.body,
    };
  }

  return {
    error: getErrorMessage(error),
  };
}