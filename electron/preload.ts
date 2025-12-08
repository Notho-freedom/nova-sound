import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods for window controls
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // File dialogs
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  openFile: (filters?: { name: string; extensions: string[] }[]) =>
    ipcRenderer.invoke('dialog:openFile', filters),

  // Audio library
  scanLibrary: (directories: string[]) => ipcRenderer.invoke('library:scan', directories),
  getLibrary: () => ipcRenderer.invoke('library:get'),
  onScanProgress: (callback: (progress: { current: number; total: number; file: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: { current: number; total: number; file: string }) => callback(progress);
    ipcRenderer.on('library:scan-progress', listener);
    return () => ipcRenderer.removeListener('library:scan-progress', listener);
  },

  // Track metadata
  getTrackMetadata: (filePath: string) => ipcRenderer.invoke('metadata:get', filePath),
  getAlbumArt: (filePath: string) => ipcRenderer.invoke('metadata:artwork', filePath),

  // Playlists
  getPlaylists: () => ipcRenderer.invoke('playlists:get'),
  createPlaylist: (name: string, trackIds: string[]) =>
    ipcRenderer.invoke('playlists:create', name, trackIds),
  updatePlaylist: (id: string, data: { name?: string; trackIds?: string[] }) =>
    ipcRenderer.invoke('playlists:update', id, data),
  deletePlaylist: (id: string) => ipcRenderer.invoke('playlists:delete', id),
  importPlaylist: (filePath: string) => ipcRenderer.invoke('playlists:import', filePath),
  exportPlaylist: (id: string, format: 'm3u' | 'pls') =>
    ipcRenderer.invoke('playlists:export', id, format),

  // Favorites
  getFavorites: () => ipcRenderer.invoke('favorites:get'),
  addFavorite: (trackId: string) => ipcRenderer.invoke('favorites:add', trackId),
  removeFavorite: (trackId: string) => ipcRenderer.invoke('favorites:remove', trackId),
  isFavorite: (trackId: string) => ipcRenderer.invoke('favorites:check', trackId),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: Record<string, unknown>) =>
    ipcRenderer.invoke('settings:update', settings),

  // History
  getHistory: () => ipcRenderer.invoke('history:get'),
  addToHistory: (trackId: string) => ipcRenderer.invoke('history:add', trackId),
  clearHistory: () => ipcRenderer.invoke('history:clear'),

  // Equalizer
  getEqualizerPresets: () => ipcRenderer.invoke('equalizer:presets'),
  saveEqualizerPreset: (name: string, bands: number[]) =>
    ipcRenderer.invoke('equalizer:save', name, bands),
  deleteEqualizerPreset: (name: string) => ipcRenderer.invoke('equalizer:delete', name),

  // Lyrics
  getLyrics: (artist: string, title: string, duration?: number) =>
    ipcRenderer.invoke('lyrics:get', artist, title, duration),
  searchLyrics: (query: string) => ipcRenderer.invoke('lyrics:search', query),

  // Scrobbling
  scrobbleTrack: (track: { artist: string; title: string; album?: string; duration: number }) =>
    ipcRenderer.invoke('scrobbler:scrobble', track),
  updateNowPlaying: (track: { artist: string; title: string; album?: string; duration: number }) =>
    ipcRenderer.invoke('scrobbler:nowPlaying', track),
  getScrobblerStatus: () => ipcRenderer.invoke('scrobbler:status'),
  authenticateLastFm: () => ipcRenderer.invoke('scrobbler:authenticate', 'lastfm'),
  authenticateLibreFm: () => ipcRenderer.invoke('scrobbler:authenticate', 'librefm'),
  disconnectScrobbler: (service: 'lastfm' | 'librefm') =>
    ipcRenderer.invoke('scrobbler:disconnect', service),

  // File system
  fileExists: (filePath: string) => ipcRenderer.invoke('fs:exists', filePath),
  getAudioDuration: (filePath: string) => ipcRenderer.invoke('audio:duration', filePath),
});

// Type definitions for the exposed API
export interface ElectronAPI {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  openDirectory: () => Promise<string[]>;
  openFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string[]>;
  scanLibrary: (directories: string[]) => Promise<void>;
  getLibrary: () => Promise<Track[]>;
  onScanProgress: (
    callback: (progress: { current: number; total: number; file: string }) => void
  ) => () => void;
  getTrackMetadata: (filePath: string) => Promise<TrackMetadata>;
  getAlbumArt: (filePath: string) => Promise<string | null>;
  getPlaylists: () => Promise<Playlist[]>;
  createPlaylist: (name: string, trackIds: string[]) => Promise<Playlist>;
  updatePlaylist: (id: string, data: { name?: string; trackIds?: string[] }) => Promise<Playlist>;
  deletePlaylist: (id: string) => Promise<void>;
  importPlaylist: (filePath: string) => Promise<Playlist>;
  exportPlaylist: (id: string, format: 'm3u' | 'pls') => Promise<string>;
  getFavorites: () => Promise<string[]>;
  addFavorite: (trackId: string) => Promise<void>;
  removeFavorite: (trackId: string) => Promise<void>;
  isFavorite: (trackId: string) => Promise<boolean>;
  getSettings: () => Promise<Settings>;
  updateSettings: (settings: Record<string, unknown>) => Promise<Settings>;
  getHistory: () => Promise<HistoryEntry[]>;
  addToHistory: (trackId: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  getEqualizerPresets: () => Promise<EqualizerPreset[]>;
  saveEqualizerPreset: (name: string, bands: number[]) => Promise<void>;
  deleteEqualizerPreset: (name: string) => Promise<void>;
  getLyrics: (artist: string, title: string, duration?: number) => Promise<LyricsResult | null>;
  searchLyrics: (query: string) => Promise<LyricsSearchResult[]>;
  scrobbleTrack: (track: ScrobbleTrack) => Promise<void>;
  updateNowPlaying: (track: ScrobbleTrack) => Promise<void>;
  getScrobblerStatus: () => Promise<ScrobblerStatus>;
  authenticateLastFm: () => Promise<void>;
  authenticateLibreFm: () => Promise<void>;
  disconnectScrobbler: (service: 'lastfm' | 'librefm') => Promise<void>;
  fileExists: (filePath: string) => Promise<boolean>;
  getAudioDuration: (filePath: string) => Promise<number>;
}

interface Track {
  id: string;
  filePath: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverUrl?: string;
}

interface TrackMetadata {
  title: string;
  artist: string;
  album: string;
  year?: number;
  genre?: string;
  duration: number;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  format: string;
}

interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface Settings {
  musicDirectories: string[];
  equalizerEnabled: boolean;
  equalizerPreset: string;
  customEqualizer: number[];
  scrobblingEnabled: boolean;
  lastFmConnected: boolean;
  libreFmConnected: boolean;
  theme: 'dark' | 'light' | 'system';
  language: string;
}

interface HistoryEntry {
  trackId: string;
  playedAt: string;
}

interface EqualizerPreset {
  name: string;
  bands: number[];
  isCustom: boolean;
}

interface LyricsResult {
  syncedLyrics?: string;
  plainLyrics?: string;
  source: string;
}

interface LyricsSearchResult {
  id: number;
  artist: string;
  title: string;
  album?: string;
  duration?: number;
}

interface ScrobbleTrack {
  artist: string;
  title: string;
  album?: string;
  duration: number;
}

interface ScrobblerStatus {
  lastFm: {
    connected: boolean;
    username?: string;
  };
  libreFm: {
    connected: boolean;
    username?: string;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

