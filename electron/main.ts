import { app, BrowserWindow, ipcMain, dialog, shell, protocol } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';

// Import services
import { initAudioScanner } from './services/audio-scanner.js';
import { initVideoScanner } from './services/video-scanner.js';
import { initMetadataExtractor } from './services/metadata-extractor.js';
import { initStorage, storage } from './services/storage.js';
import { initPlaylistManager } from './services/playlist-manager.js';
import { initEqualizer } from './services/equalizer.js';
import { initLyricsProvider } from './services/lyrics-provider.js';
import { initScrobbler } from './services/scrobbler.js';
import { initMusicRecognizer } from './services/music-recognizer.js';
import { initUpdater } from './updater/updater.js';

// Import CLI parser
import { parseArgs, showHelp, showVersion, applyCLIOptions, normalizeOptions, type CLIOptions } from './cli.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CLI arguments and normalize (remove duplicates, validate)
const cliOptions = normalizeOptions(parseArgs());

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
let oauthWindow: BrowserWindow | null = null;
let stripeWindow: BrowserWindow | null = null;
let oauthCallbackServer: Server | null = null;

const isDev = !app.isPackaged;

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
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔵 [CLI] Processing initial command line arguments');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 [CLI] Full process.argv:', JSON.stringify(process.argv, null, 2));
  
  const args = process.argv.slice(1); // Skip node/electron path
  console.log('📋 [CLI] Arguments to process (after skipping node/electron):', JSON.stringify(args, null, 2));
  console.log('📊 [CLI] Total arguments:', args.length);
  
  const files: string[] = [];
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    console.log(`  📝 [CLI] Processing argument [${i}]: "${arg}"`);
    
    // Skip CLI flags
    if (arg.startsWith('--') || arg.startsWith('-')) {
      console.log(`  ⏭️  [CLI] Skipping CLI flag: "${arg}"`);
      continue;
    }
    
    // Check if it's a file path (contains drive letter on Windows or starts with / on Unix)
    if (arg.includes(path.sep) || arg.match(/^[A-Za-z]:/)) {
      console.log(`  ✅ [CLI] Argument looks like a file path`);
      // Check if file exists and is a media file
      try {
        const resolvedPath = path.resolve(arg);
        console.log(`  🔄 [CLI] Resolved path: "${resolvedPath}"`);
        
        if (fs.existsSync(resolvedPath)) {
          const stats = fs.statSync(resolvedPath);
          console.log(`  📊 [CLI] File stats:`, {
            isFile: stats.isFile(),
            isDirectory: stats.isDirectory(),
            size: stats.size,
            extension: path.extname(resolvedPath).toLowerCase()
          });
          
          if (isMediaFile(resolvedPath)) {
            files.push(resolvedPath);
            console.log(`  ✅ [CLI] Found valid media file: "${resolvedPath}"`);
          } else {
            console.log(`  ⚠️  [CLI] File exists but is not a valid media file`);
          }
        } else {
          console.log(`  ❌ [CLI] File does not exist: "${resolvedPath}"`);
        }
      } catch (error) {
        // Log error but continue processing other files
        console.error(`  ❌ [CLI] Error processing file path "${arg}":`, error);
      }
    } else {
      console.log(`  ⏭️  [CLI] Argument does not look like a file path, skipping`);
    }
  }
  
  console.log(`📊 [CLI] Total files found: ${files.length}`);
  if (files.length > 0) {
    console.log('📋 [CLI] Files to open:');
    files.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file}`);
    });
  }
  console.log('═══════════════════════════════════════════════════════════');
  
  return files;
}

/**
 * Open a media file in the player
 */
function openMediaFile(filePath: string): void {
  console.log('🎵 [CLI] openMediaFile() called with:', filePath);
  
  if (!mainWindow) {
    console.warn('⚠️  [CLI] Main window not ready, file will be opened when window is created');
    return;
  }
  
  const normalizedPath = path.resolve(filePath);
  console.log('🔄 [CLI] Normalized path:', normalizedPath);
  
  // Send file to renderer process
  console.log('📤 [CLI] Sending file:open event to renderer...');
  mainWindow.webContents.send('file:open', normalizedPath);
  
  // Focus window
  if (mainWindow.isMinimized()) {
    console.log('⬆️  [CLI] Window was minimized, restoring...');
    mainWindow.restore();
  }
  mainWindow.focus();
  console.log('✅ [CLI] Window focused');
  
  console.log('✅ [CLI] Media file opened successfully:', normalizedPath);
}

/**
 * Handle files passed as command line arguments
 */
function handleFileArgs(): void {
  console.log('🔵 [CLI] Handling file arguments from initial startup...');
  const files = getFileArgsFromArgs();
  
  if (files.length > 0) {
    console.log('🚀 [CLI] Opening files from initial command line...');
    
    // If window is ready, open files immediately
    if (mainWindow) {
      console.log('✅ [CLI] Window is ready, opening files immediately...');
      files.forEach((file, index) => {
        console.log(`  🎵 [CLI] Opening file ${index + 1}/${files.length}: "${file}"`);
        openMediaFile(file);
      });
      console.log('✅ [CLI] All files opened successfully');
    } else {
      // Store files to open when window is ready
      console.log('💾 [CLI] Window not ready, storing files to open when ready...');
      (app as any).pendingFiles = files;
      console.log(`💾 [CLI] Stored ${files.length} file(s) to open when window is ready`);
    }
  } else {
    console.log('ℹ️  [CLI] No files found in command line arguments');
  }
}

function createWindow() {
  // Resolve preload path - handle both dev and production builds
  // In packaged apps, __dirname points to app.asar/dist-electron
  // In dev, __dirname points to dist-electron
  const preloadPath = path.join(__dirname, 'preload.cjs');
  
  // Try multiple paths for production builds
  const possiblePaths = [
    preloadPath, // Standard path (dev and most production builds)
    path.join(app.getAppPath(), 'dist-electron', 'preload.cjs'), // Packaged app path
    path.join(process.resourcesPath || __dirname, 'preload.cjs'), // Resources path
    path.join(process.resourcesPath || __dirname, 'app.asar', 'dist-electron', 'preload.cjs'), // ASAR path
  ];
  
  let finalPreloadPath = preloadPath;
  let found = false;
  
  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      finalPreloadPath = testPath;
      found = true;
      break;
    }
  }
  
  if (!found) {
    console.error('⚠️ Preload script not found! Tried paths:');
    possiblePaths.forEach((p, i) => {
      console.error(`   ${i + 1}. ${p} (exists: ${fs.existsSync(p)})`);
    });
    console.error('   __dirname:', __dirname);
    console.error('   app.getAppPath():', app.getAppPath());
    console.error('   process.resourcesPath:', process.resourcesPath);
    // Use the first path anyway - Electron will show an error if it fails
    finalPreloadPath = preloadPath;
  }
  
  console.log('📦 Loading preload from:', finalPreloadPath);
  console.log('📦 Preload exists:', fs.existsSync(finalPreloadPath));
  console.log('📦 App path:', app.getAppPath());
  console.log('📦 __dirname:', __dirname);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#00000000',
    icon: path.join(__dirname, '../public/favicon.ico'),
    show: true, // Explicitly show the window
    webPreferences: {
      preload: finalPreloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false, // Allow loading local files
    },
  });
  
  // Log when preload is loaded and verify electronAPI injection
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) return;
    console.log('✅ Page loaded, checking if electronAPI is available...');
    // Wait a bit for preload to execute
    setTimeout(() => {
      if (!mainWindow) return;
      mainWindow.webContents.executeJavaScript(`
        (function() {
          const isAvailable = typeof window.electronAPI !== 'undefined';
          console.log('[Renderer] window.electronAPI:', isAvailable ? '✅ Available' : '❌ Not available');
          if (isAvailable) {
            console.log('[Renderer] electronAPI methods:', Object.keys(window.electronAPI).join(', '));
          }
          return isAvailable;
        })();
      `).then((isAvailable) => {
        if (isAvailable) {
          console.log('✅ electronAPI successfully injected!');
        } else {
          console.error('❌ electronAPI NOT injected! Preload may have failed.');
          console.error('   This can happen if:');
          console.error('   1. Preload script path is incorrect');
          console.error('   2. Preload script has errors');
          console.error('   3. Content Security Policy blocks the injection');
        }
      }).catch((err) => {
        console.error('❌ Error checking electronAPI:', err);
      });
    }, 500);
  });
  
  // Also check on dom-ready (earlier event)
  mainWindow.webContents.on('dom-ready', () => {
    if (!mainWindow) return;
    console.log('📄 DOM ready, preload should be loaded by now');
  });

  // Load the app
  // Determine which URL to use:
  // Priority order:
  // 1. If FORCE_PROD env var is set → always use production (for npm run electron)
  // 2. If --dev flag is explicitly set → use localhost
  // 3. If app is packaged → use production
  // 4. Default → use production
  const forceProduction = process.env.FORCE_PROD === 'true' || process.env.FORCE_PROD === '1';
  const useProduction = forceProduction || app.isPackaged || (!cliOptions.dev && !isDev);
  
  if (useProduction) {
    // Production: Load from Vercel
    const vercelUrl = process.env.VERCEL_URL || 'https://nova-sound-nine.vercel.app';
    console.log('🌐 Loading production URL:', vercelUrl);
    mainWindow.loadURL(vercelUrl);
    mainWindow.webContents.openDevTools();
  } else {
    // Development: Load from localhost (only if --dev flag is explicitly set)
    const port = cliOptions.port || 3000;
    const localUrl = `http://localhost:${port}`;
    console.log('🔧 Loading development URL:', localUrl);
    mainWindow.loadURL(localUrl);
    if (cliOptions.debug || isDev) {
      mainWindow.webContents.openDevTools();
    }
  }

  // Ensure window is shown after loading
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      // Bring window to front
      if (process.platform === 'win32') {
        mainWindow.setAlwaysOnTop(true);
        mainWindow.setAlwaysOnTop(false);
      }
    }
  });

  // Fallback: Show window after a short delay if still not visible
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  }, 1000);

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
  console.log('🔧 Initializing Electron services...');
  
  try {
    // Initialize storage first (other services depend on it)
    console.log('📦 Initializing storage...');
    initStorage();
    console.log('✅ Storage initialized');
  } catch (error) {
    console.error('❌ Failed to initialize storage:', error);
    throw error; // Storage is critical, fail if it doesn't initialize
  }
  
  // Initialize updater with callback for UI notification
  if (!isDev && !cliOptions.dev) {
    try {
      console.log('🔄 Initializing updater...');
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
      console.log('✅ Updater initialized');
    } catch (error) {
      console.warn('⚠️ Failed to initialize updater (non-critical):', error);
    }
  }
  
  // Initialize other services with error handling
  const services = [
    { name: 'Metadata Extractor', init: initMetadataExtractor },
    { name: 'Audio Scanner', init: initAudioScanner },
    { name: 'Video Scanner', init: initVideoScanner },
    { name: 'Playlist Manager', init: initPlaylistManager },
    { name: 'Equalizer', init: initEqualizer },
    { name: 'Lyrics Provider', init: initLyricsProvider },
    { name: 'Scrobbler', init: initScrobbler },
    { name: 'Music Recognizer', init: initMusicRecognizer },
  ];
  
  for (const service of services) {
    try {
      console.log(`🔧 Initializing ${service.name}...`);
      service.init();
      console.log(`✅ ${service.name} initialized`);
    } catch (error) {
      console.error(`❌ Failed to initialize ${service.name}:`, error);
      // Continue with other services even if one fails
    }
  }
  
  console.log('✅ All services initialized');
  
  // Note: IPC handlers are registered synchronously in init functions
  // If handlers are missing, it's likely due to an error during service initialization
  // which would have been logged above
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

