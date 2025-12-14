# Rapport d'Interaction entre Electron et Next.js

## Vue d'ensemble

Ce projet combine **Electron** (application desktop) et **Next.js** (framework React) pour créer une application de lecteur audio/vidéo hybride. L'architecture utilise **Next.js standalone avec serveur intégré** : le serveur Next.js tourne directement dans le processus principal Electron, permettant un SSR complet avec sécurité des secrets côté serveur.

> ⚠️ **Workflow actuel** : Le serveur Next.js standalone démarre dans Electron et la fenêtre charge `http://localhost:PORT`. Voir `docs/WORKFLOW_NEXTJS_STANDALONE.md` pour les détails complets.

---

## Architecture Générale

### 1. Structure des Processus

```
┌─────────────────────────────────────┐
│   Processus Principal (Electron)   │
│   - main.ts                        │
│   - Services Electron              │
│   - IPC Handlers                   │
└──────────────┬──────────────────────┘
               │
               │ IPC (Inter-Process Communication)
               │
┌──────────────▼──────────────────────┐
│   Processus Renderer (BrowserWindow)│
│   - Next.js Application             │
│   - React Components                │
│   - UI/UX                           │
└─────────────────────────────────────┘
```

### 2. Communication IPC

La communication entre Electron et Next.js se fait via **IPC (Inter-Process Communication)** :

- **Preload Script** (`electron/preload.cjs`) : Expose l'API Electron au processus renderer de manière sécurisée
- **Context Bridge** : Crée un pont sécurisé entre le processus principal et le renderer
- **IPC Handlers** : Gèrent les requêtes depuis le renderer vers le processus principal

---

## Points d'Interaction Clés

### 1. Chargement de l'Application

#### Workflow Next.js Standalone avec Serveur Intégré

```typescript
// TOUJOURS charger depuis localhost (dev ou production)
const port = cliOptions.port || NEXT_PORT;
mainWindow.loadURL(`http://localhost:${port}`);
```

**Comportement :**
- **Dev** : Electron charge Next.js depuis `http://localhost:3000` (serveur de développement `next dev`)
- **Production** : Electron démarre le serveur Next.js standalone intégré, puis charge `http://localhost:3000`

Le serveur Next.js standalone est démarré dans le processus principal Electron via `startNextServer()` :

```typescript
async function startNextServer(): Promise<void> {
  if (isDev) {
    // En dev, le serveur Next.js tourne déjà via "next dev"
    return;
  }

  // En production, démarrer le serveur Next.js standalone
  nextApp = next({
    dev: false,
    dir: standalonePath, // .next/standalone
  });

  await nextApp.prepare();
  const handle = nextApp.getRequestHandler();
  nextServer = createServer((req, res) => handle(req, res));
  nextServer.listen(3000);
}
```

#### Build Process
```17:18:package.json
    "build:electron": "npm run build && node scripts/copy-build-to-local-ui.js && node scripts/generate-version.js && tsc -p electron/tsconfig.json",
    "postbuild": "node scripts/copy-build-to-local-ui.js && node scripts/generate-version.js && node scripts/generate-build-zip.js",
```

Le script `copy-build-to-local-ui.js` copie le build Next.js vers `local-ui/` pour qu'Electron puisse le charger en mode offline.

### 2. Configuration Next.js pour Electron

```1:76:next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
    unoptimized: true, // Pour Electron
  },
  webpack: (config, { isServer }) => {
    // Ignorer les modules Electron côté serveur
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'electron': 'commonjs electron',
      });
    }
    
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    
    // Ignorer les modules Electron côté client
    config.externals = config.externals || [];
    if (!isServer) {
      config.externals.push({
        electron: 'electron',
      });
    }
    
    // Exclure les fichiers Electron du build
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];
    config.module.rules.push({
      test: /electron\/.*\.ts$/,
      use: 'ignore-loader',
    });
    // Exclure les fichiers de test et config Vitest
    config.module.rules.push({
      test: /(vitest\.config|vitest\.setup|\.test|\.spec)\.ts$/,
      use: 'ignore-loader',
    });
    return config;
  },
  
  // Headers pour les routes API
  async headers() {
    return [
      {
        source: '/api/update/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ];
  },
  // Désactiver certaines optimisations pour Electron
  // Mark native Node.js modules as external (server-only)
  serverExternalPackages: ['electron', 'ssh2', 'ssh2-sftp-client'],
  // Configuration Turbopack (vide pour permettre webpack)
  turbopack: {},
};

export default nextConfig;
```

