/**
 * API Routes for Redis Cache Management (Generic endpoints)
 * Handles: /api/cache/redis/health, /api/cache/redis/stats, /api/cache/redis/clear, /api/cache/redis/migrate
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

// GET /api/cache/redis?action=health|stats|entries
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  if (action === 'health') {
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

  if (action === 'stats') {
    await ensureRedisConnected();
    try {
      const stats = await redisCacheServer.getStats();
      return NextResponse.json(stats);
    } catch (error) {
      console.error('[API] Stats error:', error);
      return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
    }
  }

  if (action === 'entries') {
    await ensureRedisConnected();
    try {
      const pattern = searchParams.get('pattern') || '*';
      const entries = await redisCacheServer.getAllEntries(pattern);
      return NextResponse.json(entries);
    } catch (error) {
      console.error('[API] Get entries error:', error);
      return NextResponse.json({ error: 'Failed to get entries' }, { status: 500 });
    }
  }

  // Default health check for root endpoint
  await ensureRedisConnected();
  try {
    const isHealthy = await redisCacheServer.health();
    return NextResponse.json({ 
      status: isHealthy ? 'healthy' : 'unhealthy',
      redis: isHealthy ? 'connected' : 'disconnected'
    });
  } catch (error) {
    return NextResponse.json({ status: 'unhealthy', redis: 'disconnected' }, { status: 503 });
  }
}

// POST /api/cache/redis?action=clear|migrate
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  // Clear cache
  if (action === 'clear') {
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

  // Migrate from localStorage
  if (action === 'migrate') {
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

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
