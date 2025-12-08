import express from "express";
import { AuthenticatedRequest } from "../middleware/auth.js";

const router = express.Router();

// In-memory storage for sync status (in production, use a database)
const syncStatusMap = new Map<string, {
  lastSyncAt: string;
  tracksUploaded: number;
  tracksDownloaded: number;
  totalStorage: number;
}>();

/**
 * Get sync status
 * GET /api/sync/status
 */
router.get("/status", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const status = syncStatusMap.get(userId) || {
      lastSyncAt: "",
      tracksUploaded: 0,
      tracksDownloaded: 0,
      totalStorage: 0,
    };

    res.json(status);
  } catch (error: any) {
    console.error("Error getting sync status:", error);
    res.status(500).json({ error: error.message || "Failed to get sync status" });
  }
});

/**
 * Start sync
 * POST /api/sync/start
 */
router.post("/start", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Update sync status
    const currentStatus = syncStatusMap.get(userId) || {
      lastSyncAt: "",
      tracksUploaded: 0,
      tracksDownloaded: 0,
      totalStorage: 0,
    };

    syncStatusMap.set(userId, {
      ...currentStatus,
      lastSyncAt: new Date().toISOString(),
    });

    res.json({ success: true, lastSyncAt: syncStatusMap.get(userId)!.lastSyncAt });
  } catch (error: any) {
    console.error("Error starting sync:", error);
    res.status(500).json({ error: error.message || "Failed to start sync" });
  }
});

export { router as syncRoutes };

