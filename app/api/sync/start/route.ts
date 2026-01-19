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
    const raw = await redis.get(syncStatusKey(userId));
    if (!raw) return null;
    return JSON.parse(raw as string) as SyncStatus;
  } catch {
    return null;
  }
}

async function setSyncStatus(userId: string, status: SyncStatus): Promise<void> {
  try {
    await redis.setex(syncStatusKey(userId), 60 * 60 * 24, JSON.stringify(status));
  } catch {
    // Non-blocking cache failure
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Update sync status
    const currentStatus = (await getSyncStatus(auth.userId)) || {
      lastSyncAt: '',
      tracksUploaded: 0,
      tracksDownloaded: 0,
      totalStorage: 0,
    };

    const updatedStatus = {
      ...currentStatus,
      lastSyncAt: new Date().toISOString(),
    };

    await setSyncStatus(auth.userId, updatedStatus);

    return NextResponse.json({
      success: true,
      lastSyncAt: updatedStatus.lastSyncAt,
    });
  } catch (error: unknown) {
    console.error('Error starting sync:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start sync' },
      { status: 500 }
    );
  }
}

