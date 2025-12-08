import { ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { watch, FSWatcher } from 'chokidar';
import { v4 as uuidv4 } from 'uuid';
import { storage } from './storage.js';

export interface ScannedVideo {
  id: string;
  filePath: string;
  title: string;
  duration: number;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  format: string;
  fileSize: number;
  addedAt: string;
  lastModified: string;
}

interface ScanProgress {
  current: number;
  total: number;
  file: string;
  phase: 'scanning' | 'extracting' | 'indexing' | 'complete';
}

// Supported video formats
const VIDEO_EXTENSIONS = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.3gp', '.ogv'];

let watcher: FSWatcher | null = null;
let isScanning = false;

/**
 * Check if a file is a supported video file
 */
function isVideoFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return VIDEO_EXTENSIONS.includes(ext);
}

/**
 * Recursively scan a directory for video files
 */
async function scanDirectory(dirPath: string): Promise<string[]> {
  const videoFiles: string[] = [];
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        // Skip hidden directories and common non-video folders
        if (!entry.name.startsWith('.') && 
            !['node_modules', '$RECYCLE.BIN', 'System Volume Information'].includes(entry.name)) {
          const subFiles = await scanDirectory(fullPath);
          videoFiles.push(...subFiles);
        }
      } else if (entry.isFile() && isVideoFile(entry.name)) {
        videoFiles.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
  }
  
  return videoFiles;
}

/**
 * Get file stats
 */
async function getFileStats(filePath: string): Promise<{ size: number; mtime: Date } | null> {
  try {
    const stats = await fs.stat(filePath);
    return { size: stats.size, mtime: stats.mtimeMs ? new Date(stats.mtimeMs) : stats.mtime };
  } catch {
    return null;
  }
}

/**
 * Extract basic video metadata (simplified - could use ffprobe in the future)
 */
async function extractVideoMetadata(filePath: string): Promise<Partial<ScannedVideo>> {
  // For now, we'll use the filename as title
  // In the future, this could use ffprobe or similar tools
  const basename = path.basename(filePath, path.extname(filePath));
  const ext = path.extname(filePath).toLowerCase();
  
  return {
    title: basename,
    format: ext.substring(1), // Remove the dot
  };
}

/**
 * Process a single video file
 */
async function processVideoFile(filePath: string): Promise<ScannedVideo | null> {
  try {
    const stats = await getFileStats(filePath);
    if (!stats) return null;

    const metadata = await extractVideoMetadata(filePath);

    const video: ScannedVideo = {
      id: uuidv4(),
      filePath,
      title: metadata.title || path.basename(filePath, path.extname(filePath)),
      duration: 0, // Would need ffprobe or similar to get actual duration
      format: metadata.format || path.extname(filePath).substring(1),
      addedAt: new Date().toISOString(),
      fileSize: stats.size,
      lastModified: stats.mtime.toISOString(),
    };

    return video;
  } catch (error) {
    console.error(`Error processing video file ${filePath}:`, error);
    return null;
  }
}

/**
 * Send progress update to renderer
 */
function sendProgress(progress: ScanProgress) {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(window => {
    window.webContents.send('videos:scan-progress', progress);
  });
}

/**
 * Scan library for videos
 */
async function scanVideos(directories: string[]): Promise<ScannedVideo[]> {
  if (isScanning) {
    console.warn('Video scan already in progress');
    return [];
  }

  isScanning = true;
  const allVideos: ScannedVideo[] = [];
  const existingVideos = await storage.getVideos();
  const existingPaths = new Set(existingVideos.map(v => v.filePath));

  try {
    // Phase 1: Scan directories
    sendProgress({
      current: 0,
      total: 0,
      file: '',
      phase: 'scanning',
    });

    const allVideoFiles: string[] = [];
    for (const dir of directories) {
      const files = await scanDirectory(dir);
      allVideoFiles.push(...files);
    }

    sendProgress({
      current: allVideoFiles.length,
      total: allVideoFiles.length,
      file: '',
      phase: 'extracting',
    });

    // Phase 2: Process files
    for (let i = 0; i < allVideoFiles.length; i++) {
      const filePath = allVideoFiles[i];
      
      sendProgress({
        current: i + 1,
        total: allVideoFiles.length,
        file: path.basename(filePath),
        phase: 'extracting',
      });

      // Skip if already exists
      if (existingPaths.has(filePath)) {
        continue;
      }

      const video = await processVideoFile(filePath);
      if (video) {
        allVideos.push(video);
      }
    }

    // Phase 3: Save to storage
    sendProgress({
      current: allVideos.length,
      total: allVideos.length,
      file: '',
      phase: 'indexing',
    });

    if (allVideos.length > 0) {
      await storage.addVideos(allVideos);
    }

    sendProgress({
      current: allVideos.length,
      total: allVideos.length,
      file: '',
      phase: 'complete',
    });

    return allVideos;
  } catch (error) {
    console.error('Error scanning videos:', error);
    throw error;
  } finally {
    isScanning = false;
  }
}

/**
 * Start watching directories for changes
 */
function startWatching(directories: string[]) {
  if (watcher) {
    watcher.close();
  }

  watcher = watch(directories, {
    ignored: /(^|[\/\\])\../, // Ignore hidden files
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on('add', async (filePath) => {
    if (isVideoFile(filePath)) {
      console.log('New video file detected:', filePath);
      const video = await processVideoFile(filePath);
      if (video) {
        await storage.addVideos([video]);
        // Notify renderer
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(window => {
          window.webContents.send('videos:new', video);
        });
      }
    }
  });

  watcher.on('unlink', async (filePath) => {
    console.log('Video file removed:', filePath);
    await storage.removeVideoByPath(filePath);
    // Notify renderer
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      window.webContents.send('videos:removed', filePath);
    });
  });
}

/**
 * Stop watching directories
 */
function stopWatching() {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}

/**
 * Initialize IPC handlers for video scanner
 */
export function initVideoScanner() {
  ipcMain.handle('videos:scan', async (_event, directories: string[]) => {
    const videos = await scanVideos(directories);
    // Start watching after scan
    startWatching(directories);
    return videos;
  });

  ipcMain.handle('videos:get', async () => {
    return storage.getVideos();
  });

  ipcMain.handle('videos:getVideo', async (_event, videoId: string) => {
    return storage.getVideo(videoId);
  });

  ipcMain.handle('videos:rescan', async () => {
    const settings = await storage.getSettings();
    if (settings.videoDirectories && settings.videoDirectories.length > 0) {
      return scanVideos(settings.videoDirectories);
    }
    return [];
  });
}

export { scanVideos, startWatching, stopWatching };