// OAuth handlers for desktop app authentication
ipcMain.handle('oauth:openWindow', async (_event, url: string) => {
  try {
    // Close existing OAuth window if any
    if (oauthWindow && !oauthWindow.isDestroyed()) {
      oauthWindow.close();
    }

    // Create OAuth window
    oauthWindow = new BrowserWindow({
      width: 500,
      height: 700,
      show: false,
      frame: true,
      title: 'Authentification Google',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });

    // Show window when ready
    oauthWindow.once('ready-to-show', () => {
      if (oauthWindow && !oauthWindow.isDestroyed()) {
        oauthWindow.show();
        oauthWindow.focus();
      }
    });

    // Handle window closed
    oauthWindow.on('closed', () => {
      oauthWindow = null;
    });

    // Intercept navigation to localhost:3001 (OAuth callback)
    oauthWindow.webContents.on('will-redirect', (event, navigationUrl) => {
      handleOAuthRedirect(navigationUrl);
    });

    oauthWindow.webContents.on('did-redirect-navigation', (event, navigationUrl) => {
      handleOAuthRedirect(navigationUrl);
    });

    // Also check on navigation
    oauthWindow.webContents.on('did-navigate', (event, navigationUrl) => {
      handleOAuthRedirect(navigationUrl);
    });
    
    // Also check URL changes
    oauthWindow.webContents.on('did-navigate-in-page', (event, navigationUrl) => {
      handleOAuthRedirect(navigationUrl);
    });

    // Load OAuth URL
    await oauthWindow.loadURL(url);
    console.log('🔐 Opened OAuth window in app:', url);
  } catch (error) {
    console.error('Failed to open OAuth window:', error);
    if (oauthWindow && !oauthWindow.isDestroyed()) {
      oauthWindow.close();
    }
    throw error;
  }
});

