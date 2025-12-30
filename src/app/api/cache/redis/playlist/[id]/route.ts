/**
 * Playlist Cache API Endpoint
 * GET  /api/cache/redis/playlist/:id
 * PUT  /api/cache/redis/playlist/:id
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
    const playlist = await redisCacheServer.getPlaylist(params.id);
    if (!playlist) {
      return NextResponse.json({ data: null }, { status: 404 });
    }
    return NextResponse.json({ data: playlist });
  } catch (error) {
    console.error('[API] Playlist GET error:', error);
    return NextResponse.json({ error: 'Failed to get playlist' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  await ensureRedisConnected();
  try {
    const body = await req.json();
    const playlist = body.data || body;
    await redisCacheServer.setPlaylist(params.id, playlist);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Playlist PUT error:', error);
    return NextResponse.json({ error: 'Failed to set playlist' }, { status: 500 });
  }
}
