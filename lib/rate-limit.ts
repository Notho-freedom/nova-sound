/**
 * Rate limiting utilities for API routes
 * 
 * Note: In a production environment, consider using Redis or a dedicated
 * rate limiting service for distributed rate limiting.
 */

import { NextRequest } from 'next/server';

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum number of requests per window
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class MemoryStore {
  private store: RateLimitStore = {};
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      Object.keys(this.store).forEach((key) => {
        if (this.store[key].resetTime < now) {
          delete this.store[key];
        }
      });
    }, 60000);
  }

  increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now();
    const entry = this.store[key];

    if (!entry || entry.resetTime < now) {
      // Create new entry or reset expired entry
      this.store[key] = {
        count: 1,
        resetTime: now + windowMs,
      };
      return this.store[key];
    }

    // Increment existing entry
    entry.count++;
    return entry;
  }

  reset(key: string): void {
    delete this.store[key];
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store = {};
  }
}

const memoryStore = new MemoryStore();

/**
 * Create a rate limiter function
 */
export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later.',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  return async (identifier: string, isSuccess: boolean = true): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    message?: string;
  }> => {
    // Skip if configured
    if (skipSuccessfulRequests && isSuccess) {
      return { allowed: true, remaining: max, resetTime: Date.now() + windowMs };
    }
    if (skipFailedRequests && !isSuccess) {
      return { allowed: true, remaining: max, resetTime: Date.now() + windowMs };
    }

    const result = memoryStore.increment(identifier, windowMs);

    if (result.count > max) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: result.resetTime,
        message,
      };
    }

    return {
      allowed: true,
      remaining: max - result.count,
      resetTime: result.resetTime,
    };
  };
}

/**
 * Get client identifier from request
 */
export function getClientIdentifier(request: NextRequest): string {
  // Try to get user ID from auth token
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    // In a real implementation, decode the token to get user ID
    // For now, use a hash of the token (first 20 chars for identification)
    return `user:${authHeader.substring(0, 20)}`;
  }

  // Fallback to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown';
  return `ip:${ip}`;
}

/**
 * Common rate limiters
 */
export const rateLimiters = {
  // General API rate limiter: 100 requests per 15 minutes
  general: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests. Please try again in 15 minutes.',
  }),

  // Strict rate limiter: 10 requests per minute
  strict: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: 'Too many requests. Please try again in a minute.',
  }),

  // Upload rate limiter: 5 uploads per hour
  upload: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: 'Upload limit exceeded. Please try again in an hour.',
  }),

  // Auth rate limiter: 5 attempts per 15 minutes
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
    skipSuccessfulRequests: true,
  }),
};

