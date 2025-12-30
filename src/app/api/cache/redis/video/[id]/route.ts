/**
 * Video Cache API Endpoint
 * GET  /api/cache/redis/video/:id
 * PUT  /api/cache/redis/video/:id
 */

import { NextRequest, NextResponse } from 'next/server';
import { redisCacheServer } from '@/services/redis-cache-server';

let redisInitialized = false;

async function ensureRedisConnected() {
  if (!redisInitialized) {
    try {
      await redisCacheServer.connect();
      redisInitialized = true;
    } catch (error) {
      console.error('[API] Failed to connect to Redis:', error);
    }
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  await ensureRedisConnected();
  try {
    const video = await redisCacheServer.getVideo(params.id);
    if (!video) {
      return NextResponse.json({ data: null }, { status: 404 });
    }
    return NextResponse.json({ data: video });
  } catch (error) {
    console.error('[API] Video GET error:', error);
    return NextResponse.json({ error: 'Failed to get video' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  await ensureRedisConnected();
  try {
    const body = await req.json();
    const video = body.data || body;
    await redisCacheServer.setVideo(params.id, video);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Video PUT error:', error);
    return NextResponse.json({ error: 'Failed to set video' }, { status: 500 });
  }
}
