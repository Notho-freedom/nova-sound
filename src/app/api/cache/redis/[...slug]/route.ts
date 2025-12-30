/**
 * Catch-all route for Redis cache API with graceful degradation
 * Handles all /api/cache/redis/* paths with proper abort handling
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { slug?: string[] } }) {
  // Check if request was aborted
  if (req.signal.aborted) {
    return new NextResponse('Client closed request', { status: 499 });
  }

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
  // Check if request was aborted before processing
  if (req.signal.aborted) {
    console.debug('[Redis API] PUT request aborted before processing');
    return new NextResponse('Client closed request', { status: 499 });
  }

  try {
    // Check abort again before responding
    if (req.signal.aborted) {
      console.debug('[Redis API] PUT request aborted during processing');
      return new NextResponse('Client closed request', { status: 499 });
    }

    // Silently accept PUT requests when Redis is unavailable
    // Client-side will use localStorage as fallback
    return NextResponse.json(
      { success: false, reason: 'Redis not available - using localStorage' },
      { status: 503 }
    );
  } catch (error: any) {
    // Handle specific error cases
    if (error?.code === 'ECONNRESET' || error?.name === 'AbortError') {
      console.debug('[Redis API] Connection aborted:', error.code || error.name);
      return new NextResponse('Client closed request', { status: 499 });
    }
    
    console.error('[Redis API] PUT error:', error);
    return NextResponse.json(
      { success: false, reason: 'Redis error', error: String(error) },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest, { params }: { params: { slug?: string[] } }) {
  // Check if request was aborted
  if (req.signal.aborted) {
    return new NextResponse('Client closed request', { status: 499 });
  }

  return NextResponse.json(
    { success: false, reason: 'Redis not available' },
    { status: 503 }
  );
}
