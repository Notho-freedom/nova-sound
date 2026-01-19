import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '../../auth/middleware';
import { redis } from '@/lib/redis';

type SyncStatus = {
  lastSyncAt: string;
  tracksUploaded: number;
  tracksDownloaded: number;
  totalStorage: number;
};

function syncStatusKey(userId: string): string {
  return `sync:status:${userId}`;
}

async function getSyncStatus(userId: string): Promise<SyncStatus | null> {
  try {
    if (!redis) return null;
    const raw = await redis.get(syncStatusKey(userId));
    if (!raw) return null;
    return JSON.parse(raw as string) as SyncStatus;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const status = (await getSyncStatus(auth.userId)) || {
      lastSyncAt: '',
      tracksUploaded: 0,
      tracksDownloaded: 0,
      totalStorage: 0,
    };

    return NextResponse.json(status);
  } catch (error: unknown) {
    console.error('Error getting sync status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get sync status' },
      { status: 500 }
    );
  }
}

