import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '../../auth/middleware';

// In-memory storage for sync status (in production, use a database)
const syncStatusMap = new Map<string, {
  lastSyncAt: string;
  tracksUploaded: number;
  tracksDownloaded: number;
  totalStorage: number;
}>();

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const status = syncStatusMap.get(auth.userId) || {
      lastSyncAt: '',
      tracksUploaded: 0,
      tracksDownloaded: 0,
      totalStorage: 0,
    };

    return NextResponse.json(status);
  } catch (error: any) {
    console.error('Error getting sync status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get sync status' },
      { status: 500 }
    );
  }
}

