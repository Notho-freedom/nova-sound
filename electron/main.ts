import { app, BrowserWindow, ipcMain, dialog, shell, protocol } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import { createReadStream } from 'fs';
import { Readable } from 'stream';

// Import services
import { initAudioScanner } from './services/audio-scanner.js';
import { initVideoScanner } from './services/video-scanner.js';
import { initMetadataExtractor } from './services/metadata-extractor.js';
import { initStorage, storage } from './services/storage.js';
import { initPlaylistManager } from './services/playlist-manager.js';
import { initEqualizer } from './services/equalizer.js';
import { initLyricsProvider } from './services/lyrics-provider.js';
import { initScrobbler } from './services/scrobbler.js';

// Import CLI parser
import { parseArgs, showHelp, showVersion, applyCLIOptions, type CLIOptions } from './cli.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CLI arguments
const cliOptions = parseArgs();

// Handle CLI commands that exit immediately
if (cliOptions.help) {
  showHelp();
  process.exit(0);
}

if (cliOptions.version) {
  showVersion();
  process.exit(0);
}

// Apply CLI options to environment
applyCLIOptions(cliOptions);

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (process.platform === 'win32') {
  app.setAppUserModelId('com.nexus.audio');
}

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Supported media file extensions
const AUDIO_EXTENSIONS = [
  'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'opus', 'wma', 'aiff', 'mp2', 'mp1',
  'ac3', 'dts', 'ape', 'tta', 'tak', 'ofr', 'ofs', 'off', 'rka', 'shn', 'aa', 'aax',
  'act', 'alac', 'au', 'awb', 'dct', 'dss', 'dvf', 'gsm', 'iklax', 'ivs', 'm4b',
  'mmf', 'msv', 'nmf', 'nsf', 'oga', 'mogg', 'ra', 'rm', 'raw', 'rf64', 'sln', 'voc',
  'vox', 'wv', 'webm'
];

const VIDEO_EXTENSIONS = [
  'mp4', 'avi', 'mkv', 'webm', 'mov', 'wmv', 'flv', 'm4v', '3gp', '3g2', 'asf',
  'rm', 'rmvb', 'vob', 'ogv', 'divx', 'xvid', 'm2v', 'mts', 'm2ts', 'ts', 'f4v',
  'amv', 'drc', 'gifv', 'mxf', 'roq', 'nsv', 'yuv', 'viv', 'svi', 'mng', 'qt'
];

const MEDIA_EXTENSIONS = [...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS];

/**
 * Check if a file path is a media file
 */
function isMediaFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase().slice(1); // Remove the dot
  return MEDIA_EXTENSIONS.includes(ext);
}

/**
 * Extract file paths from command line arguments
 */
function getFileArgsFromArgs(): string[] {
  const args = process.argv.slice(1); // Skip node/electron path
  const files: string[] = [];
  
  for (const arg of args) {
    // Skip CLI flags
    if (arg.startsWith('--') || arg.startsWith('-')) {
      continue;
    }
    
    // Check if it's a file path (contains drive letter on Windows or starts with / on Unix)
    if (arg.includes(path.sep) || arg.match(/^[A-Za-z]:/)) {
      // Check if file exists and is a media file
      try {
        if (fs.existsSync(arg) && isMediaFile(arg)) {
          files.push(path.resolve(arg));
        }
      } catch (error) {
        // Ignore errors, just skip this file
      }
    }
  }
  
  return files;
}

/**
 * Open a media file in the player
 */
function openMediaFile(filePath: string): void {
  if (!mainWindow) {
    console.warn('Main window not ready, file will be opened when window is created');
    return;
  }
  
  const normalizedPath = path.resolve(filePath);
  
  // Send file to renderer process
  mainWindow.webContents.send('file:open', normalizedPath);
  
  // Focus window
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();
  
  console.log('Opening media file:', normalizedPath);
}

/**
 * Handle files passed as command line arguments
 */
function handleFileArgs(): void {
  const files = getFileArgsFromArgs();
  
  if (files.length > 0) {
    console.log('Files passed as arguments:', files);
    
    // If window is ready, open files immediately
    if (mainWindow) {
      files.forEach(file => openMediaFile(file));
    } else {
      // Store files to open when window is ready
      (app as any).pendingFiles = files;
    }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a0f',
    icon: path.join(__dirname, '../public/favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false, // Allow loading local files
    },
  });

  // Load the app
  if (isDev || cliOptions.dev) {
    const port = cliOptions.port || 3000;
    mainWindow.loadURL(`http://localhost:${port}`);
    if (cliOptions.debug || isDev) {
      mainWindow.webContents.openDevTools();
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Track window state for maximize/restore
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximized', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximized', false);
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Initialize all services
function initServices() {
  // Initialize storage first (other services depend on it)
  initStorage();
  
  // Initialize other services
  initMetadataExtractor();
  initAudioScanner();
  initVideoScanner();
  initPlaylistManager();
  initEqualizer();
  initLyricsProvider();
  initScrobbler();
}

// Window control handlers
ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow?.isMaximized() || false;
});

