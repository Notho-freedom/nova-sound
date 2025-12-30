/**
 * Track Cache API Endpoint
 * GET  /api/cache/redis/track/:id
 * PUT  /api/cache/redis/track/:id
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
    const track = await redisCacheServer.getTrack(params.id);
    if (!track) {
      return NextResponse.json({ data: null }, { status: 404 });
    }
    return NextResponse.json({ data: track });
  } catch (error) {
    console.error('[API] Track GET error:', error);
    return NextResponse.json({ error: 'Failed to get track' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  await ensureRedisConnected();
  try {
    const body = await req.json();
    const track = body.data || body;
    await redisCacheServer.setTrack(params.id, track);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Track PUT error:', error);
    return NextResponse.json({ error: 'Failed to set track' }, { status: 500 });
  }
}
