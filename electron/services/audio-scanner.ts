import { ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { watch, FSWatcher } from 'chokidar';
import { v4 as uuidv4 } from 'uuid';
import type { ExtractedMetadata } from './metadata-extractor.js';
import { storage } from './storage.js';
import { WorkerPool } from './worker-pool.js';
import * as os from 'os';

export interface ScannedTrack {
  id: string;
  filePath: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverUrl: string;
  year?: number;
  genre?: string;
  trackNumber?: number;
  discNumber?: number;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  format: string;
  addedAt: string;
  fileSize: number;
  lastModified: string;
}

interface ScanProgress {
  current: number;
  total: number;
  file: string;
  phase: 'scanning' | 'extracting' | 'indexing' | 'complete';
}

// Supported audio formats
const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.ogg', '.wav', '.m4a', '.opus', '.aac', '.wma', '.aiff'];

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
let pendingTrackEvents: ScannedTrack[] = [];
let pendingTrackTimer: NodeJS.Timeout | null = null;

function flushPendingTrackEvents() {
  if (pendingTrackEvents.length === 0) return;
  const windows = BrowserWindow.getAllWindows();
  const batch = pendingTrackEvents;
  pendingTrackEvents = [];
  pendingTrackTimer = null;
  batch.forEach(track => {
    windows.forEach(window => {
      window.webContents.send('library:track-added', track);
    });
  });
}

function queueTrackAddedEvent(track: ScannedTrack) {
  pendingTrackEvents.push(track);
  if (!pendingTrackTimer) {
    pendingTrackTimer = setTimeout(flushPendingTrackEvents, 100);
  }
}

const metadataWorkerPool = new WorkerPool<
  { filePath: string },
  { metadata: ExtractedMetadata | null; artwork?: { dataBase64: string; format: string } | null }
>(
  new URL('../workers/audio-metadata-worker.js', import.meta.url),
  Math.max(2, Math.min(4, Math.max(1, os.cpus().length - 1)))
);

/**
 * Check if a file is a supported audio file
 */
function isAudioFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return AUDIO_EXTENSIONS.includes(ext);
}

/**
 * Recursively scan a directory for audio files
 */
async function scanDirectory(dirPath: string): Promise<string[]> {
  const audioFiles: string[] = [];
  
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
      } else if (entry.isFile() && isAudioFile(entry.name)) {
        audioFiles.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
  }
  
  return audioFiles;
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
 * Process a single audio file
 */
async function processAudioFile(filePath: string): Promise<ScannedTrack | null> {
  try {
    const stats = await getFileStats(filePath);
    if (!stats) return null;

    const workerResult = await metadataWorkerPool.runTask({ filePath });
    const metadata = workerResult?.metadata;
    if (!metadata) return null;

    // Generate cover URL from embedded artwork or use placeholder
    let coverUrl = '';
    if (workerResult?.artwork?.dataBase64 && workerResult?.artwork?.format) {
      coverUrl = await storage.saveArtwork({
        data: Buffer.from(workerResult.artwork.dataBase64, 'base64'),
        format: workerResult.artwork.format,
      }, filePath);
    }

    const track: ScannedTrack = {
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
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
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
    window.webContents.send('library:scan-progress', progress);
  });
}

/**
 * Scan multiple directories for audio files
 * Improved with better parallelization, progress tracking, and error handling
 */
