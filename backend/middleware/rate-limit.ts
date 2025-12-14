import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

/**
 * Get client identifier from request
 */
export function getClientIdentifier(req: Request): string {
  // Try to get user ID from auth token
  const authHeader = req.headers.authorization;
  if (authHeader) {
    // Use a hash of the token (first 20 chars for identification)
    return `user:${authHeader.substring(0, 20)}`;
  }

  // Fallback to IP address
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded 
    ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim())
    : (req.headers['x-real-ip'] as string) || req.ip || 'unknown';
  return `ip:${ip}`;
}

/**
 * Create a rate limiter middleware
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: options.message || 'Too many requests, please try again later.',
    keyGenerator: options.keyGenerator || getClientIdentifier,
    standardHeaders: true,
    legacyHeaders: false,
  });
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
  }),
};

