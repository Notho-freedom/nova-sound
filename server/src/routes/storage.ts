import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { AuthenticatedRequest } from "../middleware/auth.js";

const router = express.Router();

// Configure storage directory
const STORAGE_DIR = process.env.STORAGE_DIR || "./storage";
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB default

// Ensure storage directory exists
(async () => {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
    await fs.mkdir(path.join(STORAGE_DIR, "users"), { recursive: true });
  } catch (error) {
    console.error("Error creating storage directory:", error);
  }
})();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) {
      return cb(new Error("User not authenticated"), "");
    }
    const userDir = path.join(STORAGE_DIR, "users", userId);
    await fs.mkdir(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
});

/**
 * Upload file
 * POST /api/storage/upload
 */
router.post("/upload", upload.single("file"), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileId = path.basename(req.file.filename, path.extname(req.file.filename));
    const fileUrl = `/api/storage/download/${fileId}`;

    res.json({
      id: fileId,
      url: fileUrl,
      size: req.file.size,
      filename: req.file.originalname,
    });
  } catch (error: any) {
    console.error("Error uploading file:", error);
    res.status(500).json({ error: error.message || "Failed to upload file" });
  }
});

/**
 * Download file
 * GET /api/storage/download/:fileId
 */
router.get("/download/:fileId", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { fileId } = req.params;
    const userDir = path.join(STORAGE_DIR, "users", userId);

    // Find file by ID (search in user directory)
    const files = await fs.readdir(userDir);
    const file = files.find((f) => f.startsWith(fileId));

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    const filePath = path.join(userDir, file);
    res.download(filePath);
  } catch (error: any) {
    console.error("Error downloading file:", error);
    res.status(500).json({ error: error.message || "Failed to download file" });
  }
});

/**
 * Get file list
 * GET /api/storage/files
 */
router.get("/files", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const userDir = path.join(STORAGE_DIR, "users", userId);

    try {
      const files = await fs.readdir(userDir);
      const fileList = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(userDir, file);
          const stats = await fs.stat(filePath);
          return {
            id: path.basename(file, path.extname(file)),
            name: file,
            size: stats.size,
            uploadedAt: stats.birthtime.toISOString(),
          };
        })
      );

      res.json(fileList);
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return res.json([]);
      }
      throw error;
    }
  } catch (error: any) {
    console.error("Error getting file list:", error);
    res.status(500).json({ error: error.message || "Failed to get file list" });
  }
});

/**
 * Delete file
 * DELETE /api/storage/files/:fileId
 */
router.delete("/files/:fileId", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { fileId } = req.params;
    const userDir = path.join(STORAGE_DIR, "users", userId);

    // Find file by ID
    const files = await fs.readdir(userDir);
    const file = files.find((f) => f.startsWith(fileId));

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    const filePath = path.join(userDir, file);
    await fs.unlink(filePath);

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ error: (error as Error).message || "Failed to delete file" });
  }
});

export { router as storageRoutes };