// Stripe handlers for checkout and portal
ipcMain.handle('stripe:openWindow', async (_event, url: string) => {
  try {
    // Close existing Stripe window if any
    if (stripeWindow && !stripeWindow.isDestroyed()) {
      stripeWindow.close();
    }

    // Create Stripe window
    stripeWindow = new BrowserWindow({
      width: 800,
      height: 900,
      show: false,
      frame: true,
      title: 'Stripe Checkout',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });

    // Show window when ready
    stripeWindow.once('ready-to-show', () => {
      if (stripeWindow && !stripeWindow.isDestroyed()) {
        stripeWindow.show();
        stripeWindow.focus();
      }
    });

    // Handle window closed
    stripeWindow.on('closed', () => {
      stripeWindow = null;
    });

    // Intercept navigation to success/cancel URLs
    stripeWindow.webContents.on('will-redirect', (event, navigationUrl) => {
      console.log('💳 Stripe window will-redirect to:', navigationUrl);
      handleStripeRedirect(navigationUrl);
    });

    stripeWindow.webContents.on('did-redirect-navigation', (event, navigationUrl) => {
      console.log('💳 Stripe window did-redirect-navigation to:', navigationUrl);
      handleStripeRedirect(navigationUrl);
    });

    // Also check on navigation
    stripeWindow.webContents.on('did-navigate', (event, navigationUrl) => {
      console.log('💳 Stripe window did-navigate to:', navigationUrl);
      handleStripeRedirect(navigationUrl);
    });
    
    // Also check URL changes (for single-page navigation)
    stripeWindow.webContents.on('did-navigate-in-page', (event, navigationUrl, isMainFrame) => {
      if (isMainFrame) {
        console.log('💳 Stripe window did-navigate-in-page to:', navigationUrl);
        handleStripeRedirect(navigationUrl);
      }
    });
    
    // Monitor URL changes via webContents URL property
    const checkUrl = () => {
      if (stripeWindow && !stripeWindow.isDestroyed()) {
        const currentUrl = stripeWindow.webContents.getURL();
        if (currentUrl && currentUrl !== url) {
          handleStripeRedirect(currentUrl);
        }
      }
    };
    
    // Check URL periodically (as fallback)
    const urlCheckInterval = setInterval(checkUrl, 500);
    stripeWindow.on('closed', () => {
      clearInterval(urlCheckInterval);
    });

    // Load Stripe URL
    await stripeWindow.loadURL(url);
    console.log('💳 Opened Stripe window in app:', url);
  } catch (error) {
    console.error('Failed to open Stripe window:', error);
    if (stripeWindow && !stripeWindow.isDestroyed()) {
      stripeWindow.close();
    }
    throw error;
  }
});

