/**
 * API Routes for Redis Cache Management
 * 
 * Endpoints for syncing client-side cache with Redis
 * Paths:
 * - GET/PUT  /api/cache/redis/video/:id
 * - GET/PUT  /api/cache/redis/search
 * - GET/PUT  /api/cache/redis/playlist/:id
 * - GET/PUT  /api/cache/redis/playlist-videos
 * - GET/PUT  /api/cache/redis/track/:id
 * - PUT      /api/cache/redis/tracks
 * - POST     /api/cache/redis/clear
 * - GET      /api/cache/redis/health
 * - GET      /api/cache/redis/stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { redisCacheServer } from '@/services/redis-cache-server';

// Ensure Redis is connected on module load
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

// ==================== VIDEO CACHE ====================

export async function getVideo(req: NextRequest, { params }: { params: { id: string } }) {
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

export async function putVideo(req: NextRequest, { params }: { params: { id: string } }) {
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

// ==================== SEARCH CACHE ====================

export async function getSearch(req: NextRequest) {
  await ensureRedisConnected();
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');
    if (!key) {
      return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
    }

    const query = key.replace('search:', '');
    const results = await redisCacheServer.getSearch(query);
    if (!results) {
      return NextResponse.json({ data: null }, { status: 404 });
    }
    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('[API] Search GET error:', error);
    return NextResponse.json({ error: 'Failed to get search results' }, { status: 500 });
  }
}

export async function putSearch(req: NextRequest) {
  await ensureRedisConnected();
  try {
    const body = await req.json();
    const { key, data } = body;
    if (!key) {
      return NextResponse.json({ error: 'Missing key' }, { status: 400 });
    }

    const query = key.replace('search:', '');
    await redisCacheServer.setSearch(query, data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Search PUT error:', error);
    return NextResponse.json({ error: 'Failed to set search results' }, { status: 500 });
  }
}

// ==================== PLAYLIST CACHE ====================

export async function getPlaylist(req: NextRequest, { params }: { params: { id: string } }) {
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

export async function putPlaylist(req: NextRequest, { params }: { params: { id: string } }) {
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

// ==================== PLAYLIST VIDEOS CACHE ====================

export async function getPlaylistVideos(req: NextRequest) {
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

export async function putPlaylistVideos(req: NextRequest) {
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

// ==================== TRACK CACHE ====================

export async function getTrack(req: NextRequest, { params }: { params: { id: string } }) {
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

export async function putTrack(req: NextRequest, { params }: { params: { id: string } }) {
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

export async function getTracks(req: NextRequest) {
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

export async function putTracks(req: NextRequest) {
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

// ==================== CACHE MANAGEMENT ====================

export async function clearCache(req: NextRequest) {
  // Only allow from admin or authorized requests
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.includes(process.env.CACHE_ADMIN_KEY || 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureRedisConnected();
  try {
    await redisCacheServer.clear();
    return NextResponse.json({ success: true, message: 'Cache cleared' });
  } catch (error) {
    console.error('[API] Clear cache error:', error);
    return NextResponse.json({ error: 'Failed to clear cache' }, { status: 500 });
  }
}

export async function healthCheck(req: NextRequest) {
  await ensureRedisConnected();
  try {
    const isHealthy = await redisCacheServer.health();
    if (isHealthy) {
      return NextResponse.json({ status: 'healthy', redis: 'connected' });
    } else {
      return NextResponse.json({ status: 'unhealthy', redis: 'disconnected' }, { status: 503 });
    }
  } catch (error) {
    console.error('[API] Health check error:', error);
    return NextResponse.json({ status: 'unhealthy', error: String(error) }, { status: 503 });
  }
}

export async function getStats(req: NextRequest) {
  await ensureRedisConnected();
  try {
    const stats = await redisCacheServer.getStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('[API] Stats error:', error);
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}

export async function getEntries(req: NextRequest) {
  await ensureRedisConnected();
  try {
    const { searchParams } = new URL(req.url);
    const pattern = searchParams.get('pattern') || '*';
    const entries = await redisCacheServer.getAllEntries(pattern);
    return NextResponse.json(entries);
  } catch (error) {
    console.error('[API] Get entries error:', error);
    return NextResponse.json({ error: 'Failed to get entries' }, { status: 500 });
  }
}

export async function migrate(req: NextRequest) {
  // Only allow from admin
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.includes(process.env.CACHE_ADMIN_KEY || 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureRedisConnected();
  try {
    const data = await req.json();
    const result = await redisCacheServer.migrateFromLocalStorage(data);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Migration error:', error);
    return NextResponse.json({ error: 'Failed to migrate' }, { status: 500 });
  }
}
