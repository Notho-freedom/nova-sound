/**
 * Rate limiting utilities for API routes
 * 
 * Note: In a production environment, consider using Redis or a dedicated
 * rate limiting service for distributed rate limiting.
 */

import { NextRequest } from 'next/server';
import { redis } from '@/lib/redis';

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum number of requests per window
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

function rateLimitKey(identifier: string, windowMs: number): string {
  return `ratelimit:${identifier}:${windowMs}`;
}

async function incrementRateLimit(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
  if (!redis) {
    // If redis is not available, allow all requests
    return { count: 0, resetTime: Date.now() + windowMs };
  }
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, Math.ceil(windowMs / 1000));
  }

  const ttl = await redis.ttl(key);
  const resetTime = Date.now() + Math.max(0, ttl) * 1000;

  return { count, resetTime };
}

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

    const result = await incrementRateLimit(rateLimitKey(identifier, windowMs), windowMs);

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

