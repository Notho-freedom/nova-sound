/**
 * Interfaces communes pour tous les services
 * 
 * Ce fichier définit les contrats que tous les services doivent respecter
 * pour garantir l'indépendance et l'interopérabilité des systèmes.
 */

// ============================================
// AUTHENTIFICATION
// ============================================

export interface User {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  subscriptionStatus?: 'active' | 'inactive' | 'cancelled';
  plan?: 'free' | 'pro';
  subscriptionEndDate?: string;
  storageUsed?: number;
  storageLimit?: number;
}

export interface AuthService {
  getCurrentUser(): User | null;
  getAccessToken(): Promise<string | null>;
  getUserProfile(): UserProfile | null;
  isPro(): boolean;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}

// ============================================
// STOCKAGE CLOUD
// ============================================

export interface UploadResult {
  id: string;
  url: string;
  path: string;
  size: number;
  provider: 'cloudinary' | 'nexus' | 'bunny' | 'planethoster' | 'local';
}

export interface StorageProvider {
  upload(
    file: Buffer | Blob,
    path: string,
    options?: UploadOptions
  ): Promise<UploadResult>;
  delete(path: string): Promise<void>;
  getUrl(path: string): string;
  isConfigured(): boolean;
}

export interface UploadOptions {
  contentType?: string;
  onProgress?: (progress: number) => void;
  metadata?: Record<string, any>;
}

// ============================================
// BIBLIOTHÈQUE
// ============================================

export interface ScanProgress {
  phase: 'scanning' | 'extracting' | 'complete' | 'error';
  current?: number;
  total?: number;
  currentFile?: string;
  error?: string;
}

export interface LibraryService {
  scan(directories: string[]): Promise<void>;
  getTracks(): Promise<Track[]>;
  getVideos(): Promise<Video[]>;
  onScanProgress(callback: (progress: ScanProgress) => void): () => void;
}

// ============================================
// LECTURE
// ============================================

// Import types from music.ts to avoid duplication
import type { Track, Video, Playlist, Settings } from '@/types/music';

// Re-export for convenience
export type { Track, Video, Playlist, Settings };

export interface PlayerService {
  play(track: Track | Video): void;
  pause(): void;
  stop(): void;
  seek(time: number): void;
  setVolume(volume: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  isPlaying(): boolean;
}

export interface QueueService {
  addToQueue(tracks: Track[]): void;
  addToQueueNext(tracks: Track[]): void;
  removeFromQueue(trackId: string): void;
  shuffle(): void;
  unshuffle(): void;
  clear(): void;
  getQueue(): Track[];
  getCurrentIndex(): number;
  setCurrentIndex(index: number): void;
}

// ============================================
// SYNCHRONISATION
// ============================================

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncAt?: string;
  pendingItems: number;
  errors: SyncError[];
}

export interface SyncError {
  type: string;
  message: string;
  timestamp: string;
}

export interface FirebaseSyncService {
  queueSync(type: string, data: any): void;
  startSync(): Promise<void>;
  stopSync(): void;
  getSyncStatus(): SyncStatus;
  onSyncStatusChange(callback: (status: SyncStatus) => void): () => void;
}

// ============================================
// PAIEMENT
// ============================================

export interface CheckoutSession {
  url: string;
  sessionId: string;
}

export interface PortalSession {
  url: string;
}

export interface SubscriptionStatus {
  isPro: boolean;
  plan?: 'free' | 'pro';
  status?: 'active' | 'inactive' | 'cancelled';
  endDate?: string;
}

export interface StripeService {
  createCheckoutSession(priceId: string): Promise<CheckoutSession>;
  createPortalSession(): Promise<PortalSession>;
  getSubscriptionStatus(): Promise<SubscriptionStatus>;
  isPro(): Promise<boolean>;
}

// ============================================
// ELECTRON
// ============================================

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

export interface ElectronAPI {
  // File system
  scanLibrary(directories: string[]): Promise<void>;
  getLibrary(): Promise<Track[]>;
  scanVideos(directories: string[]): Promise<Video[]>;
  getVideos(): Promise<Video[]>;
  
  // Metadata
  getTrackMetadata(filePath: string): Promise<TrackMetadata>;
  getAlbumArt(filePath: string): Promise<string | null>;
  
  // Playlists
  getPlaylists(): Promise<Playlist[]>;
  createPlaylist(name: string, trackIds: string[]): Promise<Playlist>;
  updatePlaylist(id: string, data: Partial<Playlist>): Promise<Playlist>;
  deletePlaylist(id: string): Promise<void>;
  
  // Favorites
  getFavorites(): Promise<string[]>;
  addFavorite(trackId: string): Promise<void>;
  removeFavorite(trackId: string): Promise<void>;
  
  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(settings: Partial<Settings>): Promise<Settings>;
  
  // File open
  onFileOpen(callback: (filePath: string) => void): () => void;
}

// Types communs sont importés depuis @/types/music

