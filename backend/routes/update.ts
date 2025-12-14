import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

// POST /api/update/check
router.post('/check', async (req: Request, res: Response) => {
  try {
    const { currentVersion, currentBuildNumber } = req.body;
    
    const cwd = process.cwd();
    const possibleVersionPaths = [
      path.join(cwd, 'public', 'updates', 'version.json'),
      path.join(cwd, 'version.json'),
    ];

    let versionJsonPath: string | null = null;
    for (const possiblePath of possibleVersionPaths) {
      if (fs.existsSync(possiblePath)) {
        versionJsonPath = possiblePath;
        break;
      }
    }

    if (!versionJsonPath) {
      return res.status(404).json({ error: 'version.json not found' });
    }

    const versionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
    const serverVersion = versionData.version;
    const serverBuildNumber = versionData.buildNumber || 0;

    const hasUpdate = 
      (currentVersion && currentVersion !== serverVersion) ||
      (currentBuildNumber !== undefined && currentBuildNumber < serverBuildNumber);

    res.json({
      hasUpdate,
      currentVersion: serverVersion,
      currentBuildNumber: serverBuildNumber,
      latestVersion: serverVersion,
      latestBuildNumber: serverBuildNumber,
    });
  } catch (error: any) {
    console.error('Error checking update:', error);
    res.status(500).json({ error: error.message || 'Failed to check update' });
  }
});

// GET /api/updates/latest
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const cwd = process.cwd();
    const possibleLatestPaths = [
      path.join(cwd, 'public', 'updates', 'latest.json'),
      path.join(cwd, 'latest.json'),
    ];

    let latestJsonPath: string | null = null;
    for (const possiblePath of possibleLatestPaths) {
      if (fs.existsSync(possiblePath)) {
        latestJsonPath = possiblePath;
        break;
      }
    }

    if (!latestJsonPath) {
      return res.status(404).json({ error: 'latest.json not found' });
    }

    const latestData = JSON.parse(fs.readFileSync(latestJsonPath, 'utf-8'));

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(latestData);
  } catch (error: any) {
    console.error('Error reading latest.json:', error);
    res.status(500).json({ error: error.message || 'Failed to read latest.json' });
  }
});

export default router;

