import type {
  Track,
  TrackMetadata,
  Playlist,
  Settings,
  HistoryEntry,
  EqualizerPreset,
  LyricsResult,
  LyricsSearchResult,
  ScrobbleTrack,
  ScrobblerStatus,
  ScanProgress,
  Video,
} from './music';

export interface ElectronAPI {
  // Window controls
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;

  // File dialogs
  openDirectory: () => Promise<string[]>;
  openFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string[]>;

  // Audio library
  scanLibrary: (directories: string[]) => Promise<void>;
  getLibrary: () => Promise<Track[]>;
  onScanProgress: (callback: (progress: ScanProgress) => void) => () => void;

  // Video library
  scanVideos: (directories: string[]) => Promise<void>;
  getVideos: () => Promise<Video[]>;
  onVideoScanProgress: (callback: (progress: ScanProgress) => void) => () => void;

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
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};