**Points importants :**
- `output: 'standalone'` : Génère un build autonome pour Electron
- `images.unoptimized: true` : Désactive l'optimisation d'images (non nécessaire dans Electron)
- Exclusion des modules Electron du build Next.js pour éviter les conflits
- Exclusion des modules Node.js natifs côté client

### 3. API Electron Exposée

#### Preload Script
```1:125:electron/preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods for window controls
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // File dialogs
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  openFile: (filters) =>
    ipcRenderer.invoke('dialog:openFile', filters),
  openVideoFile: (multiSelect) =>
    ipcRenderer.invoke('dialog:openVideoFile', multiSelect),

  // Audio library
  scanLibrary: (directories) => ipcRenderer.invoke('library:scan', directories),
  getLibrary: () => ipcRenderer.invoke('library:get'),
  onScanProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('library:scan-progress', listener);
    return () => ipcRenderer.removeListener('library:scan-progress', listener);
  },

  // Video library
  scanVideos: (directories) => ipcRenderer.invoke('videos:scan', directories),
  getVideos: () => ipcRenderer.invoke('videos:get'),
  getVideo: (videoId) => ipcRenderer.invoke('videos:getVideo', videoId),
  updateVideoMetadata: (videoId, metadata) => ipcRenderer.invoke('videos:updateMetadata', videoId, metadata),
  addVideoFiles: (filePaths) => ipcRenderer.invoke('videos:addFiles', filePaths),
  addVideoFromUrl: (url, title) => ipcRenderer.invoke('videos:addFromUrl', url, title),
  onVideoScanProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('videos:scan-progress', listener);
    return () => ipcRenderer.removeListener('videos:scan-progress', listener);
  },
  onVideoAdded: (callback) => {
    const listener = (_event, video) => callback(video);
    ipcRenderer.on('videos:new', listener);
    return () => ipcRenderer.removeListener('videos:new', listener);
  },
  onVideoRemoved: (callback) => {
    const listener = (_event, filePath) => callback(filePath);
    ipcRenderer.removeListener('videos:removed', listener);
  },

  // Track metadata
  getTrackMetadata: (filePath) => ipcRenderer.invoke('metadata:get', filePath),
  getAlbumArt: (filePath) => ipcRenderer.invoke('metadata:artwork', filePath),

  // Playlists
  getPlaylists: () => ipcRenderer.invoke('playlists:get'),
  createPlaylist: (name, trackIds) =>
    ipcRenderer.invoke('playlists:create', name, trackIds),
  updatePlaylist: (id, data) =>
    ipcRenderer.invoke('playlists:update', id, data),
  deletePlaylist: (id) => ipcRenderer.invoke('playlists:delete', id),
  importPlaylist: (filePath) => ipcRenderer.invoke('playlists:import', filePath),
  exportPlaylist: (id, format) =>
    ipcRenderer.invoke('playlists:export', id, format),

  // Favorites
  getFavorites: () => ipcRenderer.invoke('favorites:get'),
  addFavorite: (trackId) => ipcRenderer.invoke('favorites:add', trackId),
  removeFavorite: (trackId) => ipcRenderer.invoke('favorites:remove', trackId),
  isFavorite: (trackId) => ipcRenderer.invoke('favorites:check', trackId),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) =>
    ipcRenderer.invoke('settings:update', settings),

  // History
  getHistory: () => ipcRenderer.invoke('history:get'),
  addToHistory: (trackId) => ipcRenderer.invoke('history:add', trackId),
  clearHistory: () => ipcRenderer.invoke('history:clear'),

  // Equalizer
  getEqualizerPresets: () => ipcRenderer.invoke('equalizer:presets'),
  saveEqualizerPreset: (name, bands) =>
    ipcRenderer.invoke('equalizer:save', name, bands),
  deleteEqualizerPreset: (name) => ipcRenderer.invoke('equalizer:delete', name),

  // Lyrics
  getLyrics: (artist, title, duration) =>
    ipcRenderer.invoke('lyrics:get', artist, title, duration),
  searchLyrics: (query) => ipcRenderer.invoke('lyrics:search', query),

  // Scrobbling
  scrobbleTrack: (track) =>
    ipcRenderer.invoke('scrobbler:scrobble', track),
  updateNowPlaying: (track) =>
    ipcRenderer.invoke('scrobbler:nowPlaying', track),
  getScrobblerStatus: () => ipcRenderer.invoke('scrobbler:status'),
  authenticateLastFm: () => ipcRenderer.invoke('scrobbler:authenticate', 'lastfm'),
  authenticateLibreFm: () => ipcRenderer.invoke('scrobbler:authenticate', 'librefm'),
  disconnectScrobbler: (service) =>
    ipcRenderer.invoke('scrobbler:disconnect', service),

  // File system
  fileExists: (filePath) => ipcRenderer.invoke('fs:exists', filePath),
  getAudioDuration: (filePath) => ipcRenderer.invoke('audio:duration', filePath),
  readFileAsBase64: (filePath) => ipcRenderer.invoke('file:readAsBase64', filePath),
  openPath: (filePath) => ipcRenderer.invoke('fs:openPath', filePath),
  
  // File open event (from "Open with..." or command line)
  onFileOpen: (callback) => {
    const listener = (_event, filePath) => callback(filePath);
    ipcRenderer.on('file:open', listener);
    return () => ipcRenderer.removeListener('file:open', listener);
  },
  
  // Update notifications
  onUpdateAvailable: (callback) => {
    const listener = (_event, updateInfo) => callback(updateInfo);
    ipcRenderer.on('update:available', listener);
    return () => ipcRenderer.removeListener('update:available', listener);
  },
});

console.log('Preload script loaded successfully');
```

