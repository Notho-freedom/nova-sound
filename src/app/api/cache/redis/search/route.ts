/**
 * Search Cache API Endpoint
 * GET  /api/cache/redis/search?key=search:query
 * PUT  /api/cache/redis/search
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

export async function PUT(req: NextRequest) {
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
