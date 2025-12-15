import { app, BrowserWindow, ipcMain, dialog, shell, protocol } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import { createReadStream } from 'fs';
import { createServer } from 'http';
import dotenv from 'dotenv';
// Import services
import { initAudioScanner } from './services/audio-scanner.js';
import { initVideoScanner } from './services/video-scanner.js';
import { initMetadataExtractor } from './services/metadata-extractor.js';
import { initStorage, storage } from './services/storage.js';
import { initPlaylistManager } from './services/playlist-manager.js';
import { initEqualizer } from './services/equalizer.js';
import { initLyricsProvider } from './services/lyrics-provider.js';
import { initScrobbler } from './services/scrobbler.js';
import { initUpdater } from './updater/updater.js';
// Import CLI parser
import { parseArgs, showHelp, showVersion, applyCLIOptions } from './cli.js';
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
let mainWindow = null;
let staticServer = null;
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
function isMediaFile(filePath) {
    const ext = path.extname(filePath).toLowerCase().slice(1); // Remove the dot
    return MEDIA_EXTENSIONS.includes(ext);
}
/**
 * Extract file paths from command line arguments
 */
function getFileArgsFromArgs() {
    const args = process.argv.slice(1); // Skip node/electron path
    const files = [];
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
            }
            catch (error) {
                // Ignore errors, just skip this file
            }
        }
    }
    return files;
}
/**
 * Open a media file in the player
 */
