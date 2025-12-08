import { ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { watch } from 'chokidar';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import { storage } from './storage.js';
const execAsync = promisify(exec);
// Supported video formats
const VIDEO_EXTENSIONS = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.3gp', '.ogv'];
let watcher = null;
let isScanning = false;
/**
 * Check if a file is a supported video file
 */
function isVideoFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return VIDEO_EXTENSIONS.includes(ext);
}
/**
 * Recursively scan a directory for video files
 */
async function scanDirectory(dirPath) {
    const videoFiles = [];
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
            }
            else if (entry.isFile() && isVideoFile(entry.name)) {
                videoFiles.push(fullPath);
            }
        }
    }
    catch (error) {
        console.error(`Error scanning directory ${dirPath}:`, error);
    }
    return videoFiles;
}
/**
 * Get file stats
 */
async function getFileStats(filePath) {
    try {
        const stats = await fs.stat(filePath);
        return { size: stats.size, mtime: stats.mtimeMs ? new Date(stats.mtimeMs) : stats.mtime };
    }
    catch {
        return null;
    }
}
/**
 * Generate thumbnail for video using ffmpeg
 */
async function generateThumbnail(filePath) {
    try {
        // Check if thumbnail already exists
        const existingThumbnail = await storage.getThumbnailPath(filePath);
        if (existingThumbnail) {
            return existingThumbnail;
        }
        // Try to use ffmpeg to extract a frame
        // Extract frame at 1 second (or 10% of duration if available)
        const thumbnailPath = path.join(path.dirname(filePath), `temp_thumb_${Date.now()}.jpg`);
        try {
            // Try ffmpeg command
            await execAsync(`ffmpeg -i "${filePath}" -ss 00:00:01 -vframes 1 -vf "scale=320:-1" "${thumbnailPath}"`);
            // Read the generated thumbnail
            const thumbnailData = await fs.readFile(thumbnailPath);
            // Save to storage
            const savedUrl = await storage.saveThumbnail(thumbnailData, filePath);
            // Clean up temp file
            try {
                await fs.unlink(thumbnailPath);
            }
            catch {
                // Ignore cleanup errors
            }
            return savedUrl;
        }
        catch (ffmpegError) {
            // ffmpeg not available or failed
            console.log(`ffmpeg not available for ${filePath}, skipping thumbnail generation`);
            // Clean up temp file if it exists
            try {
                await fs.unlink(thumbnailPath);
            }
            catch {
                // Ignore cleanup errors
            }
            return null;
        }
    }
    catch (error) {
        console.error(`Error generating thumbnail for ${filePath}:`, error);
        return null;
    }
}
/**
 * Extract basic video metadata (simplified - could use ffprobe in the future)
 */
async function extractVideoMetadata(filePath) {
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
async function processVideoFile(filePath) {
    try {
        const stats = await getFileStats(filePath);
        if (!stats)
            return null;
        const metadata = await extractVideoMetadata(filePath);
        const video = {
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
    }
    catch (error) {
        console.error(`Error processing video file ${filePath}:`, error);
        return null;
    }
}
/**
 * Send progress update to renderer
 */
function sendProgress(progress) {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
        window.webContents.send('videos:scan-progress', progress);
    });
}
/**
 * Scan library for videos
 */
async function scanVideos(directories) {
    if (isScanning) {
        console.warn('Video scan already in progress');
        return [];
    }
    isScanning = true;
    const allVideos = [];
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
        const allVideoFiles = [];
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
        }
        else {
            console.log('No new videos to add');
        }
        sendProgress({
            current: allVideos.length,
            total: allVideos.length,
            file: '',
            phase: 'complete',
        });
        return allVideos;
    }
    catch (error) {
        console.error('Error scanning videos:', error);
        throw error;
    }
    finally {
        isScanning = false;
    }
}
/**
 * Start watching directories for changes
 */
function startWatching(directories) {
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
    ipcMain.handle('videos:scan', async (_event, directories) => {
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
    ipcMain.handle('videos:getVideo', async (_event, videoId) => {
        return storage.getVideo(videoId);
    });
    ipcMain.handle('videos:updateMetadata', async (_event, videoId, metadata) => {
        const video = await storage.getVideo(videoId);
        if (!video)
            return null;
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
    ipcMain.handle('videos:addFiles', async (_event, filePaths) => {
        const newVideos = [];
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
    ipcMain.handle('videos:addFromUrl', async (_event, url, title) => {
        const video = {
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
}
export { scanVideos, startWatching, stopWatching };
//# sourceMappingURL=video-scanner.js.map