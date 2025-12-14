import { Router, Request, Response } from 'express';
import multer from 'multer';
import { readdir, stat, unlink, readFile } from 'fs/promises';
import path from 'path';
import { verifyAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { verifyAuthAndPro } from '../lib/stripe-utils.js';
import { uploadToBunny, isBunnyConfigured } from '../lib/bunny.js';
import { uploadToPlanetHoster, isPlanetHosterConfigured } from '../lib/planethoster-sftp.js';
import { rateLimiters } from '../middleware/rate-limit.js';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB max
});

const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), 'storage');
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB for free users
const MAX_FILE_SIZE_PRO = 500 * 1024 * 1024; // 500MB for Pro users

// GET /api/storage/files
router.get('/files', rateLimiters.general, verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userDir = path.join(STORAGE_DIR, 'users', req.userId!);

    try {
      const files = await readdir(userDir);
      const fileList = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(userDir, file);
          const stats = await stat(filePath);
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
      if (error.code === 'ENOENT') {
        return res.json([]);
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error getting file list:', error);
    res.status(500).json({ error: error.message || 'Failed to get file list' });
  }
});

// DELETE /api/storage/files/:fileId
router.delete('/files/:fileId', rateLimiters.general, verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fileId } = req.params;
    const userDir = path.join(STORAGE_DIR, 'users', req.userId!);
    const filePath = path.join(userDir, fileId);

    try {
      await unlink(filePath);
      res.json({ success: true });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'File not found' });
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: error.message || 'Failed to delete file' });
  }
});

// GET /api/storage/download/:fileId
router.get('/download/:fileId', rateLimiters.general, verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fileId } = req.params;
    const userDir = path.join(STORAGE_DIR, 'users', req.userId!);
    const filePath = path.join(userDir, fileId);

    try {
      const fileBuffer = await readFile(filePath);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${fileId}"`);
      res.send(fileBuffer);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'File not found' });
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: error.message || 'Failed to download file' });
  }
});

// POST /api/storage/upload
router.post('/upload', rateLimiters.upload, verifyAuth, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const auth = await verifyAuthAndPro(req);
    if (!auth) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const maxSize = auth.isPro ? MAX_FILE_SIZE_PRO : MAX_FILE_SIZE;
    if (file.size > maxSize) {
      return res.status(400).json({ 
        error: `File size exceeds limit (${maxSize / 1024 / 1024}MB)` 
      });
    }

    const { cloudProvider } = req.body || {};
    
    // Upload to cloud provider if specified
    if (cloudProvider === 'bunny' && isBunnyConfigured()) {
      const result = await uploadToBunny(file.originalname, file.buffer, file.mimetype);
      return res.json({ 
        success: true, 
        fileId: result.path,
        url: result.url,
        provider: 'bunny'
      });
    }

    if (cloudProvider === 'planethoster' && isPlanetHosterConfigured()) {
      const result = await uploadToPlanetHoster(file.originalname, file.buffer);
      return res.json({ 
        success: true, 
        fileId: result.path,
        url: result.url,
        provider: 'planethoster'
      });
    }

    // Default: save locally
    const userDir = path.join(STORAGE_DIR, 'users', auth.userId);
    await import('fs/promises').then(fs => fs.mkdir(userDir, { recursive: true }));
    
    const filePath = path.join(userDir, file.originalname);
    await import('fs/promises').then(fs => fs.writeFile(filePath, file.buffer));

    res.json({ 
      success: true, 
      fileId: file.originalname,
      provider: 'local'
    });
  } catch (error: any) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: error.message || 'Failed to upload file' });
  }
});

export default router;

