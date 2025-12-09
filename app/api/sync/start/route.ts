import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '../../auth/middleware';

// In-memory storage for sync status (in production, use a database)
const syncStatusMap = new Map<string, {
  lastSyncAt: string;
  tracksUploaded: number;
  tracksDownloaded: number;
  totalStorage: number;
}>();

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Update sync status
    const currentStatus = syncStatusMap.get(auth.userId) || {
      lastSyncAt: '',
      tracksUploaded: 0,
      tracksDownloaded: 0,
      totalStorage: 0,
    };

    syncStatusMap.set(auth.userId, {
      ...currentStatus,
      lastSyncAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      lastSyncAt: syncStatusMap.get(auth.userId)!.lastSyncAt,
    });
  } catch (error: any) {
    console.error('Error starting sync:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start sync' },
      { status: 500 }
    );
  }
}

