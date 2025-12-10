import { z } from 'zod';

/**
 * Validation schemas for API routes
 */

// File upload validation
export const fileUploadSchema = z.object({
  file: z.instanceof(File, {
    message: 'Invalid file object',
  }),
});

// Stripe checkout session
export const stripeCheckoutSchema = z.object({
  priceId: z.string().min(1, 'Price ID is required'),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

// Stripe portal session
export const stripePortalSchema = z.object({
  returnUrl: z.string().url().optional(),
});

// File deletion
export const fileDeleteSchema = z.object({
  fileId: z.string().min(1, 'File ID is required'),
  cloudProvider: z.enum(['local', 'bunny']).optional(),
});

// Sync start
export const syncStartSchema = z.object({
  force: z.boolean().optional().default(false),
});

// Error response helper
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export class ValidationError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate request body with Zod schema
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: ApiError } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: firstError.message || 'Validation failed',
          details: error.errors,
        },
      };
    }
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'Validation failed',
      },
    };
  }
}

/**
 * Type guard to check if validation failed
 */
export function isValidationError<T>(
  result: { success: true; data: T } | { success: false; error: ApiError }
): result is { success: false; error: ApiError } {
  return !result.success;
}

/**
 * Validate query parameters
 */
export function validateQuery<T>(
  schema: z.ZodSchema<T>,
  searchParams: URLSearchParams
): { success: true; data: T } | { success: false; error: ApiError } {
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  return validateRequest(schema, params);
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const;

/**
 * Create standardized error response
 */
export function createErrorResponse(
  code: string,
  message: string,
  status: number = 400,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details,
      },
    },
    { status }
  );
}

// Import NextResponse for type
import { NextResponse } from 'next/server';

