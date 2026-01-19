/**
 * Redis Cache Batch API - Tracks
 * 
 * Handles batch operations for tracks to avoid request storms
 * Uses Redis pipeline for efficient multi-key operations
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/cache/redis/batch/tracks?ids=id1,id2,id3
 * Batch retrieve multiple tracks
 */
export async function GET(req: NextRequest) {
  // Check if request was aborted
  if (req.signal.aborted) {
    return new NextResponse(null, { status: 499 });
  }

  const isRedisEnabled = process.env.REDIS_ENABLED !== 'false';
  const hasRedisConfig = !!process.env.REDIS_HOST;
  
  if (!isRedisEnabled || !hasRedisConfig) {
    return NextResponse.json(
      { success: false, tracks: [], reason: isRedisEnabled ? 'Redis not configured' : 'Redis disabled' },
      { status: 503 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get('ids');
    
    if (!idsParam) {
      return NextResponse.json(
        { success: false, error: 'Missing ids parameter' },
        { status: 400 }
      );
    }

    const trackIds = idsParam.split(',').filter(Boolean);
    
    if (trackIds.length === 0) {
      return NextResponse.json({ success: true, tracks: [] });
    }

    // Check abort again before Redis operation
    if (req.signal.aborted) {
      return new NextResponse(null, { status: 499 });
    }

    const { redisCacheServer } = await import('@/services/redis-cache-server');
    await redisCacheServer.connect();
    
    const tracks = await redisCacheServer.getTracks(trackIds);
    
    return NextResponse.json({
      success: true,
      tracks,
      count: tracks.length,
      requested: trackIds.length
    });
  } catch (error: any) {
    // Silently handle connection abort errors
    if (error?.code === 'ECONNRESET' || error?.name === 'AbortError' || req.signal.aborted) {
      return new NextResponse(null, { status: 499 });
    }
    
    console.error('[Redis Batch] GET error:', error);
    return NextResponse.json(
      { success: false, tracks: [], error: String(error) },
      { status: 503 }
    );
  }
}

/**
 * PUT /api/cache/redis/batch/tracks
 * Batch store multiple tracks using Redis pipeline
 */
export async function PUT(req: NextRequest) {
  // Check if request was aborted
  if (req.signal.aborted) {
    return new NextResponse(null, { status: 499 });
  }

  const isRedisEnabled = process.env.REDIS_ENABLED !== 'false';
  const hasRedisConfig = !!process.env.REDIS_HOST;
  
  if (!isRedisEnabled || !hasRedisConfig) {
    return NextResponse.json(
      { success: false, reason: isRedisEnabled ? 'Redis not configured' : 'Redis disabled' },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    
    if (!Array.isArray(body) || body.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Body must be a non-empty array of tracks' },
        { status: 400 }
      );
    }

    // Check abort again before Redis operation
    if (req.signal.aborted) {
      return new NextResponse(null, { status: 499 });
    }

    const { redisCacheServer } = await import('@/services/redis-cache-server');
    await redisCacheServer.connect();
    
    // Use pipeline for batch write
    await redisCacheServer.setTracks(body);
    
    return NextResponse.json({
      success: true,
      count: body.length,
      message: `Batch stored ${body.length} tracks via pipeline`
    });
  } catch (error: unknown) {
    // Silently handle connection abort errors
    const err = error as { code?: string; name?: string; message?: string };
    if (err?.code === 'ECONNRESET' || err?.name === 'AbortError' || req.signal.aborted) {
      return new NextResponse(null, { status: 499 });
    }
    
    console.error('[Redis Batch] PUT error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 503 }
    );
  }
}
