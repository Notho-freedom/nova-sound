/**
 * Consolidated Redis Cache API Routes
 * 
 * NOTE: These endpoints require Redis to be configured on the server.
 * For production Vercel deployment without Redis, this gracefully returns unavailable.
 * The client-side RedisCacheService automatically falls back to localStorage in this case.
 * 
 * Supported paths (when Redis is available):
 * - GET/PUT  /api/cache/redis/video/[id]
 * - GET/PUT  /api/cache/redis/search
 * - GET/PUT  /api/cache/redis/playlist/[id]
 * - GET/PUT  /api/cache/redis/playlist-videos
 * - GET/PUT  /api/cache/redis/track/[id]
 * - GET/PUT  /api/cache/redis/tracks
 * - GET      /api/cache/redis?action=health
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Health check endpoint
 * Returns 503 if Redis is not configured (expected behavior)
 */
export async function GET(req: NextRequest) {
  // If Redis is not configured, return service unavailable
  // This is expected on Vercel without Redis add-on
  // Client will gracefully degrade to localStorage only
  const hasRedisConfig = !!process.env.REDIS_HOST;
  
  if (!hasRedisConfig) {
    return NextResponse.json(
      { status: 'unavailable', redis: 'not-configured', message: 'Redis not available on this deployment' },
      { status: 503 }
    );
  }

  // If Redis is configured, attempt connection
  try {
    // Dynamic import to avoid errors when redis package isn't needed
    const { redisCacheServer } = await import('@/services/redis-cache-server');
    await redisCacheServer.connect();
    const isHealthy = await redisCacheServer.health();
    
    return NextResponse.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      redis: isHealthy ? 'connected' : 'disconnected'
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'unhealthy', redis: 'disconnected', error: String(error) },
      { status: 503 }
    );
  }
}

/**
 * PUT endpoint for cache writes
 * Returns 503 if Redis is not configured
 * Handles aborted requests gracefully (499)
 */
export async function PUT(req: NextRequest) {
  // Check if request was aborted before processing
  if (req.signal.aborted) {
    console.debug('[Redis API] Request aborted before processing');
    return new NextResponse('Client closed request', { status: 499 });
  }

  const hasRedisConfig = !!process.env.REDIS_HOST;
  
  if (!hasRedisConfig) {
    // Silently accept but don't store - graceful degradation
    return NextResponse.json(
      { success: false, reason: 'Redis not available' },
      { status: 503 }
    );
  }

  // If Redis is configured, attempt write
  try {
    const { redisCacheServer } = await import('@/services/redis-cache-server');
    await redisCacheServer.connect();
    
    // Check abort again before Redis operation
    if (req.signal.aborted) {
      console.debug('[Redis API] Request aborted during processing');
      return new NextResponse('Client closed request', { status: 499 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Handle specific error cases
    if (error?.code === 'ECONNRESET' || error?.name === 'AbortError') {
      console.debug('[Redis API] Connection aborted:', error.code || error.name);
      return new NextResponse('Client closed request', { status: 499 });
    }
    
    console.error('[Redis API] Write error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 503 }
    );
  }
}

/**
 * HEAD endpoint for connection testing
 */
export async function HEAD(req: NextRequest) {
  const hasRedisConfig = !!process.env.REDIS_HOST;
  
  if (!hasRedisConfig) {
    return new NextResponse(null, { status: 503 });
  }

  try {
    const { redisCacheServer } = await import('@/services/redis-cache-server');
    await redisCacheServer.connect();
    const isHealthy = await redisCacheServer.health();
    return new NextResponse(null, { status: isHealthy ? 200 : 503 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