// Handle OAuth redirect in OAuth window
function handleOAuthRedirect(url: string) {
  if (!url) return;

  try {
    const urlObj = new URL(url);
    
    // Check if this is the OAuth callback (localhost:3001)
    if (urlObj.hostname === 'localhost' && urlObj.port === '3001') {
      const code = urlObj.searchParams.get('code');
      const state = urlObj.searchParams.get('state');
      const error = urlObj.searchParams.get('error');

      if (error) {
        console.error('❌ OAuth error in window:', error);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('oauth:error', { error });
        }
        if (oauthWindow && !oauthWindow.isDestroyed()) {
          oauthWindow.close();
        }
        return;
      }

      if (code && state) {
        console.log('✅ OAuth code received in window, sending to renderer...');
        
        // Send code and state to renderer process
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('oauth:callback', { code, state });
        } else {
          // Window not ready yet, store callback for when window is ready
          (app as any).pendingOAuthCallback = { code, state };
          console.log('Stored OAuth callback for when window is ready');
        }

        // Close OAuth window
        if (oauthWindow && !oauthWindow.isDestroyed()) {
          oauthWindow.close();
        }
      }
    }
  } catch (err) {
    // Not a valid URL or not our callback, ignore
    console.log('🔐 Navigation to:', url, '(not OAuth callback)');
  }
}

// Handle Stripe redirect in Stripe window
function handleStripeRedirect(url: string) {
  if (!url) return;

  try {
    const urlObj = new URL(url);
    const searchParams = urlObj.searchParams;
    
    // Check for Stripe success/cancel indicators in query parameters
    // Stripe redirects to success_url or cancel_url after payment
    const success = searchParams.get('success') === 'true' || searchParams.has('session_id');
    const canceled = searchParams.get('canceled') === 'true';
    const sessionId = searchParams.get('session_id');
    
    // Also check if URL contains stripe success/cancel indicators
    const isStripeCallback = url.includes('success=true') || 
                             url.includes('canceled=true') || 
                             url.includes('session_id=') ||
                             searchParams.has('session_id');

    if (isStripeCallback) {
      if (success) {
        console.log('✅ Stripe checkout success detected, sending to renderer...', { url, sessionId });
        
        // Send success event to renderer process
        // Even if sessionId is null, the renderer can refresh subscription status
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('stripe:checkout-success', { 
            sessionId: sessionId || null,
            url: url 
          });
        }

        // Close Stripe window after a short delay to allow the message to be sent
        setTimeout(() => {
          if (stripeWindow && !stripeWindow.isDestroyed()) {
            stripeWindow.close();
          }
        }, 500);
        return;
      } else if (canceled) {
        console.log('⚠️ Stripe checkout canceled');
        
        // Send cancel event to renderer process
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('stripe:checkout-canceled');
        }

        // Close Stripe window
        setTimeout(() => {
          if (stripeWindow && !stripeWindow.isDestroyed()) {
            stripeWindow.close();
          }
        }, 500);
        return;
      }
    }
    
    // Log navigation for debugging (but don't treat as error)
    if (!url.includes('checkout.stripe.com') && !url.includes('stripe.com')) {
      console.log('💳 Navigation in Stripe window:', url);
    }
  } catch (err) {
    // Not a valid URL, ignore
    console.log('💳 Invalid URL in Stripe window:', url);
  }
}

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

