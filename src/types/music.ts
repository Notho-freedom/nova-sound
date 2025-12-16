export interface Track {
  id: string;
  filePath?: string;
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
  format?: string;
  addedAt?: string;
  lastPlayedAt?: string;
  playCount?: number;
}

export interface TrackMetadata {
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
  trackNumber?: number;
  discNumber?: number;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  trackIds: string[];
  coverUrl?: string;
  createdAt: string;
  updatedAt: string;
  isSmartPlaylist?: boolean;
  smartCriteria?: SmartPlaylistCriteria;
}

export interface SmartPlaylistCriteria {
  type: 'artist' | 'album' | 'genre' | 'year' | 'recent' | 'mostPlayed';
  value?: string;
  limit?: number;
}

export interface Album {
  id: string;
  name: string;
  artist: string;
  year?: number;
  coverUrl?: string;
  trackIds: string[];
}

export interface Artist {
  id: string;
  name: string;
  coverUrl?: string;
  albumIds: string[];
  trackIds: string[];
}

export interface HistoryEntry {
  trackId: string;
  playedAt: string;
  duration: number;
  completedPercentage: number;
}

export interface Settings {
  musicDirectories: string[];
  videoDirectories?: string[];
  equalizerEnabled: boolean;
  equalizerPreset: string;
  customEqualizer: number[];
  scrobblingEnabled: boolean;
  lastFmConnected: boolean;
  libreFmConnected: boolean;
  theme: 'dark' | 'light' | 'cyberpunk' | 'minimal' | 'spotify' | 'apple-music' | 'youtube-music' | 'tidal' | 'deezer' | 'system';
  language: string;
  audioQuality: 'low' | 'medium' | 'high' | 'lossless';
  crossfadeEnabled: boolean;
  crossfadeDuration: number;
  gaplessPlayback: boolean;
  normalizeVolume: boolean;
  showLyrics: boolean;
  miniPlayerEnabled: boolean;
  notificationsEnabled: boolean;
  autoScanOnStartup: boolean;
}

export interface EqualizerPreset {
  name: string;
  bands: number[];
  preamp: number;
  isCustom: boolean;
}

export interface EqualizerBand {
  frequency: number;
  gain: number;
}

export interface LyricsLine {
  time: number;
  text: string;
}

export interface LyricsResult {
  syncedLyrics?: LyricsLine[];
  plainLyrics?: string;
  source: string;
  trackName?: string;
  artistName?: string;
}

export interface LyricsSearchResult {
  id: number;
  artist: string;
  title: string;
  album?: string;
  duration?: number;
}

export interface ScrobbleTrack {
  artist: string;
  title: string;
  album?: string;
  duration: number;
  timestamp?: number;
}

export interface ScrobblerStatus {
  lastFm: {
    connected: boolean;
    username?: string;
  };
  libreFm: {
    connected: boolean;
    username?: string;
  };
}

export interface ScanProgress {
  current: number;
  total: number;
  file: string;
  phase: 'scanning' | 'extracting' | 'indexing' | 'complete';
}

export interface LibraryStats {
  totalTracks: number;
  totalAlbums: number;
  totalArtists: number;
  totalDuration: number;
  totalSize: number;
  lastScanDate?: string;
}

// Audio visualizer data
export interface AudioAnalyserData {
  frequencyData: Uint8Array;
  timeDomainData: Uint8Array;
  volume: number;
}

// Queue management
export interface QueueState {
  tracks: Track[];
  currentIndex: number;
  history: string[];
  shuffleOrder?: number[];
}

// Player state
export interface PlayerState {
  isPlaying: boolean;
  currentTrack: Track | null;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffled: boolean;
  repeatMode: 'off' | 'all' | 'one';
  queue: QueueState;
}

export interface Video {
  id: string;
  filePath: string;
  title: string;
  duration: number;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  format?: string;
  fileSize: number;
  addedAt: string;
  lastPlayedAt?: string;
  playCount?: number;
}

// Music recognition types
export interface RecognitionResult {
  trackId: string;
  originalArtist: string;
  originalAlbum: string;
  suggestedArtist: string;
  suggestedAlbum: string;
  confidence: number;
  method: 'filename' | 'folder' | 'similarity' | 'pattern';
}

export interface DetectedGroup {
  artist: string;
  album: string;
  tracks: Track[];
  confidence: number;
  pattern: string;
}