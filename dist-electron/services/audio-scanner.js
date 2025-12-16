import { ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { watch } from 'chokidar';
import { v4 as uuidv4 } from 'uuid';
import { extractMetadata } from './metadata-extractor.js';
import { storage } from './storage.js';
// Supported audio formats
const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.ogg', '.wav', '.m4a', '.opus', '.aac', '.wma', '.aiff'];
let watcher = null;
let isScanning = false;
/**
 * Check if a file is a supported audio file
 */
function isAudioFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return AUDIO_EXTENSIONS.includes(ext);
}
/**
 * Recursively scan a directory for audio files
 */
async function scanDirectory(dirPath) {
    const audioFiles = [];
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                // Skip hidden directories and common non-music folders
                if (!entry.name.startsWith('.') &&
                    !['node_modules', '$RECYCLE.BIN', 'System Volume Information'].includes(entry.name)) {
                    const subFiles = await scanDirectory(fullPath);
                    audioFiles.push(...subFiles);
                }
            }
            else if (entry.isFile() && isAudioFile(entry.name)) {
                audioFiles.push(fullPath);
            }
        }
    }
    catch (error) {
        console.error(`Error scanning directory ${dirPath}:`, error);
    }
    return audioFiles;
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
 * Process a single audio file
 */
async function processAudioFile(filePath) {
    try {
        const stats = await getFileStats(filePath);
        if (!stats)
            return null;
        const metadata = await extractMetadata(filePath);
        if (!metadata)
            return null;
        // Generate cover URL from embedded artwork or use placeholder
        let coverUrl = '';
        if (metadata.artwork) {
            // Store artwork and get path
            coverUrl = await storage.saveArtwork(metadata.artwork, filePath);
        }
        const track = {
            id: uuidv4(),
            filePath,
            title: metadata.title || path.basename(filePath, path.extname(filePath)),
            artist: metadata.artist || 'Artiste inconnu',
            album: metadata.album || 'Album inconnu',
            duration: metadata.duration || 0,
            coverUrl,
            year: metadata.year,
            genre: metadata.genre,
            trackNumber: metadata.trackNumber,
            discNumber: metadata.discNumber,
            bitrate: metadata.bitrate,
            sampleRate: metadata.sampleRate,
            channels: metadata.channels,
            format: metadata.format,
            addedAt: new Date().toISOString(),
            fileSize: stats.size,
            lastModified: stats.mtime.toISOString(),
        };
        return track;
    }
    catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
        return null;
    }
}
/**
 * Send progress update to renderer
 */
function sendProgress(progress) {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
        window.webContents.send('library:scan-progress', progress);
    });
}
/**
 * Scan multiple directories for audio files
 */
async function scanLibrary(directories) {
    if (isScanning) {
        throw new Error('Scan already in progress');
    }
    isScanning = true;
    const newTracks = [];
    const existingTracks = await storage.getLibrary();
    const existingPaths = new Set(existingTracks.map(t => t.filePath));
    try {
        // Phase 1: Scan directories for audio files
        sendProgress({ current: 0, total: 0, file: '', phase: 'scanning' });
        const allFiles = [];
        for (const dir of directories) {
            const files = await scanDirectory(dir);
            allFiles.push(...files);
        }
        const total = allFiles.length;
        // Phase 2: Extract metadata from each file
        for (let i = 0; i < allFiles.length; i++) {
            const filePath = allFiles[i];
            sendProgress({
                current: i + 1,
                total,
                file: path.basename(filePath),
                phase: 'extracting',
            });
            // Skip if already exists
            if (existingPaths.has(filePath)) {
                continue;
            }
            const track = await processAudioFile(filePath);
            if (track) {
                newTracks.push(track);
                // Notify renderer in real-time as each track is processed
                const windows = BrowserWindow.getAllWindows();
                windows.forEach(window => {
                    window.webContents.send('library:track-added', track);
                });
            }
        }
        // Phase 3: Merge with existing tracks and save to storage (duplicates removed in saveLibrary)
        sendProgress({ current: total, total, file: '', phase: 'indexing' });
        if (newTracks.length > 0) {
            const allTracks = [...existingTracks, ...newTracks];
            // saveLibrary will automatically remove duplicates
            await storage.saveLibrary(allTracks);
        }
        // Phase 4: Complete
        sendProgress({ current: total, total, file: '', phase: 'complete' });
    }
    finally {
        isScanning = false;
    }
    return newTracks;
}
/**
 * Start watching directories for changes
 */
function startWatching(directories) {
    // Stop existing watcher
    stopWatching();
    watcher = watch(directories, {
        ignored: /(^|[\/\\])\../, // Ignore hidden files
        persistent: true,
        ignoreInitial: true,
        depth: 10,
    });
    watcher
        .on('add', async (filePath) => {
        if (isAudioFile(filePath)) {
            console.log(`New audio file detected: ${filePath}`);
            const track = await processAudioFile(filePath);
            if (track) {
                await storage.addTrack(track);
                // Notify renderer
                const windows = BrowserWindow.getAllWindows();
                windows.forEach(window => {
                    window.webContents.send('library:track-added', track);
                });
            }
        }
    })
        .on('unlink', async (filePath) => {
        if (isAudioFile(filePath)) {
            console.log(`Audio file removed: ${filePath}`);
            await storage.removeTrackByPath(filePath);
            // Notify renderer
            const windows = BrowserWindow.getAllWindows();
            windows.forEach(window => {
                window.webContents.send('library:track-removed', filePath);
            });
        }
    })
        .on('change', async (filePath) => {
        if (isAudioFile(filePath)) {
            console.log(`Audio file changed: ${filePath}`);
            const track = await processAudioFile(filePath);
            if (track) {
                await storage.updateTrackByPath(filePath, track);
                // Notify renderer
                const windows = BrowserWindow.getAllWindows();
                windows.forEach(window => {
                    window.webContents.send('library:track-updated', track);
                });
            }
        }
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
 * Initialize IPC handlers for audio scanner
 */
export function initAudioScanner() {
    ipcMain.handle('library:scan', async (_event, directories) => {
        const tracks = await scanLibrary(directories);
        // Start watching after scan
        startWatching(directories);
        return tracks;
    });
    ipcMain.handle('library:get', async () => {
        return storage.getLibrary();
    });
    ipcMain.handle('library:getTrack', async (_event, trackId) => {
        return storage.getTrack(trackId);
    });
    ipcMain.handle('library:rescan', async () => {
        const settings = await storage.getSettings();
        if (settings.musicDirectories.length > 0) {
            return scanLibrary(settings.musicDirectories);
        }
        return [];
    });
    // Check if file exists
    ipcMain.handle('fs:exists', async (_event, filePath) => {
        try {
            await fs.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    });
}
export { scanLibrary, startWatching, stopWatching };
//# sourceMappingURL=audio-scanner.js.map