// Read file as base64 for blob creation (for small files < 100MB)
ipcMain.handle('file:readAsBase64', async (_event, filePath: string) => {
  try {
    const stats = fs.statSync(filePath);
    // Limit to 100MB for base64 (larger files should use streaming)
    if (stats.size > 100 * 1024 * 1024) {
      throw new Error('File too large for base64 encoding. Use streaming upload instead.');
    }
    const data = fs.readFileSync(filePath);
    return data.toString('base64');
  } catch (error) {
    console.error('Failed to read file:', filePath, error);
    throw error;
  }
});

// Get file info without reading content
ipcMain.handle('file:getInfo', async (_event, filePath: string) => {
  try {
    const stats = fs.statSync(filePath);
    return {
      size: stats.size,
      exists: true,
      isFile: stats.isFile(),
      path: filePath,
    };
  } catch (error) {
    return { exists: false, size: 0, isFile: false, path: filePath };
  }
});

// Upload file directly to cloud (streaming for large files)
ipcMain.handle('file:uploadToCloud', async (_event, options: {
  filePath: string;
  cloudName: string;
  uploadPreset: string;
  resourceType: 'video' | 'image' | 'raw' | 'auto';
  publicId?: string;
}) => {
  const { filePath, cloudName, uploadPreset, resourceType, publicId } = options;
  const FormData = (await import('form-data')).default;
  const https = await import('https');
  
  return new Promise((resolve, reject) => {
    try {
      const stats = fs.statSync(filePath);
      const fileName = path.basename(filePath);
      
      const form = new FormData();
      form.append('file', fs.createReadStream(filePath), fileName);
      form.append('upload_preset', uploadPreset);
      form.append('resource_type', resourceType);
      if (publicId) {
        form.append('public_id', publicId);
      }
      
      const req = https.request({
        hostname: 'api.cloudinary.com',
        port: 443,
        path: `/v1_1/${cloudName}/upload`,
        method: 'POST',
        headers: form.getHeaders(),
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve({
                success: true,
                url: json.secure_url,
                publicId: json.public_id,
                bytes: json.bytes,
              });
            } else {
              resolve({
                success: false,
                error: json.error?.message || `HTTP ${res.statusCode}`,
              });
            }
          } catch (e) {
            resolve({ success: false, error: 'Failed to parse response' });
          }
        });
      });
      
      req.on('error', (e) => {
        resolve({ success: false, error: e.message });
      });
      
      form.pipe(req);
    } catch (error: any) {
      resolve({ success: false, error: error.message });
    }
  });
});