async function scanLibrary(directories: string[]): Promise<ScannedTrack[]> {
  if (isScanning) {
    throw new Error('Scan already in progress');
  }

  isScanning = true;
  const newTracks: ScannedTrack[] = [];
  const existingTracks = await storage.getLibrary();
  const existingPaths = new Map(existingTracks.map(t => [t.filePath, t]));
  const scanStartTime = Date.now();
  
  console.log(`\n🎵 Starting library scan of ${directories.length} directories...`);

  try {
    // Phase 1: Scan directories for audio files (parallel directory scanning)
    sendProgress({ current: 0, total: 0, file: 'Initialisation...', phase: 'scanning' });
    
    const allFiles: string[] = [];
    const scanPromises = directories.map(async (dir) => {
      try {
        console.log(`📂 Scanning directory: ${dir}`);
        const files = await scanDirectory(dir);
        console.log(`✅ Found ${files.length} audio files in ${dir}`);
        return files;
      } catch (error) {
        console.error(`❌ Error scanning ${dir}:`, error);
        return [];
      }
    });
    
    const directoryResults = await Promise.all(scanPromises);
    directoryResults.forEach(files => allFiles.push(...files));

    const total = allFiles.length;
    console.log(`\n📊 Total audio files found: ${total}`);
    
    if (total === 0) {
      sendProgress({ current: 0, total: 0, file: 'Aucun fichier trouvé', phase: 'complete' });
      return [];
    }
    
    // Phase 2: Filter and process files
    // Skip files that already exist and haven't been modified
    const filesToProcess: string[] = [];
    const skippedFiles: string[] = [];
    const STAT_BATCH_SIZE = 25;

    for (let i = 0; i < allFiles.length; i += STAT_BATCH_SIZE) {
      const batch = allFiles.slice(i, i + STAT_BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (filePath) => {
          const existingTrack = existingPaths.get(filePath);
          if (!existingTrack) return { filePath, skip: false };

          const stats = await getFileStats(filePath);
          if (stats && new Date(existingTrack.lastModified).getTime() === stats.mtime.getTime()) {
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
      console.log('✅ Library is up to date');
      sendProgress({ current: total, total, file: 'Bibliothèque à jour', phase: 'complete' });
      return [];
    }
    
    // Phase 3: Extract metadata with adaptive batch sizing
    // Optimize batch size based on system performance
    const BATCH_SIZE = Math.max(8, Math.min(20, os.cpus().length * 3));
    let processedCount = skippedFiles.length;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
      const batch = filesToProcess.slice(i, i + BATCH_SIZE);
      const batchStartTime = Date.now();
      
      // Process batch in parallel with error isolation
      const batchPromises = batch.map(async (filePath, index) => {
        try {
          const track = await processAudioFile(filePath);
          if (track) {
            // Send real-time updates to renderer
            queueTrackAddedEvent(track);
            return { success: true, track };
          }
          return { success: false, track: null };
        } catch (error) {
          console.error(`❌ Error processing ${path.basename(filePath)}:`, error);
          return { success: false, track: null };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      // Collect results and update counters
      for (const result of batchResults) {
        if (result.success && result.track) {
          newTracks.push(result.track);
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
      
      // Send detailed progress
      sendProgress({
        current: processedCount,
        total,
        file: `${path.basename(batch[batch.length - 1] || '')} (${successCount} OK, ${errorCount} erreurs)`,
        phase: 'extracting',
      });
      
      // Log progress every 5 batches
      if ((i / BATCH_SIZE) % 5 === 0) {
        console.log(`⏳ Progress: ${processedCount}/${total} (${Math.round((processedCount/total)*100)}%) - ETA: ${Math.round(estimatedTimeRemaining)}s`);
      }
    }

    // Phase 4: Index and save to storage
    console.log('\n💾 Saving to database...');
    sendProgress({ current: total, total, file: 'Sauvegarde...', phase: 'indexing' });
    
    if (newTracks.length > 0) {
      // Merge with existing tracks (keep unchanged ones)
      const unchangedTracks = existingTracks.filter(t => skippedFiles.includes(t.filePath));
      const allTracks = [...unchangedTracks, ...newTracks];
      await storage.saveLibrary(allTracks);
    }

    // Phase 5: Complete with statistics
    const scanDuration = ((Date.now() - scanStartTime) / 1000).toFixed(1);
    console.log(`\n✅ Scan complete!`);
    console.log(`   📁 Total files: ${total}`);
    console.log(`   ✨ New tracks: ${newTracks.length}`);
    console.log(`   ⏭️  Skipped: ${skippedFiles.length}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   ⏱️  Duration: ${scanDuration}s`);
    console.log(`   ⚡ Speed: ${(total / parseFloat(scanDuration)).toFixed(1)} files/s\n`);
    
    sendProgress({ 
      current: total, 
      total, 
      file: `✅ ${newTracks.length} nouveaux, ${skippedFiles.length} ignorés, ${errorCount} erreurs - ${scanDuration}s`, 
      phase: 'complete' 
    });

  } finally {
    isScanning = false;
  }

  return newTracks;
}

/**
 * Start watching directories for changes
 */
function startWatching(directories: string[]) {
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
          queueTrackAddedEvent(track);
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
  ipcMain.handle('library:scan', async (_event, directories: string[]) => {
    const tracks = await scanLibrary(directories);
    // Start watching after scan
    startWatching(directories);
    return tracks;
  });

  ipcMain.handle('library:get', async () => {
    return storage.getLibrary();
  });

  ipcMain.handle('library:getTrack', async (_event, trackId: string) => {
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
  ipcMain.handle('fs:exists', async (_event, filePath: string) => {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  });
}

export { scanLibrary, startWatching, stopWatching };