#### Types TypeScript
```16:117:src/types/electron.d.ts
export interface ElectronAPI {
  // Window controls
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;

  // File dialogs
  openDirectory: () => Promise<string[]>;
  openFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string[]>;
  openVideoFile?: (multiSelect?: boolean) => Promise<string[]>;

  // Audio library
  scanLibrary: (directories: string[]) => Promise<void>;
  getLibrary: () => Promise<Track[]>;
  onScanProgress: (callback: (progress: ScanProgress) => void) => () => void;

  // Video library
  scanVideos: (directories: string[]) => Promise<Video[]>;
  getVideos: () => Promise<Video[]>;
  getVideo?: (videoId: string) => Promise<Video | null>;
  updateVideoMetadata?: (videoId: string, metadata: Partial<Video>) => Promise<Video | null>;
  addVideoFiles?: (filePaths: string[]) => Promise<Video[]>;
  addVideoFromUrl?: (url: string, title?: string) => Promise<Video>;
  onVideoScanProgress: (callback: (progress: ScanProgress) => void) => () => void;
  onVideoAdded: (callback: (video: Video) => void) => () => void;
  onVideoRemoved: (callback: (filePath: string) => callback(filePath);

  // Track metadata
  getTrackMetadata: (filePath: string) => Promise<TrackMetadata>;
  getAlbumArt: (filePath: string) => Promise<string | null>;

  // Playlists
  getPlaylists: () => Promise<Playlist[]>;
  createPlaylist: (name: string, trackIds: string[]) => Promise<Playlist>;
  updatePlaylist: (id: string, data: { name?: string; trackIds?: string[] }) => Promise<Playlist>;
  deletePlaylist: (id: string) => Promise<void>;
  importPlaylist: (filePath: string) => Promise<Playlist>;
  exportPlaylist: (id: string, format: 'm3u' | 'pls') => Promise<string>;

  // Favorites
  getFavorites: () => Promise<string[]>;
  addFavorite: (trackId: string) => Promise<void>;
  removeFavorite: (trackId: string) => Promise<void>;
  isFavorite: (trackId: string) => Promise<boolean>;

  // Settings
  getSettings: () => Promise<Settings>;
  updateSettings: (settings: Partial<Settings>) => Promise<Settings>;

  // History
  getHistory: () => Promise<HistoryEntry[]>;
  addToHistory: (trackId: string) => Promise<void>;
  clearHistory: () => Promise<void>;

  // Equalizer
  getEqualizerPresets: () => Promise<EqualizerPreset[]>;
  saveEqualizerPreset: (name: string, bands: number[]) => Promise<void>;
  deleteEqualizerPreset: (name: string) => Promise<void>;

  // Lyrics
  getLyrics: (artist: string, title: string, duration?: number) => Promise<LyricsResult | null>;
  searchLyrics: (query: string) => Promise<LyricsSearchResult[]>;

  // Scrobbling
  scrobbleTrack: (track: ScrobbleTrack) => Promise<void>;
  updateNowPlaying: (track: ScrobbleTrack) => Promise<void>;
  getScrobblerStatus: () => Promise<ScrobblerStatus>;
  authenticateLastFm: () => Promise<void>;
  authenticateLibreFm: () => Promise<void>;
  disconnectScrobbler: (service: 'lastfm' | 'librefm') => Promise<void>;

  // File system
  fileExists: (filePath: string) => Promise<boolean>;
  getAudioDuration: (filePath: string) => Promise<number>;
  readFileAsBase64: (filePath: string) => Promise<string>;
  openPath?: (filePath: string) => Promise<void>;
  
  // File open event (from "Open with..." or command line)
  onFileOpen: (callback: (filePath: string) => void) => () => void;
  
  // Update notifications
  onUpdateAvailable?: (callback: (updateInfo: {
    version: string;
    changelog?: string;
    buildDate?: string;
    commits?: Array<{
      hash: string;
      message: string;
      author: string;
      date: string;
    }>;
  }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
```

