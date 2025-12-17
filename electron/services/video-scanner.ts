import { ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { watch, FSWatcher } from 'chokidar';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import { storage } from './storage.js';
import ffmpegStatic from 'ffmpeg-static';

const execAsync = promisify(exec);

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

// Check if ffmpeg is available (static or system)
let ffmpegAvailable: boolean | null = null;
let ffmpegPath: string | null = null;

async function checkFfmpegAvailable(): Promise<boolean> {
  if (ffmpegAvailable !== null) return ffmpegAvailable;
  
  // First, try to use bundled ffmpeg-static
  if (ffmpegStatic) {
    try {
      // Check if the static binary exists
      const fsSync = await import('fs');
      if (fsSync.existsSync(ffmpegStatic)) {
        ffmpegPath = ffmpegStatic;
        ffmpegAvailable = true;
        console.log('Using bundled ffmpeg-static for thumbnail generation:', ffmpegStatic);
        return true;
      }
    } catch (error) {
      console.log('Bundled ffmpeg-static not found, trying system ffmpeg...');
    }
  }
  
  // Fallback to system ffmpeg if available
  try {
    await execAsync('ffmpeg -version');
    ffmpegPath = 'ffmpeg';
    ffmpegAvailable = true;
    console.log('Using system ffmpeg for thumbnail generation');
  } catch {
    ffmpegAvailable = false;
    ffmpegPath = null;
    console.log('ffmpeg is not available (neither bundled nor system) - thumbnails will not be generated');
  }
  return ffmpegAvailable;
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

    // Check if ffmpeg is available and get path (static or system)
    const hasFfmpeg = await checkFfmpegAvailable();
    if (!hasFfmpeg || !ffmpegPath) {
      return null;
    }

    // Create temp directory in user data folder
    const os = await import('os');
    const tempDir = os.tmpdir();
    const thumbnailPath = path.join(tempDir, `nexus_thumb_${Date.now()}.jpg`);
    
    // Try to generate thumbnail - first try at second 2, then fallback to first frame
    const timeOffsets = useFirstFrame ? ['00:00:00'] : ['00:00:02', '00:00:00'];

    for (const timeOffset of timeOffsets) {
      try {
        // Use -y to overwrite, -hide_banner for less output
        // -ss before -i is faster (seeks before decoding)
        // Use the ffmpeg path (static or system)
        await execAsync(`"${ffmpegPath}" -y -hide_banner -loglevel error -ss ${timeOffset} -i "${filePath}" -vframes 1 -vf "scale=320:-1" "${thumbnailPath}"`, {
          timeout: 30000, // 30 second timeout
        });
        
        // Check if thumbnail was created
        try {
          await fs.access(thumbnailPath);
        } catch {
          console.log(`Thumbnail not created for ${filePath} at ${timeOffset}`);
          continue; // Try next time offset
        }
        
        // Read the generated thumbnail
        const thumbnailData = await fs.readFile(thumbnailPath);
        
        // Verify it's not empty
        if (thumbnailData.length === 0) {
          console.log(`Empty thumbnail generated for ${filePath} at ${timeOffset}`);
          continue; // Try next time offset
        }
        
        // Save to storage
        const savedUrl = await storage.saveThumbnail(thumbnailData, filePath);
        
        // Clean up temp file
        try {
          await fs.unlink(thumbnailPath);
        } catch {
          // Ignore cleanup errors
        }
        
        const frameType = timeOffset === '00:00:00' ? 'first frame' : 'frame at 2s';
        console.log(`Generated thumbnail (${frameType}) for: ${path.basename(filePath)}`);
        return savedUrl;
      } catch (ffmpegError: any) {
        // ffmpeg failed for this time offset, try next one
        console.log(`ffmpeg failed for ${path.basename(filePath)} at ${timeOffset}:`, ffmpegError.message);
        
        // Clean up temp file if it exists
        try {
          await fs.unlink(thumbnailPath);
        } catch {
          // Ignore cleanup errors
        }
        
        // Continue to next time offset
        continue;
      }
    }
    
    // All attempts failed
    console.log(`Failed to generate thumbnail for ${path.basename(filePath)} after trying all time offsets`);
    return null;
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
  
  // Generate thumbnail
  const thumbnailUrl = await generateThumbnail(filePath);
  
  return {
    title: basename,
    format: ext.substring(1), // Remove the dot
    thumbnailUrl: thumbnailUrl || undefined,
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
      console.log(`Adding ${allVideos.length} videos to storage`);
      await storage.addVideos(allVideos);
      console.log('Videos added to storage successfully');
      
      // Notify renderer of all new videos
      const windows = BrowserWindow.getAllWindows();
      allVideos.forEach(video => {
        windows.forEach(window => {
          window.webContents.send('videos:new', video);
        });
      });
      console.log(`Sent ${allVideos.length} video:new events to renderer`);
    } else {
      console.log('No new videos to add');
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
        
        // If thumbnail was generated, ensure it's saved (processVideoFile already handles this)
        // But if somehow it's still missing, try one more time with first frame
        if (!video.thumbnailUrl) {
          const thumbnail = await generateThumbnail(filePath, false, true);
          if (thumbnail) {
            await storage.updateVideo(video.id, { thumbnailUrl: thumbnail });
            video.thumbnailUrl = thumbnail;
          }
        }
        
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
            const windows = BrowserWindow.getAllWindows();
            windows.forEach(window => {
              window.webContents.send('videos:updated', { ...video, thumbnailUrl: thumbnail });
            });
          } else {
            // Try first frame
            const firstFrameThumbnail = await generateThumbnail(video.filePath, false, true);
            if (firstFrameThumbnail) {
              await storage.updateVideo(video.id, { thumbnailUrl: firstFrameThumbnail });
              
              // Notify renderer of update
              const windows = BrowserWindow.getAllWindows();
              windows.forEach(window => {
                window.webContents.send('videos:updated', { ...video, thumbnailUrl: firstFrameThumbnail });
              });
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
      const windows = BrowserWindow.getAllWindows();
      newVideos.forEach(video => {
        windows.forEach(window => {
          window.webContents.send('videos:new', video);
        });
      });
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
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      window.webContents.send('videos:new', video);
    });

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
    
    for (const video of videos) {
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
          const windows = BrowserWindow.getAllWindows();
          windows.forEach(window => {
            window.webContents.send('videos:updated', { ...video, thumbnailUrl: thumbnail });
          });
        } else {
          // If still no thumbnail, try first frame explicitly
          const firstFrameThumbnail = await generateThumbnail(video.filePath, false, true);
          if (firstFrameThumbnail) {
            await storage.updateVideo(video.id, { thumbnailUrl: firstFrameThumbnail });
            generated++;
            
            // Notify renderer of update
            const windows = BrowserWindow.getAllWindows();
            windows.forEach(window => {
              window.webContents.send('videos:updated', { ...video, thumbnailUrl: firstFrameThumbnail });
            });
          } else {
            failed++;
            console.log(`Failed to generate thumbnail for: ${path.basename(video.filePath)}`);
          }
        }
      }
    }
    
    console.log(`Thumbnail generation complete: ${generated} generated, ${failed} failed`);
    return { generated, failed, total: videos.length };
  });

  // Regenerate all thumbnails
  ipcMain.handle('videos:regenerateAllThumbnails', async () => {
    const videos = await storage.getVideos();
    let regenerated = 0;
    
    for (const video of videos) {
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
    }
    
    return regenerated;
  });
}

export { scanVideos, startWatching, stopWatching, regenerateThumbnail };