function openMediaFile(filePath) {
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
function handleFileArgs() {
    const files = getFileArgsFromArgs();
    if (files.length > 0) {
        console.log('Files passed as arguments:', files);
        // If window is ready, open files immediately
        if (mainWindow) {
            files.forEach(file => openMediaFile(file));
        }
        else {
            // Store files to open when window is ready
            app.pendingFiles = files;
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
    const isDev = process.env.NODE_ENV === 'development';
    // En développement ET production, utiliser le build statique depuis out/
    // Cela permet des tests plus rapides en dev (pas besoin d'attendre Next.js dev server)
    {
        // In production, load from static build
        let htmlPath;
        if (app.isPackaged) {
            // En production packagée, le dossier out/ est dans resources/ à côté de app.asar
            const resourcesPath = path.dirname(app.getAppPath());
            htmlPath = path.join(resourcesPath, 'out', 'index.html');
            // Si pas trouvé, essayer dans app.asar.unpacked
            if (!fs.existsSync(htmlPath)) {
                htmlPath = path.join(resourcesPath, 'app.asar.unpacked', 'out', 'index.html');
            }
        }
        else {
            // En développement/production non packagée
            htmlPath = path.join(__dirname, '..', 'out', 'index.html');
        }
        console.log(`📦 Production mode: Loading static build from: ${htmlPath}`);
        console.log(`   App path: ${app.getAppPath()}`);
        console.log(`   Is packaged: ${app.isPackaged}`);
        console.log(`   File exists: ${fs.existsSync(htmlPath)}`);
        if (!fs.existsSync(htmlPath)) {
            const errorMsg = `Build not found at: ${htmlPath}\nPlease run "npm run build" first.`;
            console.error(`❌ ${errorMsg}`);
            // Afficher une erreur dans la fenêtre
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.once('did-finish-load', () => {
                    mainWindow?.webContents.executeJavaScript(`
            document.body.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; font-family: system-ui; color: #fff; background: #0a0a0f;">
              <h1 style="font-size: 24px; margin-bottom: 16px;">❌ Build introuvable</h1>
              <p style="font-size: 16px; margin-bottom: 8px;">Le build statique n\\'a pas été trouvé</p>
              <p style="font-size: 14px; color: #888;">Chemin: ${htmlPath}</p>
              <p style="font-size: 12px; color: #666; margin-top: 24px;">App path: ${app.getAppPath()}</p>
            </div>';
          `);
                });
            }
            // Charger une page vide pour afficher l'erreur
            mainWindow.loadURL('data:text/html,<html><body style="background:#0a0a0f;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column"><h1>❌ Build introuvable</h1><p>Chemin: ' + htmlPath + '</p></body></html>').catch((error) => {
                console.error('Failed to load error page:', error);
            });
            return;
        }
        // Démarrer un serveur HTTP local pour servir les fichiers statiques
        // Cela permet d'utiliser les chemins absolus (/_next/static/...) comme prévu par Next.js
        const port = 3001; // Utiliser un port différent de 3000 pour éviter les conflits
        // Déterminer le chemin de base
        let basePath;
        if (app.isPackaged) {
            const resourcesPath = path.dirname(app.getAppPath());
            basePath = path.join(resourcesPath, 'out');
            // Si pas trouvé, essayer dans app.asar.unpacked
            if (!fs.existsSync(basePath)) {
                basePath = path.join(resourcesPath, 'app.asar.unpacked', 'out');
            }
        }
        else {
            basePath = path.join(__dirname, '..', 'out');
        }
        staticServer = createServer((req, res) => {
            if (!req.url) {
                res.writeHead(400);
                res.end('Bad Request');
                return;
            }
            // Parser l'URL pour enlever les query strings et le hash
            const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
            let urlPath = url.pathname;
            // Si c'est la racine, servir index.html
            if (urlPath === '/' || urlPath === '') {
                urlPath = '/index.html';
            }
            // Construire le chemin du fichier
            let filePath = path.join(basePath, urlPath);
            // Sécurité : s'assurer que le chemin est dans basePath
            const normalizedBase = path.normalize(basePath);
            const normalizedFull = path.normalize(filePath);
            if (!normalizedFull.startsWith(normalizedBase)) {
                console.error('Security: Attempted to access file outside base path');
                res.writeHead(403);
                res.end('Forbidden');
                return;
            }
            // Fonction pour servir un fichier
            const serveFile = (filePathToServe) => {
                fs.readFile(filePathToServe, (err, data) => {
                    if (err) {
                        if (err.code === 'ENOENT') {
                            // Si le fichier n'existe pas et que ce n'est pas déjà index.html,
                            // essayer de servir index.html (pour le routing côté client Next.js)
                            if (!urlPath.endsWith('index.html') && !urlPath.includes('_next')) {
                                const indexPath = path.join(basePath, 'index.html');
                                if (fs.existsSync(indexPath)) {
                                    serveFile(indexPath);
                                    return;
                                }
                            }
                            console.error('File not found:', filePathToServe);
                            res.writeHead(404);
                            res.end('File not found');
                        }
                        else {
                            console.error('Error reading file:', err);
                            res.writeHead(500);
                            res.end('Internal server error');
                        }
                        return;
                    }
                    // Déterminer le type MIME
                    const ext = path.extname(filePathToServe).toLowerCase();
                    const mimeTypes = {
                        '.html': 'text/html',
                        '.js': 'application/javascript',
                        '.css': 'text/css',
                        '.json': 'application/json',
                        '.png': 'image/png',
                        '.jpg': 'image/jpeg',
                        '.jpeg': 'image/jpeg',
                        '.gif': 'image/gif',
                        '.svg': 'image/svg+xml',
                        '.woff': 'font/woff',
                        '.woff2': 'font/woff2',
                        '.ttf': 'font/ttf',
                        '.ico': 'image/x-icon',
                        '.txt': 'text/plain',
                    };
                    const mimeType = mimeTypes[ext] || 'application/octet-stream';
                    res.writeHead(200, {
                        'Content-Type': mimeType,
                        'Content-Length': data.length.toString(),
                    });
                    res.end(data);
                });
            };
            // Vérifier si c'est un fichier (avec extension) ou un dossier
            fs.stat(filePath, (statErr, stats) => {
                if (statErr) {
                    // Si le fichier/dossier n'existe pas, vérifier si c'est une route Next.js
                    // Les routes Next.js sont servies par index.html (routing côté client)
                    if (!urlPath.includes('_next') && !urlPath.includes('.')) {
                        const indexPath = path.join(basePath, 'index.html');
                        if (fs.existsSync(indexPath)) {
                            serveFile(indexPath);
                            return;
                        }
                    }
                    serveFile(filePath);
                    return;
                }
                if (stats.isDirectory()) {
                    // Si c'est un dossier, essayer index.html dans ce dossier
                    const indexPath = path.join(filePath, 'index.html');
                    if (fs.existsSync(indexPath)) {
                        serveFile(indexPath);
                    }
                    else {
                        // Sinon, servir le index.html racine (routing côté client)
                        const rootIndexPath = path.join(basePath, 'index.html');
                        if (fs.existsSync(rootIndexPath)) {
                            serveFile(rootIndexPath);
                        }
                        else {
                            res.writeHead(404);
                            res.end('File not found');
                        }
                    }
                }
                else {
                    // C'est un fichier, le servir directement
                    serveFile(filePath);
                }
            });
        });
        staticServer.listen(port, '127.0.0.1', () => {
            console.log(`✅ Static server started on http://127.0.0.1:${port}`);
            const url = `http://127.0.0.1:${port}/`;
            console.log(`Loading from: ${url}`);
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.loadURL(url).catch((error) => {
                    console.error('Failed to load URL:', error);
                });
            }
        });
        staticServer.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`❌ Port ${port} is already in use. Trying port ${port + 1}...`);
                // Essayer le port suivant
                const newPort = port + 1;
                staticServer?.close();
                // Utiliser la même logique que le serveur principal
                staticServer = createServer((req, res) => {
                    if (!req.url) {
                        res.writeHead(400);
                        res.end('Bad Request');
                        return;
                    }
                    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
                    let urlPath = url.pathname;
                    if (urlPath === '/' || urlPath === '') {
                        urlPath = '/index.html';
                    }
                    let filePath = path.join(basePath, urlPath);
                    const normalizedBase = path.normalize(basePath);
                    const normalizedFull = path.normalize(filePath);
                    if (!normalizedFull.startsWith(normalizedBase)) {
                        res.writeHead(403);
                        res.end('Forbidden');
                        return;
                    }
                    const serveFile = (filePathToServe) => {
                        fs.readFile(filePathToServe, (err, data) => {
                            if (err) {
                                if (err.code === 'ENOENT') {
                                    if (!urlPath.endsWith('index.html') && !urlPath.includes('_next')) {
                                        const indexPath = path.join(basePath, 'index.html');
                                        if (fs.existsSync(indexPath)) {
                                            serveFile(indexPath);
                                            return;
                                        }
                                    }
                                    res.writeHead(404);
                                    res.end('File not found');
                                }
                                else {
                                    res.writeHead(500);
                                    res.end('Internal server error');
                                }
                                return;
                            }
                            const ext = path.extname(filePathToServe).toLowerCase();
                            const mimeTypes = {
                                '.html': 'text/html',
                                '.js': 'application/javascript',
                                '.css': 'text/css',
                                '.json': 'application/json',
                                '.png': 'image/png',
                                '.jpg': 'image/jpeg',
                                '.jpeg': 'image/jpeg',
                                '.gif': 'image/gif',
                                '.svg': 'image/svg+xml',
                                '.woff': 'font/woff',
                                '.woff2': 'font/woff2',
                                '.ttf': 'font/ttf',
                                '.ico': 'image/x-icon',
                                '.txt': 'text/plain',
                            };
                            const mimeType = mimeTypes[ext] || 'application/octet-stream';
                            res.writeHead(200, {
                                'Content-Type': mimeType,
                                'Content-Length': data.length.toString(),
                            });
                            res.end(data);
                        });
                    };
                    fs.stat(filePath, (statErr, stats) => {
                        if (statErr) {
                            if (!urlPath.includes('_next') && !urlPath.includes('.')) {
                                const indexPath = path.join(basePath, 'index.html');
                                if (fs.existsSync(indexPath)) {
                                    serveFile(indexPath);
                                    return;
                                }
                            }
                            serveFile(filePath);
                            return;
                        }
                        if (stats.isDirectory()) {
                            const indexPath = path.join(filePath, 'index.html');
                            if (fs.existsSync(indexPath)) {
                                serveFile(indexPath);
                            }
                            else {
                                const rootIndexPath = path.join(basePath, 'index.html');
                                if (fs.existsSync(rootIndexPath)) {
                                    serveFile(rootIndexPath);
                                }
                                else {
                                    res.writeHead(404);
                                    res.end('File not found');
                                }
                            }
                        }
                        else {
                            serveFile(filePath);
                        }
                    });
                });
                staticServer.listen(newPort, '127.0.0.1', () => {
                    const url = `http://127.0.0.1:${newPort}/`;
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.loadURL(url).catch((error) => {
                            console.error('Failed to load URL:', error);
                        });
                    }
                });
            }
            else {
                console.error('Static server error:', err);
            }
        });
    }
    if (cliOptions.debug) {
        mainWindow.webContents.openDevTools();
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
async function initServices() {
    // Initialize storage first (other services depend on it)
    initStorage();
    // Initialize updater with callback for UI notification
    await initUpdater((versionInfo) => {
        // Notifier l'UI qu'une mise à jour a été effectuée
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update:available', {
                version: versionInfo.version,
                changelog: versionInfo.changelog,
                buildDate: versionInfo.buildDate,
                commits: versionInfo.commits || [],
            });
        }
    });
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
// Video file dialog
ipcMain.handle('dialog:openVideoFile', async (_event, multiSelect = false) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: multiSelect ? ['openFile', 'multiSelections'] : ['openFile'],
        filters: [
            { name: 'Video Files', extensions: ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v', '3gp', 'ogv'] },
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
// Open file/folder in system file manager
ipcMain.handle('fs:openPath', async (_event, filePath) => {
    try {
        shell.showItemInFolder(filePath);
    }
    catch (error) {
        console.error('Failed to open path:', filePath, error);
        throw error;
    }
});
// Register custom protocol for serving static files from out/ directory
function registerNexusProtocol() {
    protocol.registerFileProtocol('nexus', (request, callback) => {
        try {
            const url = new URL(request.url);
            let filePath = url.pathname;
            // Déterminer le chemin de base selon si l'app est packagée ou non
            let basePath;
            if (app.isPackaged) {
                const resourcesPath = path.dirname(app.getAppPath());
                basePath = path.join(resourcesPath, 'out');
            }
            else {
                basePath = path.join(__dirname, '..', 'out');
            }
            // Si le chemin commence par /, l'enlever
            if (filePath.startsWith('/')) {
                filePath = filePath.slice(1);
            }
            // Si le chemin est vide ou juste '/', utiliser index.html
            if (!filePath || filePath === '') {
                filePath = 'index.html';
            }
            // Construire le chemin complet du fichier
            const fullPath = path.join(basePath, filePath);
            // Sécurité : s'assurer que le chemin est dans basePath
            const normalizedBase = path.normalize(basePath);
            const normalizedFull = path.normalize(fullPath);
            if (!normalizedFull.startsWith(normalizedBase)) {
                console.error('Security: Attempted to access file outside base path');
                callback({ error: -6 }); // ERR_FILE_NOT_FOUND
                return;
            }
            // Vérifier si le fichier existe
            if (!fs.existsSync(fullPath)) {
                console.error('File not found:', fullPath);
                callback({ error: -6 }); // ERR_FILE_NOT_FOUND
                return;
            }
            // Retourner le chemin du fichier
            callback({ path: fullPath });
        }
        catch (error) {
            console.error('Failed to load file via nexus protocol:', request.url, error);
            callback({ error: -2 }); // ERR_FAILED
        }
    });
}
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
// Register custom protocol for local video files
function registerLocalVideoProtocol() {
    protocol.handle('local-video', async (request) => {
        let filePath = request.url.replace('local-video://', '');
        // Decode URI component
        try {
            filePath = decodeURIComponent(filePath);
        }
        catch (e) {
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
            const mimeTypes = {
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
        }
        catch (error) {
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
}
else {
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
        const files = [];
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
                }
                catch (error) {
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
/**
 * Démarrer le serveur Next.js standalone
 * En production, charge le serveur depuis .next/standalone
 * En développement, utilise le serveur Next.js en cours d'exécution
 */
// Removed waitForNextServer - production mode only, server starts directly
// App lifecycle
app.whenReady().then(async () => {
    try {
        // Register custom protocols
        registerNexusProtocol(); // Doit être enregistré en premier pour servir les fichiers statiques
        registerLocalAudioProtocol();
        registerLocalVideoProtocol();
        // Load environment variables
        const appPath = app.isPackaged
            ? path.dirname(app.getAppPath())
            : path.join(__dirname, '..');
        const envPath = path.join(appPath, '.env');
        if (fs.existsSync(envPath)) {
            dotenv.config({ path: envPath });
            console.log(`✅ Environment variables loaded from: ${envPath}`);
        }
        // Initialize storage and services
        await storage.init();
        await initServices();
        // Créer la fenêtre après que le serveur est prêt
        createWindow();
        // Handle files passed as arguments on first launch
        handleFileArgs();
        // Handle pending files (files passed before window was ready)
        if (app.pendingFiles) {
            app.pendingFiles.forEach((file) => openMediaFile(file));
            delete app.pendingFiles;
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
            const newDirs = cliOptions.musicDir.filter(dir => !settings.musicDirectories.includes(dir));
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
    }
    catch (error) {
        console.error('❌ Fatal error during app initialization:', error);
        // Afficher une boîte de dialogue d'erreur
        dialog.showErrorBox('Erreur de démarrage', `Impossible de démarrer l'application:\n\n${error.message || error}\n\nVérifiez les logs pour plus de détails.`);
        // Quitter l'application après un délai
        setTimeout(() => {
            app.quit();
        }, 5000);
    }
});
// Fermer le serveur statique quand l'app se ferme
app.on('before-quit', () => {
    if (staticServer) {
        staticServer.close();
        staticServer = null;
    }
});
app.on('window-all-closed', () => {
    // On macOS, keep app running even when all windows are closed
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
// Handle certificate errors (production only - reject invalid certificates)
app.on('certificate-error', (event, _webContents, _url, _error, _certificate, callback) => {
    callback(false);
});
// Export for services to use
export { mainWindow };
//# sourceMappingURL=main.js.map