// Upload file directly to Nexus API (streaming for large files)
ipcMain.handle('file:uploadToNexus', async (_event, options: {
  filePath: string;
  apiUrl: string;
  accessToken: string;
  fileName?: string;
  onProgress?: (progress: number) => void;
}) => {
  const { filePath, apiUrl, accessToken, fileName: providedFileName, onProgress } = options;
  const FormData = (await import('form-data')).default;
  const https = (await import('https')).default;
  const http = (await import('http')).default;
  const { URL } = await import('url');
  
  return new Promise((resolve, reject) => {
    try {
      const stats = fs.statSync(filePath);
      const fileName = providedFileName || path.basename(filePath);
      const fileSize = stats.size;
      
      const url = new URL(apiUrl);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const form = new FormData();
      form.append('file', fs.createReadStream(filePath), fileName);
      
      // Track upload progress
      let uploadedBytes = 0;
      const fileStream = fs.createReadStream(filePath);
      
      fileStream.on('data', (chunk: Buffer | string) => {
        const chunkLength = typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
        uploadedBytes += chunkLength;
        if (onProgress && fileSize > 0) {
          const progress = Math.round((uploadedBytes / fileSize) * 100);
          onProgress(progress);
        }
      });
      
      const req = client.request({
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${accessToken}`,
        },
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              const json = JSON.parse(data);
              resolve({
                success: true,
                url: json.url,
                id: json.id,
                size: json.size,
              });
            } else {
              try {
                const error = JSON.parse(data);
                resolve({
                  success: false,
                  error: error.message || error.error || `HTTP ${res.statusCode}`,
                });
              } catch {
                resolve({
                  success: false,
                  error: `HTTP ${res.statusCode}: ${res.statusMessage || 'Unknown error'}`,
                });
              }
            }
          } catch (e) {
            resolve({ success: false, error: 'Failed to parse response' });
          }
        });
      });
      
      req.on('error', (e) => {
        resolve({ success: false, error: e.message });
      });
      
      form.pipe(req);
    } catch (error: any) {
      resolve({ success: false, error: error.message });
    }
  });
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
    // Decode URI component - handle both encoded and unencoded paths
    try {
      // Remove any leading slashes
      filePath = filePath.replace(/^\/+/, '');
      // Decode URI component
      filePath = decodeURIComponent(filePath);
    } catch (e) {
      console.error('Failed to decode video path:', filePath, e);
    }
    
    console.log('Loading video file:', filePath);
    
    try {
      // Normalize path for Windows
      if (process.platform === 'win32') {
        // Handle Windows paths that might have forward slashes
        filePath = filePath.replace(/\//g, '\\');
      }
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error('Video file not found:', filePath);
        // Try alternative path formats
        const altPath = filePath.replace(/\\/g, '/');
        if (fs.existsSync(altPath)) {
          filePath = altPath;
        } else {
          return new Response('File not found', { 
            status: 404,
            headers: {
              'Content-Type': 'text/plain',
            }
          });
        }
      }
      
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        console.error('Path is not a file:', filePath);
        return new Response('Path is not a file', { status: 400 });
      }
      
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
      
      const contentType = mimeTypes[ext] || 'video/mp4';
      
      // Handle Range requests for video seeking
      const rangeHeader = request.headers.get('range');
      
      if (rangeHeader) {
        // Parse range header (e.g., "bytes=0-1023")
        const matches = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (matches) {
          const start = parseInt(matches[1], 10);
          const end = matches[2] ? parseInt(matches[2], 10) : stats.size - 1;
          const chunkSize = end - start + 1;
          
          if (start >= stats.size || start < 0) {
            return new Response('Range Not Satisfiable', { 
              status: 416,
              headers: {
                'Content-Range': `bytes */${stats.size}`,
              }
            });
          }
          
          // Read only the requested range
          const buffer = Buffer.alloc(chunkSize);
          const fd = fs.openSync(filePath, 'r');
          try {
            fs.readSync(fd, buffer, 0, chunkSize, start);
          } finally {
            fs.closeSync(fd);
          }
          
          return new Response(buffer, {
            status: 206, // Partial Content
            headers: {
              'Content-Type': contentType,
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
            console.error('Stream error:', err);
            controller.error(err);
          });
        },
        cancel() {
          nodeStream.destroy();
        },
      });
      
      return new Response(webStream, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': stats.size.toString(),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-cache',
        },
      });
    } catch (error) {
      console.error('Failed to load video file:', filePath, error);
      return new Response(`Error loading video: ${error instanceof Error ? error.message : String(error)}`, { 
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
        }
      });
    }
  });
}

// Register custom protocol for local image files (thumbnails, etc.)
function registerLocalImageProtocol() {
  protocol.handle('local-image', async (request) => {
    let filePath = request.url.replace('local-image://', '');
    // Decode URI component
    try {
      filePath = decodeURIComponent(filePath);
    } catch (e) {
      console.error('Failed to decode image path:', filePath, e);
    }
    
    console.log('Loading thumbnail image:', filePath);
    
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error('Thumbnail file not found:', filePath);
        return new Response('Image not found', { status: 404 });
      }
      
      const data = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.svg': 'image/svg+xml',
      };
      
      return new Response(data, {
        headers: {
          'Content-Type': mimeTypes[ext] || 'image/jpeg',
          'Cache-Control': 'max-age=3600', // Cache images for 1 hour
        },
      });
    } catch (error) {
      console.error('Failed to load image file:', filePath, error);
      return new Response('Image not found', { status: 404 });
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
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔵 [CLI] Second instance detected (Open with...)');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 [CLI] Command line arguments:', JSON.stringify(commandLine, null, 2));
    console.log('📁 [CLI] Working directory:', workingDirectory || process.cwd());
    console.log('📊 [CLI] Total arguments:', commandLine.length);
    
    // Focus the main window if it exists
    if (mainWindow) {
      console.log('🪟 [CLI] Main window exists, focusing...');
      if (mainWindow.isMinimized()) {
        console.log('⬆️  [CLI] Window was minimized, restoring...');
        mainWindow.restore();
      }
      mainWindow.focus();
      console.log('✅ [CLI] Window focused');
    } else {
      // Window doesn't exist yet, create it
      console.log('🆕 [CLI] Main window does not exist, creating...');
      createWindow();
    }
    
    // Extract file paths from command line (robust parsing for Windows "Open with")
    const files: string[] = [];
    
    console.log('🔍 [CLI] Parsing command line arguments for file paths...');
    
    // On Windows, commandLine includes the executable path as first element
    // File paths can be:
    // 1. Absolute paths: C:\Users\...\file.mp3
    // 2. Relative paths: .\file.mp3 or file.mp3
    // 3. Quoted paths: "C:\Users\...\file with spaces.mp3"
    
    for (let i = 1; i < commandLine.length; i++) {
      const arg = commandLine[i];
      console.log(`  📝 [CLI] Processing argument [${i}]: "${arg}"`);
      
      // Skip CLI flags and options
      if (arg.startsWith('--') || arg.startsWith('-')) {
        console.log(`  ⏭️  [CLI] Skipping CLI flag: "${arg}"`);
        // Skip value for flags that take arguments
        if (arg === '--port' || arg === '-p' || arg === '--music-dir' || arg === '-m') {
          i++; // Skip the next argument (the value)
          console.log(`  ⏭️  [CLI] Skipping flag value: "${commandLine[i]}"`);
        }
        continue;
      }
      
      // Handle quoted paths (Windows often quotes paths with spaces)
      let filePath = arg;
      if (filePath.startsWith('"') && filePath.endsWith('"')) {
        filePath = filePath.slice(1, -1);
        console.log(`  📦 [CLI] Unquoted path: "${filePath}"`);
      }
      
      // Check if it looks like a file path
      // Windows: C:\ or UNC \\server\share or relative .\ or ..\
      // Unix: /path or ./path
      const isPathLike = 
        filePath.includes(path.sep) || 
        filePath.match(/^[A-Za-z]:/) || // Windows drive letter
        filePath.match(/^\\\\/) || // UNC path
        filePath.startsWith('.\\') || // Relative Windows
        filePath.startsWith('./') || // Relative Unix
        path.isAbsolute(filePath);
      
      if (isPathLike) {
        console.log(`  ✅ [CLI] Argument looks like a file path`);
        try {
          // Resolve path (handle both absolute and relative)
          const resolvedPath = path.isAbsolute(filePath) 
            ? path.normalize(filePath)
            : path.resolve(workingDirectory || process.cwd(), filePath);
          
          console.log(`  🔄 [CLI] Resolved path: "${resolvedPath}"`);
          
          // Verify file exists and is a media file
          if (fs.existsSync(resolvedPath)) {
            const stats = fs.statSync(resolvedPath);
            console.log(`  📊 [CLI] File stats:`, {
              isFile: stats.isFile(),
              isDirectory: stats.isDirectory(),
              size: stats.size,
              extension: path.extname(resolvedPath).toLowerCase()
            });
            
            if (stats.isFile() && isMediaFile(resolvedPath)) {
              files.push(resolvedPath);
              console.log(`  ✅ [CLI] Found valid media file: "${resolvedPath}"`);
            } else {
              console.log(`  ⚠️  [CLI] File exists but is not a valid media file`);
            }
          } else {
            console.log(`  ❌ [CLI] File does not exist: "${resolvedPath}"`);
          }
        } catch (error) {
          // Log error but continue processing other files
          console.error(`  ❌ [CLI] Error processing file path "${filePath}":`, error);
        }
      } else {
        console.log(`  ⏭️  [CLI] Argument does not look like a file path, skipping`);
      }
    }
    
    console.log(`📊 [CLI] Total files found: ${files.length}`);
    if (files.length > 0) {
      console.log('📋 [CLI] Files to open:');
      files.forEach((file, index) => {
        console.log(`  ${index + 1}. ${file}`);
      });
    }
    
    // Open files in existing window (or wait for window to be ready)
    if (files.length > 0) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        // Window is ready, open files immediately
        console.log('🚀 [CLI] Window is ready, opening files immediately...');
        files.forEach((file, index) => {
          console.log(`  🎵 [CLI] Opening file ${index + 1}/${files.length}: "${file}"`);
          openMediaFile(file);
        });
        console.log('✅ [CLI] All files opened successfully');
      } else {
        // Window not ready yet, store files to open when ready
        (app as any).pendingFiles = ((app as any).pendingFiles || []).concat(files);
        console.log(`💾 [CLI] Window not ready, stored ${files.length} file(s) to open when ready`);
      }
    } else {
      console.log('⚠️  [CLI] No valid media files found in command line arguments');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
  });
}

// Register OAuth callback server for desktop app authentication
// Google Desktop App OAuth uses http://localhost as redirect_uri
function registerOAuthCallbackServer() {
  const PORT = 3001;
  
  // Handler function for OAuth callbacks
  const handleOAuthRequest = (req: any, res: any) => {
    if (!req.url) {
      res.writeHead(400);
      res.end('Bad Request');
      return;
    }

    try {
      const urlObj = new URL(req.url, `http://localhost:${PORT}`);
      const code = urlObj.searchParams.get('code');
      const state = urlObj.searchParams.get('state');
      const error = urlObj.searchParams.get('error');
      
      console.log('🔐 OAuth callback received on localhost:', { 
        code: code ? 'present' : 'missing', 
        state: state ? 'present' : 'missing', 
        error: error || 'none' 
      });
      
      if (error) {
        console.error('❌ OAuth error:', error);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <head><title>OAuth Error</title></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
              <h1>❌ Erreur d'authentification</h1>
              <p>${error}</p>
              <p>Vous pouvez fermer cette fenêtre.</p>
            </body>
          </html>
        `);
        
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('oauth:error', { error });
        }
        return;
      }
      
      if (code && state) {
        console.log('✅ OAuth code received, sending to renderer...');
        
        // Send success response
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <head><title>Authentification réussie</title></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
              <h1>✅ Authentification réussie</h1>
              <p>Vous pouvez fermer cette fenêtre et retourner à l'application.</p>
              <script>setTimeout(() => window.close(), 2000);</script>
            </body>
          </html>
        `);
        
        // Send code and state to renderer process
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('oauth:callback', { code, state });
        } else {
          // Window not ready yet, store callback for when window is ready
          (app as any).pendingOAuthCallback = { code, state };
          console.log('Stored OAuth callback for when window is ready');
        }
      } else {
        console.warn('⚠️ OAuth callback missing code or state');
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <head><title>Erreur</title></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
              <h1>⚠️ Paramètres manquants</h1>
              <p>Le callback OAuth ne contient pas tous les paramètres requis.</p>
            </body>
          </html>
        `);
      }
    } catch (err) {
      console.error('❌ Error handling OAuth callback:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  };
  
  // Create HTTP server to listen for OAuth callbacks
  oauthCallbackServer = createServer(handleOAuthRequest);

  // Start listening on localhost
  oauthCallbackServer.listen(PORT, '127.0.0.1', () => {
    const address = oauthCallbackServer?.address() as AddressInfo;
    console.log(`🔐 OAuth callback server listening on http://localhost:${address?.port || PORT}`);
  });

  oauthCallbackServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Please close the application using this port or restart your computer.`);
      console.error('   OAuth authentication may not work correctly.');
    } else {
      console.error('❌ OAuth callback server error:', err);
    }
  });
}

// Cleanup OAuth callback server on app quit
function cleanupOAuthServer() {
  if (oauthCallbackServer) {
    oauthCallbackServer.close(() => {
      console.log('🔐 OAuth callback server closed');
    });
    oauthCallbackServer = null;
  }
}

// App lifecycle
app.whenReady().then(async () => {
  // Register OAuth callback server for desktop app authentication
  registerOAuthCallbackServer();
  
  // Register custom protocols
  registerLocalAudioProtocol();
  registerLocalVideoProtocol();
  registerLocalImageProtocol();
  
  // Initialize storage and services
  await storage.init();
  await initServices();
  
  createWindow();
  
  // Handle pending OAuth callback if window was not ready
  if ((app as any).pendingOAuthCallback) {
    const { code, state } = (app as any).pendingOAuthCallback;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('oauth:callback', { code, state });
      delete (app as any).pendingOAuthCallback;
    }
  }
  
  // Ensure window is visible and focused
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
  
  // Handle files passed as arguments on first launch
  handleFileArgs();
  
  // Handle pending files (files passed before window was ready)
  if ((app as any).pendingFiles) {
    const pendingFiles = (app as any).pendingFiles as string[];
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔵 [CLI] Opening pending files (files passed before window was ready)');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📊 [CLI] Total pending files: ${pendingFiles.length}`);
    console.log('📋 [CLI] Pending files:');
    pendingFiles.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file}`);
    });
    
    console.log('🚀 [CLI] Opening pending files...');
    pendingFiles.forEach((file: string, index: number) => {
      console.log(`  🎵 [CLI] Opening pending file ${index + 1}/${pendingFiles.length}: "${file}"`);
      openMediaFile(file);
    });
    
    delete (app as any).pendingFiles;
    console.log('✅ [CLI] All pending files opened successfully');
    console.log('═══════════════════════════════════════════════════════════');
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

  // Auto-scan on startup (respect CLI scanMode)
  const settings = await storage.getSettings();
  let shouldAutoScan = false;
  
  if (cliOptions.scanMode === 'auto') {
    // Explicitly enabled via --auto-scan
    shouldAutoScan = true;
  } else if (cliOptions.scanMode === 'disabled') {
    // Explicitly disabled via --no-scan
    shouldAutoScan = false;
  } else {
    // Default behavior: use settings
    shouldAutoScan = settings.autoScanOnStartup && settings.musicDirectories.length > 0;
  }
  
  if (shouldAutoScan) {
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
  // Close OAuth window if still open
  if (oauthWindow && !oauthWindow.isDestroyed()) {
    oauthWindow.close();
  }
  
  // Close Stripe window if still open
  if (stripeWindow && !stripeWindow.isDestroyed()) {
    stripeWindow.close();
  }
  
  if (process.platform !== 'darwin') {
    cleanupOAuthServer();
    app.quit();
  }
});

app.on('before-quit', () => {
  cleanupOAuthServer();
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