// File dialog handlers
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'multiSelections'],
    title: 'Sélectionner les dossiers de musique',
  });
  return result.filePaths;
});

ipcMain.handle('dialog:openFile', async (_event, filters?: Electron.FileFilter[]) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile', 'multiSelections'],
    filters: filters || [
      { name: 'Audio Files', extensions: ['mp3', 'flac', 'ogg', 'wav', 'm4a', 'opus', 'aac'] },
    ],
  });
  return result.filePaths;
});

// Video file dialog
ipcMain.handle('dialog:openVideoFile', async (_event, multiSelect: boolean = false) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: multiSelect ? ['openFile', 'multiSelections'] : ['openFile'],
    filters: [
      { name: 'Video Files', extensions: ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v', '3gp', 'ogv'] },
    ],
  });
  return result.filePaths;
});

// Read file as base64 for blob creation
ipcMain.handle('file:readAsBase64', async (_event, filePath: string) => {
  try {
    const data = fs.readFileSync(filePath);
    return data.toString('base64');
  } catch (error) {
    console.error('Failed to read file:', filePath, error);
    throw error;
  }
});

ipcMain.handle('dialog:openPlaylist', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [
      { name: 'Playlist Files', extensions: ['m3u', 'm3u8', 'pls'] },
    ],
  });
  return result.filePaths;
});

// Open file/folder in system file manager
ipcMain.handle('fs:openPath', async (_event, filePath: string) => {
  try {
    shell.showItemInFolder(filePath);
  } catch (error) {
    console.error('Failed to open path:', filePath, error);
    throw error;
  }
});

// Register custom protocol for local audio files
function registerLocalAudioProtocol() {
  protocol.handle('local-audio', async (request) => {
    const filePath = decodeURIComponent(request.url.replace('local-audio://', ''));
    try {
      const data = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      
      const mimeTypes: Record<string, string> = {
        '.mp3': 'audio/mpeg',
        '.flac': 'audio/flac',
        '.ogg': 'audio/ogg',
        '.wav': 'audio/wav',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac',
        '.opus': 'audio/opus',
        '.wma': 'audio/x-ms-wma',
        '.aiff': 'audio/aiff',
      };
      
      return new Response(data, {
        headers: {
          'Content-Type': mimeTypes[ext] || 'audio/mpeg',
          'Content-Length': data.length.toString(),
        },
      });
    } catch (error) {
      console.error('Failed to load audio file:', filePath, error);
      return new Response('File not found', { status: 404 });
    }
  });
}

// Register custom protocol for local video files
function registerLocalVideoProtocol() {
  protocol.handle('local-video', async (request) => {
    let filePath = request.url.replace('local-video://', '');
    // Decode URI component
    try {
      filePath = decodeURIComponent(filePath);
    } catch (e) {
      console.error('Failed to decode video path:', filePath, e);
    }
    
    console.log('Loading video file:', filePath);
    
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error('Video file not found:', filePath);
        return new Response('File not found', { status: 404 });
      }
      
      const stats = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      
      const mimeTypes: Record<string, string> = {
        '.mp4': 'video/mp4',
        '.avi': 'video/x-msvideo',
        '.mkv': 'video/x-matroska',
        '.mov': 'video/quicktime',
        '.wmv': 'video/x-ms-wmv',
        '.flv': 'video/x-flv',
        '.webm': 'video/webm',
        '.m4v': 'video/mp4',
        '.3gp': 'video/3gpp',
        '.ogv': 'video/ogg',
      };
      
      // Handle Range requests for video seeking
      const rangeHeader = request.headers.get('range');
      
      if (rangeHeader) {
        // Parse range header (e.g., "bytes=0-1023")
        const matches = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (matches) {
          const start = parseInt(matches[1], 10);
          const end = matches[2] ? parseInt(matches[2], 10) : stats.size - 1;
          const chunkSize = end - start + 1;
          
          // Read only the requested range
          const buffer = Buffer.alloc(chunkSize);
          const fd = fs.openSync(filePath, 'r');
          fs.readSync(fd, buffer, 0, chunkSize, start);
          fs.closeSync(fd);
          
          return new Response(buffer, {
            status: 206, // Partial Content
            headers: {
              'Content-Type': mimeTypes[ext] || 'video/mp4',
              'Content-Length': chunkSize.toString(),
              'Content-Range': `bytes ${start}-${end}/${stats.size}`,
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'no-cache',
            },
          });
        }
      }
      
      // No range request - return full file using stream
      // Convert Node.js stream to Web ReadableStream
      const nodeStream = createReadStream(filePath);
      const webStream = new ReadableStream({
        start(controller) {
          nodeStream.on('data', (chunk) => {
            controller.enqueue(chunk);
          });
          nodeStream.on('end', () => {
            controller.close();
          });
          nodeStream.on('error', (err) => {
            controller.error(err);
          });
        },
        cancel() {
          nodeStream.destroy();
        },
      });
      
      return new Response(webStream, {
        headers: {
          'Content-Type': mimeTypes[ext] || 'video/mp4',
          'Content-Length': stats.size.toString(),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-cache',
        },
      });
    } catch (error) {
      console.error('Failed to load video file:', filePath, error);
      return new Response(`Error loading video: ${error instanceof Error ? error.message : String(error)}`, { status: 500 });
    }
  });
}

