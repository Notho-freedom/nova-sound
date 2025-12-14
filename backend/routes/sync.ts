import { Router, Request, Response } from 'express';
import { verifyAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { rateLimiters } from '../middleware/rate-limit.js';

const router = Router();

// In-memory storage for sync status (in production, use a database)
const syncStatusMap = new Map<string, {
  lastSyncAt: string;
  tracksUploaded: number;
  tracksDownloaded: number;
  totalStorage: number;
}>();

// POST /api/sync/start
router.post('/start', rateLimiters.general, verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Update sync status
    const currentStatus = syncStatusMap.get(req.userId!) || {
      lastSyncAt: '',
      tracksUploaded: 0,
      tracksDownloaded: 0,
      totalStorage: 0,
    };

    syncStatusMap.set(req.userId!, {
      ...currentStatus,
      lastSyncAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      lastSyncAt: syncStatusMap.get(req.userId!)!.lastSyncAt,
    });
  } catch (error: any) {
    console.error('Error starting sync:', error);
    res.status(500).json({ error: error.message || 'Failed to start sync' });
  }
});

// GET /api/sync/status
router.get('/status', rateLimiters.general, verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = syncStatusMap.get(req.userId!) || {
      lastSyncAt: '',
      tracksUploaded: 0,
      tracksDownloaded: 0,
      totalStorage: 0,
    };

    res.json(status);
  } catch (error: any) {
    console.error('Error getting sync status:', error);
    res.status(500).json({ error: error.message || 'Failed to get sync status' });
  }
});

export default router;

