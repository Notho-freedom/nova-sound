/**
 * Playlist Videos Cache API Endpoint
 * GET  /api/cache/redis/playlist-videos?key=playlist_videos:playlistId
 * PUT  /api/cache/redis/playlist-videos
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
    const key = searchParams.get('key');
    if (!key) {
      return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
    }

    const playlistId = key.replace('playlist_videos:', '');
    const videos = await redisCacheServer.getPlaylistVideos(playlistId);
    if (!videos) {
      return NextResponse.json({ data: null }, { status: 404 });
    }
    return NextResponse.json({ data: videos });
  } catch (error) {
    console.error('[API] Playlist videos GET error:', error);
    return NextResponse.json({ error: 'Failed to get playlist videos' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  await ensureRedisConnected();
  try {
    const body = await req.json();
    const { key, data } = body;
    if (!key) {
      return NextResponse.json({ error: 'Missing key' }, { status: 400 });
    }

    const playlistId = key.replace('playlist_videos:', '');
    await redisCacheServer.setPlaylistVideos(playlistId, data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Playlist videos PUT error:', error);
    return NextResponse.json({ error: 'Failed to set playlist videos' }, { status: 500 });
  }
}