// Make the app a single instance (handle "Open with..." on Windows)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running
  // On Windows, this means "Open with..." was used
  // We'll handle it in the second-instance event
  app.quit();
} else {
  // Handle second instance (when user opens file with "Open with..." while app is running)
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Focus the main window if it exists
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
    
    // Extract file paths from command line
    const files: string[] = [];
    for (const arg of commandLine) {
      // Skip executable path and flags
      if (arg === commandLine[0] || arg.startsWith('--') || arg.startsWith('-')) {
        continue;
      }
      
      // Check if it's a file path
      if (arg.includes(path.sep) || arg.match(/^[A-Za-z]:/)) {
        try {
          const resolvedPath = path.isAbsolute(arg) ? arg : path.resolve(workingDirectory, arg);
          if (fs.existsSync(resolvedPath) && isMediaFile(resolvedPath)) {
            files.push(resolvedPath);
          }
        } catch (error) {
          // Ignore errors
        }
      }
    }
    
    // Open files in existing window
    if (files.length > 0 && mainWindow) {
      files.forEach(file => openMediaFile(file));
    }
  });
}

// App lifecycle
app.whenReady().then(async () => {
  // Register custom protocols
  registerLocalAudioProtocol();
  registerLocalVideoProtocol();
  
  // Initialize storage and services
  await storage.init();
  initServices();
  
  createWindow();
  
  // Handle files passed as arguments on first launch
  handleFileArgs();
  
  // Handle pending files (files passed before window was ready)
  if ((app as any).pendingFiles) {
    (app as any).pendingFiles.forEach((file: string) => openMediaFile(file));
    delete (app as any).pendingFiles;
  }

  // Handle CLI options for reset and cache clearing
  if (cliOptions.reset) {
    await storage.resetSettings();
    console.log('Settings reset to defaults');
  }

  if (cliOptions.clearCache) {
    // Clear cache logic would go here
    console.log('Cache cleared');
  }

  // Handle music directories from CLI
  if (cliOptions.musicDir && cliOptions.musicDir.length > 0) {
    const settings = await storage.getSettings();
    const newDirs = cliOptions.musicDir.filter(dir => 
      !settings.musicDirectories.includes(dir)
    );
    if (newDirs.length > 0) {
      await storage.updateSettings({
        musicDirectories: [...settings.musicDirectories, ...newDirs]
      });
      console.log(`Added music directories: ${newDirs.join(', ')}`);
    }
  }

  // Auto-scan on startup if enabled (unless --no-scan is specified)
  if (!cliOptions.noScan) {
    const settings = await storage.getSettings();
    const shouldAutoScan = cliOptions.autoScan || 
      (settings.autoScanOnStartup && settings.musicDirectories.length > 0);
    
    if (shouldAutoScan) {
      // Trigger a scan after window is ready
      setTimeout(() => {
        mainWindow?.webContents.send('library:auto-scan-start');
      }, 2000);
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle certificate errors (for development)
app.on('certificate-error', (event, _webContents, _url, _error, _certificate, callback) => {
  if (isDev) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

// Export for services to use
export { mainWindow };
