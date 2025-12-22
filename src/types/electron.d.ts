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
  RecognitionResult,
  DetectedGroup,
} from './music';

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
  onTrackAdded?: (callback: (track: Track) => void) => () => void;
  onTrackRemoved?: (callback: (filePath: string) => void) => () => void;
  onTrackUpdated?: (callback: (track: Track) => void) => () => void;

  // Video library
  scanVideos: (directories: string[]) => Promise<Video[]>;
  getVideos: () => Promise<Video[]>;
  getVideo?: (videoId: string) => Promise<Video | null>;
  updateVideoMetadata?: (videoId: string, metadata: Partial<Video>) => Promise<Video | null>;
  addVideoFiles?: (filePaths: string[]) => Promise<Video[]>;
  addVideoFromUrl?: (url: string, title?: string) => Promise<Video>;
  regenerateVideoThumbnail?: (videoId: string) => Promise<string | null>;
  regenerateAllVideoThumbnails?: () => Promise<number>;
  generateMissingVideoThumbnails?: () => Promise<{ generated: number; failed: number; total: number }>;
  onVideoScanProgress: (callback: (progress: ScanProgress) => void) => () => void;
  onVideoAdded: (callback: (video: Video) => void) => () => void;
  onVideoRemoved: (callback: (filePath: string) => void) => () => void;
  onVideoUpdated?: (callback: (video: Video) => void) => () => void;

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
  getFileInfo?: (filePath: string) => Promise<{
    size: number;
    exists: boolean;
    isFile: boolean;
    path: string;
  }>;
  uploadToCloud?: (options: {
    filePath: string;
    cloudName: string;
    uploadPreset: string;
    resourceType: 'video' | 'image' | 'raw' | 'auto';
    publicId?: string;
  }) => Promise<{
    success: boolean;
    url?: string;
    publicId?: string;
    bytes?: number;
    error?: string;
  }>;
  uploadToNexus?: (options: {
    filePath: string;
    apiUrl: string;
    accessToken: string;
    fileName?: string;
    onProgress?: (progress: number) => void;
  }) => Promise<{
    success: boolean;
    url?: string;
    id?: string;
    size?: number;
    error?: string;
  }>;
  
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
  
  // Music recognition
  recognizeAll?: () => Promise<RecognitionResult[]>;
  applyRecognition?: (results: RecognitionResult[]) => Promise<number>;
  detectPatterns?: () => Promise<DetectedGroup[]>;
  applyDetectedGroup?: (group: DetectedGroup) => Promise<number>;
  recognizeTrack?: (trackId: string) => Promise<RecognitionResult | null>;
  onRecognitionUpdated?: (callback: (updated: number) => void) => () => void;

  // OAuth for desktop app authentication
  openOAuthWindow: (url: string) => Promise<void>;
  onOAuthCallback?: (callback: (data: { code: string; state: string }) => void) => () => void;
  onOAuthError?: (callback: (data: { error: string }) => void) => () => void;
  
  // Stripe for checkout and portal
  openStripeWindow: (url: string) => Promise<void>;
  onStripeCheckoutSuccess?: (callback: (data: { sessionId: string; url?: string }) => void) => () => void;
  onStripeCheckoutCanceled?: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};