### 4. Protocoles Personnalisés

Electron enregistre des protocoles personnalisés pour charger les fichiers média locaux :

```323:354:electron/main.ts
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
```

Ces protocoles permettent à Next.js d'accéder aux fichiers locaux via des URLs personnalisées (`local-audio://` et `local-video://`).

---

## Flux de Données

### 1. Requête depuis Next.js vers Electron

```
┌─────────────┐
│ Next.js UI  │
│ Component   │
└──────┬──────┘
       │
       │ window.electronAPI.getLibrary()
       │
┌──────▼──────────────────┐
│ Preload Script          │
│ (Context Bridge)        │
└──────┬──────────────────┘
       │
       │ ipcRenderer.invoke('library:get')
       │
┌──────▼──────────────────┐
│ Electron Main Process   │
│ IPC Handler             │
└──────┬──────────────────┘
       │
       │ Service Call
       │
┌──────▼──────────────────┐
│ Electron Service        │
│ (audio-scanner.ts)      │
└─────────────────────────┘
```

### 2. Événement depuis Electron vers Next.js

```
┌─────────────────────────┐
│ Electron Service        │
│ (audio-scanner.ts)      │
└──────┬──────────────────┘
       │
       │ mainWindow.webContents.send('library:scan-progress', data)
       │
┌──────▼──────────────────┐
│ Electron Main Process   │
│ IPC Emitter             │
└──────┬──────────────────┘
       │
       │ IPC Event
       │
┌──────▼──────────────────┐
│ Preload Script          │
│ (ipcRenderer.on)        │
└──────┬──────────────────┘
       │
       │ Callback
       │
┌──────▼──────────────────┐
│ Next.js UI              │
│ Component               │
└─────────────────────────┘
```

