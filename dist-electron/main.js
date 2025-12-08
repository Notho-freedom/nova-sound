import { app, BrowserWindow, ipcMain, dialog, shell, protocol } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
// Import services
import { initAudioScanner } from './services/audio-scanner.js';
import { initVideoScanner } from './services/video-scanner.js';
import { initMetadataExtractor } from './services/metadata-extractor.js';
import { initStorage, storage } from './services/storage.js';
import { initPlaylistManager } from './services/playlist-manager.js';
import { initEqualizer } from './services/equalizer.js';
import { initLyricsProvider } from './services/lyrics-provider.js';
import { initScrobbler } from './services/scrobbler.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (process.platform === 'win32') {
    app.setAppUserModelId('com.nexus.audio');
}
let mainWindow = null;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
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
    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    }
    else {
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
    }
    else {
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
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory', 'multiSelections'],
        title: 'Sélectionner les dossiers de musique',
    });
    return result.filePaths;
});
ipcMain.handle('dialog:openFile', async (_event, filters) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: filters || [
            { name: 'Audio Files', extensions: ['mp3', 'flac', 'ogg', 'wav', 'm4a', 'opus', 'aac'] },
        ],
    });
    return result.filePaths;
});
// Read file as base64 for blob creation
ipcMain.handle('file:readAsBase64', async (_event, filePath) => {
    try {
        const data = fs.readFileSync(filePath);
        return data.toString('base64');
    }
    catch (error) {
        console.error('Failed to read file:', filePath, error);
        throw error;
    }
});
ipcMain.handle('dialog:openPlaylist', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'Playlist Files', extensions: ['m3u', 'm3u8', 'pls'] },
        ],
    });
    return result.filePaths;
});
// Register custom protocol for local audio files
function registerLocalAudioProtocol() {
    protocol.handle('local-audio', async (request) => {
        const filePath = decodeURIComponent(request.url.replace('local-audio://', ''));
        try {
            const data = fs.readFileSync(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
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
        }
        catch (error) {
            console.error('Failed to load audio file:', filePath, error);
            return new Response('File not found', { status: 404 });
        }
    });
}
// App lifecycle
app.whenReady().then(async () => {
    // Register custom protocol
    registerLocalAudioProtocol();
    // Initialize storage and services
    await storage.init();
    initServices();
    createWindow();
    // Auto-scan on startup if enabled
    const settings = await storage.getSettings();
    if (settings.autoScanOnStartup && settings.musicDirectories.length > 0) {
        // Trigger a scan after window is ready
        setTimeout(() => {
            mainWindow?.webContents.send('library:auto-scan-start');
        }, 2000);
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
    }
    else {
        callback(false);
    }
});
// Export for services to use
export { mainWindow };
//# sourceMappingURL=main.js.map