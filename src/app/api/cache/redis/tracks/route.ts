/**
 * Tracks Cache API Endpoint (Multiple tracks)
 * GET  /api/cache/redis/tracks?ids=id1,id2,id3
 * PUT  /api/cache/redis/tracks
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

export async function GET(req: NextRequest) {
  await ensureRedisConnected();
  try {
    const { searchParams } = new URL(req.url);
    const ids = searchParams.get('ids')?.split(',') || [];
    if (ids.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const tracks = await redisCacheServer.getTracks(ids);
    return NextResponse.json(tracks);
  } catch (error) {
    console.error('[API] Tracks GET error:', error);
    return NextResponse.json({ error: 'Failed to get tracks' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  await ensureRedisConnected();
  try {
    const entries = await req.json();
    const tracks = entries.map((e: any) => e.data || e);
    await redisCacheServer.setTracks(tracks);
    return NextResponse.json({ success: true, count: tracks.length });
  } catch (error) {
    console.error('[API] Tracks PUT error:', error);
    return NextResponse.json({ error: 'Failed to set tracks' }, { status: 500 });
  }
}