---

## Services Electron

Les services suivants sont initialisés dans le processus principal Electron :

```212:239:electron/main.ts
// Initialize all services
async function initServices() {
  // Initialize storage first (other services depend on it)
  initStorage();
  
  // Initialize updater with callback for UI notification
  if (!isDev && !cliOptions.dev) {
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
  }
  
  // Initialize other services
  initMetadataExtractor();
  initAudioScanner();
  initVideoScanner();
  initPlaylistManager();
  initEqualizer();
  initLyricsProvider();
  initScrobbler();
}
```

**Services disponibles :**
- `storage` : Gestion du stockage local
- `updater` : Système de mise à jour automatique
- `metadata-extractor` : Extraction des métadonnées audio/vidéo
- `audio-scanner` : Scan de la bibliothèque audio
- `video-scanner` : Scan de la bibliothèque vidéo
- `playlist-manager` : Gestion des playlists
- `equalizer` : Égaliseur audio
- `lyrics-provider` : Fournisseur de paroles
- `scrobbler` : Scrobbling vers Last.fm/Libre.fm

---

## Utilisation dans les Composants Next.js

Les composants Next.js accèdent à l'API Electron via `window.electronAPI` :

```typescript
// Exemple d'utilisation
if (window.electronAPI) {
  const library = await window.electronAPI.getLibrary();
  const settings = await window.electronAPI.getSettings();
}
```

**Détection de l'environnement :**
```typescript
const isElectron = !!window.electronAPI;
```

---

## Scripts de Build

### Développement
```12:14:package.json
    "dev:electron": "concurrently -k \"next dev\" \"npm run electron:dev\"",
    "dev:backend": "cd server && npm run dev",
    "dev:all": "concurrently -k \"next dev\" \"npm run dev:backend\" \"npm run electron:dev\"",
```

Lance Next.js et Electron en parallèle pour le développement.

### Production
```17:18:package.json
    "build:electron": "npm run build && node scripts/copy-build-to-local-ui.js && node scripts/generate-version.js && tsc -p electron/tsconfig.json",
    "postbuild": "node scripts/copy-build-to-local-ui.js && node scripts/generate-version.js && node scripts/generate-build-zip.js",
```

1. Build Next.js (`npm run build`)
2. Copie vers `local-ui/` (pour Electron)
3. Compilation TypeScript Electron
4. Génération de version et ZIP

---

## Points d'Attention

### 1. Sécurité
- **Context Isolation** : Activé pour isoler le code Electron du code Next.js
- **Node Integration** : Désactivé dans le renderer pour la sécurité
- **Preload Script** : Utilise `contextBridge` pour exposer uniquement les APIs nécessaires

### 2. Performance
- **Offline-First** : Le build Next.js est copié localement pour fonctionner sans serveur
- **Protocoles Personnalisés** : Permettent le streaming efficace des fichiers média locaux
- **Range Requests** : Support pour la lecture vidéo avec seeking (HTTP 206)

### 3. Compatibilité
- **Fallback** : Si `local-ui/` n'existe pas, fallback vers `dist/`
- **Détection d'Environnement** : Les composants vérifient la présence de `window.electronAPI`
- **Web Security** : Désactivée (`webSecurity: false`) pour permettre le chargement de fichiers locaux

---

## Résumé

L'interaction entre Electron et Next.js dans ce projet suit une architecture hybride :

1. **Electron** gère :
   - L'interface système (fenêtres, dialogs, fichiers)
   - Les services backend (scan, métadonnées, playlists)
   - Les protocoles personnalisés pour les fichiers locaux

2. **Next.js** gère :
   - L'interface utilisateur (React components)
   - Le routage et la navigation
   - Les routes API (pour le backend web)

3. **Communication** :
   - IPC via `contextBridge` et `preload.cjs`
   - API typée via TypeScript
   - Événements bidirectionnels

Cette architecture permet une séparation claire des responsabilités tout en maintenant une intégration fluide entre les deux technologies.

