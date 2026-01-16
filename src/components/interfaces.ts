/**
 * Interfaces communes pour tous les composants UI
 * 
 * Ce fichier définit les contrats que tous les composants doivent respecter
 * pour garantir l'indépendance et l'interopérabilité des systèmes UI.
 */

import type { Track, Video, Playlist, Album, Artist } from '@/types/music';

// ============================================
// LAYOUT COMPONENTS
// ============================================

export type ViewType =
  | "home"
  | "library"
  | "search"
  | "favorites"
  | "playlists"
  | "recent"
  | "albums"
  | "artists"
  | "videos"
  | "settings"
  | "album-detail"
  | "artist-detail"
  | "playlist-detail"
  | "player";

export interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
}

// ============================================
// PLAYER COMPONENTS
// ============================================

export interface NowPlayingBarProps {
  currentTrack: Track;
  isPlaying: boolean;
  currentTime: number;
  isShuffle: boolean;
  repeatMode: "off" | "all" | "one";
  volume: number;
  isMuted: boolean;
  isFavorite?: boolean;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onShuffle: () => void;
  onRepeat: () => void;
  onSeek: (value: number[]) => void;
  onVolumeChange: (value: number[]) => void;
  onMuteToggle: () => void;
  onToggleQueue: () => void;
  onFullscreen: () => void;
  onToggleFavorite?: () => void;
  onShowPlayer?: () => void;
  onShowLyrics?: () => void;
  isQueueOpen: boolean;
}

export interface FullscreenPlayerProps {
  currentTrack: Track;
  isPlaying: boolean;
  currentTime: number;
  isShuffle: boolean;
  repeatMode: "off" | "all" | "one";
  volume: number;
  isMuted: boolean;
  isFavorite?: boolean;
  isInline?: boolean;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onShuffle: () => void;
  onRepeat: () => void;
  onSeek: (value: number[]) => void;
  onVolumeChange: (value: number[]) => void;
  onMuteToggle: () => void;
  onClose: () => void;
  onToggleFavorite?: () => void;
}

export interface PlayerControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onShuffle: () => void;
  onRepeat: () => void;
  isShuffle: boolean;
  repeatMode: "off" | "all" | "one";
  className?: string;
}

// ============================================
// QUEUE COMPONENTS
// ============================================

export interface QueuePanelProps {
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onTrackSelect: (index: number) => void;
  onClose: () => void;
}

// ============================================
// VIEW COMPONENTS
// ============================================

export interface HomeViewProps {
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onTrackSelect: (index: number) => void;
  recentTracks?: Track[];
  favoriteTracks?: Track[];
}

export interface LibraryViewProps {
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onTrackSelect: (index: number) => void;
  onPlayNext?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  onAddToPlaylist?: (playlistId: string, track: Track) => void;
  title?: string;
  showFilters?: boolean;
  viewMode?: "tracks" | "albums" | "artists" | "folders";
  emptyMessage?: string;
  showHistory?: boolean;
}

export interface SearchViewProps {
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onTrackSelect: (index: number) => void;
}

// ============================================
// TRACK DISPLAY COMPONENTS
// ============================================

export interface TrackListProps {
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onTrackSelect: (index: number) => void;
  onPlayNext?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  onAddToPlaylist?: (playlistId: string, track: Track) => void;
  onToggleFavorite?: (trackId: string) => void;
  isFavorite?: (trackId: string) => boolean;
  playlists?: Playlist[];
  showAlbum?: boolean;
  showArtist?: boolean;
  showDuration?: boolean;
  showFavorite?: boolean;
  canUploadToCloudinary?: boolean;
  canUploadToBunny?: boolean;
  canUploadToNexus?: boolean;
}

export interface TrackListViewProps extends TrackListProps {
  // Same as TrackListProps
}

export interface TrackGridViewProps {
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onTrackSelect: (index: number) => void;
  onPlayNext?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  onAddToPlaylist?: (playlistId: string, track: Track) => void;
  onToggleFavorite?: (trackId: string) => void;
  isFavorite?: (trackId: string) => boolean;
  playlists?: Playlist[];
  canUploadToCloudinary?: boolean;
  canUploadToNexus?: boolean;
}

// ============================================
// CONTEXT MENU COMPONENTS
// ============================================

export interface TrackContextMenuProps {
  track: Track;
  playlists: Playlist[];
  isFavorite: boolean;
  onPlay: () => void;
  onPlayNext: () => void;
  onAddToQueue: () => void;
  onAddToPlaylist: (playlistId: string) => void;
  onCreatePlaylist: () => void;
  onToggleFavorite: () => void;
  onViewAlbum?: () => void;
  onViewArtist?: () => void;
  onShowInFolder?: () => void;
  onShowInfo?: () => void;
  onRemoveFromPlaylist?: () => void;
  onUploadToCloudinary?: () => void;
  canUploadToCloudinary?: boolean;
  isUploading?: boolean;
  onUploadToNexus?: () => void;
  canUploadToNexus?: boolean;
  isUploadingToNexus?: boolean;
  children: React.ReactNode;
}

export interface AlbumContextMenuProps {
  album: Album;
  tracks: Track[];
  onPlay: () => void;
  onPlayNext: () => void;
  onAddToQueue: () => void;
  onAddToPlaylist: (playlistId: string) => void;
  children: React.ReactNode;
}

export interface ArtistContextMenuProps {
  artist: Artist;
  tracks: Track[];
  onPlay: () => void;
  onPlayNext: () => void;
  onAddToQueue: () => void;
  onAddToPlaylist: (playlistId: string) => void;
  children: React.ReactNode;
}

export interface PlaylistContextMenuProps {
  playlist: Playlist;
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onExport?: () => void;
  children: React.ReactNode;
}

// ============================================
// MEDIA COMPONENTS
// ============================================

export interface AlbumArtProps {
  track: Track;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showPlayButton?: boolean;
  isPlaying?: boolean;
  onPlay?: () => void;
}

export interface AudioVisualizerProps {
  audioElement: HTMLAudioElement | null;
  type?: "bars" | "wave" | "circle";
  color?: string;
  className?: string;
}

export interface VideoPlayerProps {
  video: Video;
  isPlaying: boolean;
  currentTime: number;
  volume: number;
  isMuted: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onFullscreen?: () => void;
  autoPlay?: boolean;
}

export interface MusicPlayerProps {
  track: Track;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

// ============================================
// UTILITY COMPONENTS
// ============================================

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export interface LoadingScreenProps {
  message?: string;
  progress?: number;
}

export interface BackgroundEffectsProps {
  track?: Track;
  intensity?: number;
}

export interface LyricsDisplayProps {
  track: Track;
  currentTime: number;
  isPlaying: boolean;
}

export interface EqualizerProps {
  enabled: boolean;
  preset: string;
  customBands: number[];
  onEnabledChange: (enabled: boolean) => void;
  onPresetChange: (preset: string) => void;
  onBandsChange: (bands: number[]) => void;
}

// ============================================
// MODAL COMPONENTS
// ============================================

export interface PlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlist?: Playlist;
  tracks?: Track[];
  onSave: (name: string, trackIds: string[]) => void;
}

