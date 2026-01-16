import { ipcMain, BrowserWindow, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { watch, FSWatcher } from 'chokidar';
import { v4 as uuidv4 } from 'uuid';
import { storage } from './storage.js';
import { fileURLToPath } from 'url';
import { WorkerPool } from './worker-pool.js';
import * as os from 'os';

// Get default thumbnail path (album-cover-1.jpg)
function getDefaultThumbnailPath(): string | null {
  try {
    // Try to find the image in various possible locations
    const possiblePaths = [
      // In development: relative to electron folder
      path.join(__dirname, '../src/assets/album-cover-1.jpg'),
      path.join(__dirname, '../../src/assets/album-cover-1.jpg'),
      // In production: might be in resources
      path.join(process.resourcesPath || app.getAppPath(), 'assets/album-cover-1.jpg'),
      path.join(app.getAppPath(), 'src/assets/album-cover-1.jpg'),
      // Try public folder
      path.join(__dirname, '../public/album-cover-1.jpg'),
      path.join(app.getAppPath(), 'public/album-cover-1.jpg'),
      // Try copying from src/assets to public if needed
      path.join(__dirname, '../src/assets/album-cover-1.jpg'),
    ];

    for (const possiblePath of possiblePaths) {
      try {
        if (fsSync.existsSync(possiblePath)) {
          console.log('Found default thumbnail at:', possiblePath);
          return possiblePath;
        }
      } catch (e) {
        // Continue to next path
      }
    }
    
    console.log('Default thumbnail image (album-cover-1.jpg) not found in any expected location');
    return null;
  } catch (error) {
    console.error('Error finding default thumbnail:', error);
    return null;
  }
}

// Get default thumbnail URL
function getDefaultThumbnailUrl(): string | null {
  const defaultPath = getDefaultThumbnailPath();
  if (!defaultPath) {
    // Fallback to web URL if file not found (Next.js will serve it from public or assets)
    return '/album-cover-1.jpg';
  }
  // Use local-image:// protocol for Electron
  return `local-image://${encodeURIComponent(defaultPath)}`;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const FILE_STAT_CACHE_TTL_MS = 30000;
const FILE_STAT_CACHE_MAX = 5000;

let watcher: FSWatcher | null = null;
let isScanning = false;
let lastProgressAt = 0;
let lastProgressPhase: ScanProgress['phase'] | null = null;
const fileStatCache = new Map<string, { value: { size: number; mtime: Date } | null; checkedAt: number }>();

function pruneFileStatCache() {
  const now = Date.now();
  for (const [key, value] of fileStatCache.entries()) {
    if (now - value.checkedAt > FILE_STAT_CACHE_TTL_MS) {
      fileStatCache.delete(key);
    }
  }

  while (fileStatCache.size > FILE_STAT_CACHE_MAX) {
    const firstKey = fileStatCache.keys().next().value as string | undefined;
    if (!firstKey) break;
    fileStatCache.delete(firstKey);
  }
}
let pendingNewVideos: ScannedVideo[] = [];
let pendingUpdatedVideos: ScannedVideo[] = [];
let pendingVideoTimer: NodeJS.Timeout | null = null;

function flushPendingVideoEvents() {
  if (pendingNewVideos.length === 0 && pendingUpdatedVideos.length === 0) return;
  const windows = BrowserWindow.getAllWindows();
  const newBatch = pendingNewVideos;
  const updatedBatch = pendingUpdatedVideos;
  pendingNewVideos = [];
  pendingUpdatedVideos = [];
  pendingVideoTimer = null;

  newBatch.forEach(video => {
    windows.forEach(window => {
      window.webContents.send('videos:new', video);
    });
  });

  updatedBatch.forEach(video => {
    windows.forEach(window => {
      window.webContents.send('videos:updated', video);
    });
  });
}

function queueVideoNewEvent(video: ScannedVideo) {
  pendingNewVideos.push(video);
  if (!pendingVideoTimer) {
    pendingVideoTimer = setTimeout(flushPendingVideoEvents, 120);
  }
}

function queueVideoUpdatedEvent(video: ScannedVideo) {
  pendingUpdatedVideos.push(video);
  if (!pendingVideoTimer) {
    pendingVideoTimer = setTimeout(flushPendingVideoEvents, 120);
  }
}

const thumbnailWorkerPool = new WorkerPool<
  { filePath: string; useFirstFrame?: boolean },
  { thumbnailDataBase64?: string } | null
>(
  new URL('../workers/video-thumbnail-worker.js', import.meta.url),
  Math.max(2, Math.min(4, Math.max(1, os.cpus().length - 1)))
);

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
  const cached = fileStatCache.get(filePath);
  if (cached && Date.now() - cached.checkedAt < FILE_STAT_CACHE_TTL_MS) {
    return cached.value;
  }
  try {
    const stats = await fs.stat(filePath);
    const value = { size: stats.size, mtime: stats.mtimeMs ? new Date(stats.mtimeMs) : stats.mtime };
    fileStatCache.set(filePath, { value, checkedAt: Date.now() });
    pruneFileStatCache();
    return value;
  } catch {
    fileStatCache.set(filePath, { value: null, checkedAt: Date.now() });
    pruneFileStatCache();
    return null;
  }
}

/**
 * Generate thumbnail for video using ffmpeg
 * Tries to capture at second 2 first, falls back to first frame (second 0) if that fails
 */
async function generateThumbnail(filePath: string, forceRegenerate = false, useFirstFrame = false): Promise<string | null> {
  try {
    // Check if thumbnail already exists (unless forcing regeneration)
    if (!forceRegenerate) {
      const existingThumbnail = await storage.getThumbnailPath(filePath);
      if (existingThumbnail) {
        return existingThumbnail;
      }
    }

    const workerResult = await thumbnailWorkerPool.runTask({ filePath, useFirstFrame });
    if (!workerResult?.thumbnailDataBase64) {
      console.log(`Failed to generate thumbnail for ${path.basename(filePath)} in worker`);
      return null;
    }

    const thumbnailData = Buffer.from(workerResult.thumbnailDataBase64, 'base64');
    if (thumbnailData.length === 0) {
      console.log(`Empty thumbnail generated for ${path.basename(filePath)} in worker`);
      return null;
    }

    return await storage.saveThumbnail(thumbnailData, filePath);
  } catch (error) {
    console.error(`Error generating thumbnail for ${filePath}:`, error);
    return null;
  }
}

/**
 * Regenerate thumbnail for a specific video
 */
async function regenerateThumbnail(videoId: string): Promise<string | null> {
  const videos = await storage.getVideos();
  const video = videos.find(v => v.id === videoId);
  
  if (!video) {
    return null;
  }
  
  const thumbnailUrl = await generateThumbnail(video.filePath, true);
  
  if (thumbnailUrl) {
    // Update video with new thumbnail
    await storage.updateVideo(videoId, { thumbnailUrl });
  }
  
  return thumbnailUrl;
}

/**
 * Extract basic video metadata (simplified - could use ffprobe in the future)
 */
async function extractVideoMetadata(filePath: string): Promise<Partial<ScannedVideo>> {
  // For now, we'll use the filename as title
  // In the future, this could use ffprobe or similar tools
  const basename = path.basename(filePath, path.extname(filePath));
  const ext = path.extname(filePath).toLowerCase();
  
  // Generate thumbnail (will use default if generation fails)
  const thumbnailUrl = await generateThumbnail(filePath);
  
  // If no thumbnail generated, use default
  const finalThumbnailUrl = thumbnailUrl || getDefaultThumbnailUrl() || undefined;
  
  return {
    title: basename,
    format: ext.substring(1), // Remove the dot
    thumbnailUrl: finalThumbnailUrl,
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
      thumbnailUrl: metadata.thumbnailUrl,
    };

    // If no thumbnail was generated, try to generate first frame as fallback
    if (!video.thumbnailUrl) {
      console.log(`No thumbnail found for ${path.basename(filePath)}, generating first frame...`);
      const firstFrameThumbnail = await generateThumbnail(filePath, false, true);
      if (firstFrameThumbnail) {
        video.thumbnailUrl = firstFrameThumbnail;
      } else {
        // Ultimate fallback: use default thumbnail
        const defaultThumbnail = getDefaultThumbnailUrl();
        if (defaultThumbnail) {
          video.thumbnailUrl = defaultThumbnail;
          console.log(`Using default thumbnail for ${path.basename(filePath)}`);
        }
      }
    }

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
  const now = Date.now();
  const shouldForce = progress.phase === 'complete' || progress.phase === 'indexing' || progress.phase !== lastProgressPhase;
  if (!shouldForce && now - lastProgressAt < 200) {
    return;
  }
  lastProgressAt = now;
  lastProgressPhase = progress.phase;
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
  const newVideos: ScannedVideo[] = [];
  const updatedVideos: ScannedVideo[] = [];
  const existingVideos = await storage.getVideos();
  const existingByPath = new Map(existingVideos.map(v => [v.filePath, v]));
  const scanStartTime = Date.now();

  try {
    // Phase 1: Scan directories
    sendProgress({
      current: 0,
      total: 0,
      file: '',
      phase: 'scanning',
    });

    const allVideoFiles: string[] = [];
    const scanPromises = directories.map(async (dir) => {
      try {
        console.log(`📂 Scanning directory: ${dir}`);
        const files = await scanDirectory(dir);
        console.log(`✅ Found ${files.length} video files in ${dir}`);
        return files;
      } catch (error) {
        console.error(`❌ Error scanning ${dir}:`, error);
        return [];
      }
    });

    const directoryResults = await Promise.all(scanPromises);
    directoryResults.forEach(files => allVideoFiles.push(...files));

    const total = allVideoFiles.length;
    console.log(`\n📊 Total video files found: ${total}`);

    if (total === 0) {
      sendProgress({ current: 0, total: 0, file: 'Aucun fichier trouvé', phase: 'complete' });
      return [];
    }

    // Phase 2: Filter and process files
    const filesToProcess: string[] = [];
    const skippedFiles: string[] = [];

    const STAT_BATCH_SIZE = 25;
    for (let i = 0; i < allVideoFiles.length; i += STAT_BATCH_SIZE) {
      const batch = allVideoFiles.slice(i, i + STAT_BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (filePath) => {
          const existingVideo = existingByPath.get(filePath);
          if (!existingVideo) return { filePath, skip: false };

          const stats = await getFileStats(filePath);
          if (stats && new Date(existingVideo.lastModified).getTime() === stats.mtime.getTime()) {
            return { filePath, skip: true };
          }
          return { filePath, skip: false };
        })
      );

      for (const result of batchResults) {
        if (result.skip) {
          skippedFiles.push(result.filePath);
        } else {
          filesToProcess.push(result.filePath);
        }
      }
    }

    console.log(`\n🔄 Processing: ${filesToProcess.length} new/modified files`);
    console.log(`⏭️  Skipping: ${skippedFiles.length} unchanged files`);

    if (filesToProcess.length === 0) {
      console.log('✅ Video library is up to date');
      sendProgress({ current: total, total, file: 'Bibliothèque à jour', phase: 'complete' });
      return [];
    }

    sendProgress({
      current: skippedFiles.length,
      total,
      file: '',
      phase: 'extracting',
    });

    // Phase 2: Process files
    const BATCH_SIZE = Math.max(4, Math.min(12, os.cpus().length * 2));
    let processedCount = skippedFiles.length;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
      const batch = filesToProcess.slice(i, i + BATCH_SIZE);
      const batchStartTime = Date.now();

      const batchPromises = batch.map(async (filePath) => {
        try {
          const video = await processVideoFile(filePath);
          if (!video) return null;

          const existing = existingByPath.get(filePath);
          if (existing) {
            video.id = existing.id;
            video.addedAt = existing.addedAt;
          }

          return video;
        } catch (error) {
          console.error(`❌ Error processing ${path.basename(filePath)}:`, error);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);

      for (const result of batchResults) {
        if (result) {
          if (existingByPath.has(result.filePath)) {
            updatedVideos.push(result);
          } else {
            newVideos.push(result);
          }
          successCount++;
        } else {
          errorCount++;
        }
      }

      processedCount += batch.length;
      const batchTime = Date.now() - batchStartTime;
      const avgTimePerFile = batchTime / batch.length;
      const remainingFiles = filesToProcess.length - (i + batch.length);
      const estimatedTimeRemaining = (remainingFiles * avgTimePerFile) / 1000;

      sendProgress({
        current: processedCount,
        total,
        file: `${path.basename(batch[batch.length - 1] || '')} (${successCount} OK, ${errorCount} erreurs)`,
        phase: 'extracting',
      });

      if ((i / BATCH_SIZE) % 5 === 0) {
        console.log(`⏳ Progress: ${processedCount}/${total} (${Math.round((processedCount/total)*100)}%) - ETA: ${Math.round(estimatedTimeRemaining)}s`);
      }
    }

    // Phase 3: Save to storage
    sendProgress({
      current: processedCount,
      total,
      file: '',
      phase: 'indexing',
    });

    if (newVideos.length > 0 || updatedVideos.length > 0) {
      const updatedByPath = new Map(updatedVideos.map(v => [v.filePath, v]));
      const mergedVideos = existingVideos.map(v => updatedByPath.get(v.filePath) ?? v);
      mergedVideos.push(...newVideos);

      console.log(`Saving ${newVideos.length} new and ${updatedVideos.length} updated videos to storage`);
      await storage.saveVideos(mergedVideos);
      console.log('Videos saved successfully');

      newVideos.forEach(queueVideoNewEvent);
      updatedVideos.forEach(queueVideoUpdatedEvent);
      console.log(`Sent ${newVideos.length} video:new and ${updatedVideos.length} videos:updated events to renderer`);
    } else {
      console.log('No new or updated videos to save');
    }

    sendProgress({
      current: processedCount,
      total,
      file: '',
      phase: 'complete',
    });
    const scanDuration = ((Date.now() - scanStartTime) / 1000).toFixed(1);
    console.log(`\n✅ Video scan complete in ${scanDuration}s`);

    return newVideos;
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
        
        // If thumbnail was generated, ensure it's saved (processVideoFile already handles this)
        // But if somehow it's still missing, try one more time with first frame
        if (!video.thumbnailUrl) {
          const thumbnail = await generateThumbnail(filePath, false, true);
          if (thumbnail) {
            await storage.updateVideo(video.id, { thumbnailUrl: thumbnail });
            video.thumbnailUrl = thumbnail;
          } else {
            // Ultimate fallback: use default thumbnail
            const defaultThumbnail = getDefaultThumbnailUrl();
            if (defaultThumbnail) {
              await storage.updateVideo(video.id, { thumbnailUrl: defaultThumbnail });
              video.thumbnailUrl = defaultThumbnail;
            }
          }
        }
        
        // Notify renderer
        queueVideoNewEvent(video);
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
 * Generate thumbnails for videos that don't have one (background task)
 */
async function generateMissingThumbnailsBackground() {
  try {
    const videos = await storage.getVideos();
    const videosWithoutThumbnails = videos.filter(video => {
      const hasThumbnail = video.thumbnailUrl && 
        (video.thumbnailUrl.startsWith('file://') || 
         video.thumbnailUrl.startsWith('local-image://') ||
         video.thumbnailUrl.startsWith('http://') ||
         video.thumbnailUrl.startsWith('https://'));
      return !hasThumbnail;
    });

    if (videosWithoutThumbnails.length === 0) {
      return;
    }

    console.log(`Found ${videosWithoutThumbnails.length} videos without thumbnails, generating in background...`);

    // Process in batches to avoid blocking
    const batchSize = 5;
    for (let i = 0; i < videosWithoutThumbnails.length; i += batchSize) {
      const batch = videosWithoutThumbnails.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (video) => {
        try {
          const thumbnail = await generateThumbnail(video.filePath, false);
          if (thumbnail) {
            await storage.updateVideo(video.id, { thumbnailUrl: thumbnail });
            
            // Notify renderer of update
            queueVideoUpdatedEvent({ ...video, thumbnailUrl: thumbnail });
          } else {
            // Try first frame
            const firstFrameThumbnail = await generateThumbnail(video.filePath, false, true);
            if (firstFrameThumbnail) {
              await storage.updateVideo(video.id, { thumbnailUrl: firstFrameThumbnail });
              
              // Notify renderer of update
              queueVideoUpdatedEvent({ ...video, thumbnailUrl: firstFrameThumbnail });
            } else {
              // Ultimate fallback: use default thumbnail
              const defaultThumbnail = getDefaultThumbnailUrl();
              if (defaultThumbnail) {
                await storage.updateVideo(video.id, { thumbnailUrl: defaultThumbnail });
                
                // Notify renderer of update
                queueVideoUpdatedEvent({ ...video, thumbnailUrl: defaultThumbnail });
              }
            }
          }
        } catch (error) {
          console.error(`Failed to generate thumbnail for ${path.basename(video.filePath)}:`, error);
        }
      }));

      // Small delay between batches to avoid overwhelming the system
      if (i + batchSize < videosWithoutThumbnails.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`Background thumbnail generation complete for ${videosWithoutThumbnails.length} videos`);
  } catch (error) {
    console.error('Error in background thumbnail generation:', error);
  }
}

/**
 * Initialize IPC handlers for video scanner
 */
export function initVideoScanner() {
  // Start background task to generate missing thumbnails after a delay
  setTimeout(() => {
    generateMissingThumbnailsBackground().catch(err => {
      console.error('Background thumbnail generation failed:', err);
    });
  }, 5000); // Wait 5 seconds after app start
  ipcMain.handle('videos:scan', async (_event, directories: string[]) => {
    const videos = await scanVideos(directories);
    // Start watching after scan
    startWatching(directories);
    return videos;
  });

  ipcMain.handle('videos:get', async () => {
    const storedVideos = await storage.getVideos();
    // Convert StoredVideo to Video format (remove lastModified if needed, ensure format is optional)
    return storedVideos.map(({ lastModified, ...video }) => ({
      ...video,
      format: video.format || path.extname(video.filePath).substring(1),
    }));
  });

  ipcMain.handle('videos:getVideo', async (_event, videoId: string) => {
    return storage.getVideo(videoId);
  });

  ipcMain.handle('videos:updateMetadata', async (_event, videoId: string, metadata: Partial<ScannedVideo>) => {
    const video = await storage.getVideo(videoId);
    if (!video) return null;
    
    const updated = { ...video, ...metadata };
    await storage.updateVideoByPath(video.filePath, updated);
    return updated;
  });

  ipcMain.handle('videos:rescan', async () => {
    const settings = await storage.getSettings();
    if (settings.videoDirectories && settings.videoDirectories.length > 0) {
      return scanVideos(settings.videoDirectories);
    }
    return [];
  });

  // Add videos from file paths
  ipcMain.handle('videos:addFiles', async (_event, filePaths: string[]) => {
    const newVideos: ScannedVideo[] = [];
    const existingVideos = await storage.getVideos();
    const existingPaths = new Set(existingVideos.map(v => v.filePath));

    for (const filePath of filePaths) {
      if (isVideoFile(filePath) && !existingPaths.has(filePath)) {
        const video = await processVideoFile(filePath);
        if (video) {
          newVideos.push(video);
        }
      }
    }

    if (newVideos.length > 0) {
      await storage.addVideos(newVideos);
      
      // Notify renderer
      newVideos.forEach(queueVideoNewEvent);
    }

    return newVideos;
  });

  // Add video from URL
  ipcMain.handle('videos:addFromUrl', async (_event, url: string, title?: string) => {
    const video: ScannedVideo = {
      id: uuidv4(),
      filePath: url, // Store URL as filePath for web videos
      title: title || `Vidéo depuis URL`,
      duration: 0,
      format: 'url',
      fileSize: 0,
      addedAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };

    await storage.addVideos([video]);
    
    // Notify renderer
    queueVideoNewEvent(video);

    return video;
  });

  // Regenerate thumbnail for a specific video
  ipcMain.handle('videos:regenerateThumbnail', async (_event, videoId: string) => {
    return regenerateThumbnail(videoId);
  });

  // Generate thumbnails for videos that don't have one
  ipcMain.handle('videos:generateMissingThumbnails', async () => {
    const videos = await storage.getVideos();
    let generated = 0;
    let failed = 0;
    
    console.log(`Checking ${videos.length} videos for missing thumbnails...`);
    
    const batchSize = 5;
    for (let i = 0; i < videos.length; i += batchSize) {
      const batch = videos.slice(i, i + batchSize);
      await Promise.all(batch.map(async (video) => {
        // Check if video has a valid thumbnail
        const hasThumbnail = video.thumbnailUrl && 
          (video.thumbnailUrl.startsWith('file://') || 
           video.thumbnailUrl.startsWith('local-image://') ||
           video.thumbnailUrl.startsWith('http://') ||
           video.thumbnailUrl.startsWith('https://'));
        
        if (!hasThumbnail) {
          console.log(`Generating thumbnail for: ${path.basename(video.filePath)}`);
          
          // Try to generate thumbnail (will try second 2, then first frame)
          const thumbnail = await generateThumbnail(video.filePath, false);
          if (thumbnail) {
            await storage.updateVideo(video.id, { thumbnailUrl: thumbnail });
            generated++;
            
            // Notify renderer of update
            queueVideoUpdatedEvent({ ...video, thumbnailUrl: thumbnail });
          } else {
            // If still no thumbnail, try first frame explicitly
            const firstFrameThumbnail = await generateThumbnail(video.filePath, false, true);
            if (firstFrameThumbnail) {
              await storage.updateVideo(video.id, { thumbnailUrl: firstFrameThumbnail });
              generated++;
              
              // Notify renderer of update
              queueVideoUpdatedEvent({ ...video, thumbnailUrl: firstFrameThumbnail });
            } else {
              // Ultimate fallback: use default thumbnail
              const defaultThumbnail = getDefaultThumbnailUrl();
              if (defaultThumbnail) {
                await storage.updateVideo(video.id, { thumbnailUrl: defaultThumbnail });
                generated++;
                
                // Notify renderer of update
                queueVideoUpdatedEvent({ ...video, thumbnailUrl: defaultThumbnail });
              } else {
                failed++;
                console.log(`Failed to generate thumbnail for: ${path.basename(video.filePath)}`);
              }
            }
          }
        }
      }));
    }
    
    console.log(`Thumbnail generation complete: ${generated} generated, ${failed} failed`);
    return { generated, failed, total: videos.length };
  });

  // Regenerate all thumbnails
  ipcMain.handle('videos:regenerateAllThumbnails', async () => {
    const videos = await storage.getVideos();
    let regenerated = 0;
    
    const batchSize = 5;
    for (let i = 0; i < videos.length; i += batchSize) {
      const batch = videos.slice(i, i + batchSize);
      await Promise.all(batch.map(async (video) => {
        // Check for both old file:// and new local-image:// formats
        const hasThumbnail = video.thumbnailUrl && 
          (video.thumbnailUrl.startsWith('file://') || video.thumbnailUrl.startsWith('local-image://'));
        
        if (!hasThumbnail) {
          // Try to generate thumbnail (will try second 2, then first frame)
          const thumbnail = await generateThumbnail(video.filePath, true);
          if (thumbnail) {
            await storage.updateVideo(video.id, { thumbnailUrl: thumbnail });
            regenerated++;
          } else {
            // If still no thumbnail, try first frame explicitly
            const firstFrameThumbnail = await generateThumbnail(video.filePath, true, true);
            if (firstFrameThumbnail) {
              await storage.updateVideo(video.id, { thumbnailUrl: firstFrameThumbnail });
              regenerated++;
            }
          }
        }
      }));
    }
    
    return regenerated;
  });
}

export { scanVideos, startWatching, stopWatching, regenerateThumbnail };

