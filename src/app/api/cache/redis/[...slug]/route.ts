/**
 * Catch-all route for Redis cache API with graceful degradation
 * Handles all /api/cache/redis/* paths
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { slug?: string[] } }) {
  // Always return 503 if Redis is not configured
  const hasRedisConfig = !!process.env.REDIS_HOST;
  
  return NextResponse.json(
    {
      status: 'unavailable',
      redis: 'not-configured',
      message: 'Redis cache not available - continuing with local cache only'
    },
    { status: 503 }
  );
}

export async function PUT(req: NextRequest, { params }: { params: { slug?: string[] } }) {
  // Silently accept PUT requests when Redis is unavailable
  // Client-side will use localStorage as fallback
  return NextResponse.json(
    { success: false, reason: 'Redis not available - using localStorage' },
    { status: 503 }
  );
}

export async function POST(req: NextRequest, { params }: { params: { slug?: string[] } }) {
  return NextResponse.json(
    { success: false, reason: 'Redis not available' },
    { status: 503 }
  );
}
