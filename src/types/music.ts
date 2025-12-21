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
  
  // Media source (YouTube, local, cloud, etc.)
  mediaSource?: 'local' | 'youtube' | 'cloudinary' | 'nexus' | 'bunny' | 'planethoster' | 'soundcloud' | 'vimeo' | 'unknown';
  youtubeVideoId?: string; // ID vidéo YouTube si source = 'youtube'
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

// Video genres/categories
export type VideoGenre = 
  | 'action'
  | 'adventure'
  | 'animation'
  | 'comedy'
  | 'crime'
  | 'documentary'
  | 'drama'
  | 'family'
  | 'fantasy'
  | 'horror'
  | 'music'
  | 'mystery'
  | 'romance'
  | 'scifi'
  | 'thriller'
  | 'war'
  | 'western'
  | 'sport'
  | 'biography'
  | 'history'
  | 'anime'
  | 'gaming'
  | 'tutorial'
  | 'vlog'
  | 'short'
  | 'other';

// Video content type
export type VideoType = 'movie' | 'series' | 'episode' | 'clip' | 'trailer' | 'music_video' | 'documentary' | 'other';

// Video quality
export type VideoQuality = '480p' | '720p' | '1080p' | '1440p' | '4k' | '8k' | 'unknown';

// Subtitle track
export interface SubtitleTrack {
  id: string;
  language: string;
  label: string;
  filePath?: string;
  url?: string;
  isDefault?: boolean;
}

// Audio track for multi-audio videos
export interface AudioTrack {
  id: string;
  language: string;
  label: string;
  codec?: string;
  isDefault?: boolean;
}

// Video chapter/segment
export interface VideoChapter {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  thumbnailUrl?: string;
}

// Episode info for series
export interface EpisodeInfo {
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle?: string;
  airDate?: string;
}

// Series/Collection info
export interface VideoSeries {
  id: string;
  title: string;
  description?: string;
  posterUrl?: string;
  backdropUrl?: string;
  totalSeasons?: number;
  totalEpisodes?: number;
  status?: 'ongoing' | 'ended' | 'cancelled';
  startYear?: number;
  endYear?: number;
}

// Watch progress for continue watching
export interface WatchProgress {
  videoId: string;
  currentTime: number;
  duration: number;
  percentage: number;
  lastWatchedAt: string;
  completed: boolean;
}

// Video rating
export interface VideoRating {
  source: 'user' | 'imdb' | 'tmdb' | 'rottentomatoes';
  value: number;
  maxValue: number;
  votes?: number;
}

// Cloud upload status for videos
export interface VideoCloudStatus {
  isUploaded: boolean;
  provider?: 'cloudinary' | 'nexus' | 'bunny' | 'planethoster';
  uploadedAt?: string;
  cloudUrl?: string;
  cloudId?: string;
}

export interface Video {
  id: string;
  filePath: string;
  title: string;
  duration: number;
  thumbnailUrl?: string;
  posterUrl?: string;
  backdropUrl?: string;
  width?: number;
  height?: number;
  format?: string;
  codec?: string;
  bitrate?: number;
  frameRate?: number;
  fileSize: number;
  addedAt: string;
  lastPlayedAt?: string;
  playCount?: number;
  
  // Enhanced metadata
  type?: VideoType;
  genres?: VideoGenre[];
  quality?: VideoQuality;
  description?: string;
  synopsis?: string;
  tagline?: string;
  year?: number;
  releaseDate?: string;
  director?: string;
  cast?: string[];
  studio?: string;
  country?: string;
  language?: string;
  
  // YouTube-specific metadata
  channelTitle?: string;
  channelId?: string;
  
  // Ratings
  ratings?: VideoRating[];
  userRating?: number;
  
  // Content info
  ageRating?: string;
  contentWarnings?: string[];
  
  // Series/Episode info
  seriesId?: string;
  series?: VideoSeries;
  episodeInfo?: EpisodeInfo;
  
  // Multi-media tracks
  subtitles?: SubtitleTrack[];
  audioTracks?: AudioTrack[];
  chapters?: VideoChapter[];
  
  // User interaction
  isFavorite?: boolean;
  isInWatchlist?: boolean;
  watchProgress?: WatchProgress;
  tags?: string[];
  
  // Cloud status
  cloudStatus?: VideoCloudStatus;
  
  // Trailer/Preview
  trailerUrl?: string;
  previewUrl?: string;
  
  // Related content
  relatedVideoIds?: string[];
  
  // External IDs
  imdbId?: string;
  tmdbId?: string;
  
  // Media source (YouTube, local, cloud, etc.)
  mediaSource?: 'local' | 'youtube' | 'cloudinary' | 'nexus' | 'bunny' | 'planethoster' | 'soundcloud' | 'vimeo' | 'unknown';
  youtubeVideoId?: string; // ID vidéo YouTube si source = 'youtube'
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