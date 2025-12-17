import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  serverTimestamp,
  Firestore
} from 'firebase/firestore';
import { getDb, getFirebaseApp, waitForFirebase } from './firebase';
import type { 
  Settings, 
  Playlist, 
  EqualizerPreset,
  HistoryEntry 
} from '../types/music';
import { getUserStorageKeySync } from '../lib/storage-utils';

// Helper function to get Firestore instance dynamically
// This handles the async initialization of Firebase
function getFirestoreInstance(): Firestore | null {
  // First try to get from the shared firebase.ts module
  const sharedDb = getDb();
  if (sharedDb) {
    return sharedDb;
  }
  
  // Fallback: try to initialize from firebase app
  const app = getFirebaseApp();
  if (app) {
    try {
      return getFirestore(app);
    } catch (error) {
      // Firestore may already be initialized, try to get existing instance
      try {
        return getFirestore();
      } catch {
        console.error('Error getting Firestore instance:', error);
      }
    }
  }
  
  return null;
}

// User data structure in Firestore
export interface UserAppData {
  // Settings
  settings?: Settings;
  
  // Playlists (stored as subcollection)
  // playlists collection: users/{uid}/playlists/{playlistId}
  
  // Favorites (array of track IDs)
  favorites?: string[];
  
  // Play history
  history?: HistoryEntry[];
  
  // Equalizer presets
  equalizerPresets?: EqualizerPreset[];
  
  // Theme preference
  theme?: 'dark' | 'light' | 'cyberpunk' | 'minimal' | 'spotify' | 'apple-music' | 'youtube-music' | 'tidal' | 'deezer' | 'system';
  
  // Notifications enabled
  notificationsEnabled?: boolean;
  
  // Volume (0-100)
  volume?: number;
  
  // Search history
  searchHistory?: string[];
  
  // Uploaded media (for easy identification)
  uploadedMedia?: Array<{
    id: string;
    name: string;
    uploadedAt: string;
    cloudProvider?: 'cloudinary' | 'nexus' | 'bunny' | 'planethoster';
    url?: string;
    size?: number;
  }>;
  
  // Cloudinary config (encrypted or stored securely)
  cloudinaryConfig?: {
    cloudName: string;
    apiKey: string;
    uploadPreset: string;
  };
  
  // Scrobbler settings
  scrobblerSettings?: {
    lastFm?: {
      connected: boolean;
      username?: string;
      sessionKey?: string;
    };
    libreFm?: {
      connected: boolean;
      username?: string;
      sessionKey?: string;
    };
  };
  
  // Last sync timestamp
  lastSyncAt?: string;
  
  // Version for conflict resolution
  version?: number;
}

class FirebaseSyncService {
  private syncListeners: Map<string, () => void> = new Map();
  private isSyncing: boolean = false;
  private syncQueue: Array<{ type: string; data: any }> = [];
  private currentUserId: string | null = null;
  private reconnectAttempts: Map<string, number> = new Map();
  private maxReconnectAttempts: number = 3;
  private reconnectDelay: number = 5000; // 5 seconds
  
  // Change detection and periodic sync
  private lastSyncedDataHash: string | null = null;
  private periodicSyncInterval: NodeJS.Timeout | null = null;
  private syncIntervalMs: number = 60 * 60 * 1000; // 1 hour
  private pendingChanges: Set<string> = new Set();
  private changeDetectionDebounce: NodeJS.Timeout | null = null;
  private changeDetectionDelay: number = 2000; // 2 seconds debounce

  // Initialize sync for a user
  private isInitializing: boolean = false;
  private isInitialized: boolean = false;
  
  async initializeSync(userId: string): Promise<void> {
    const db = getFirestoreInstance();
    if (!db) {
      console.warn('Firestore not initialized, cannot sync');
      // Try to wait for Firebase to be ready
      const firebase = await waitForFirebase();
      if (!firebase) {
        console.warn('Firebase not available, sync disabled');
        return;
      }
    }

    // Empêcher l'initialisation multiple
    if (this.isInitialized && this.currentUserId === userId) {
      return; // Déjà initialisé pour cet utilisateur
    }

    // Prevent concurrent initialization
    if (this.isInitializing) {
      return; // Silent - already initializing
    }

    if (this.currentUserId === userId && this.syncListeners.size > 0) {
      return; // Silent - already initialized
    }

    this.isInitializing = true;

    try {
      // Clean up previous listeners
      this.cleanup();

      this.currentUserId = userId;
      
      // Migrate old localStorage keys to user-isolated keys
      try {
        const { migrateToUserIsolatedStorage } = await import('../lib/storage-utils');
        await migrateToUserIsolatedStorage();
      } catch (error) {
        console.error('Failed to migrate to user-isolated storage:', error);
      }
      
      // Load initial data from Firestore
      await this.loadFromFirestore(userId);
      
      // Set up real-time listeners (silent - no logs)
      this.setupRealtimeListeners(userId);
      
      // Start periodic sync (every hour)
      this.startPeriodicSync(userId);
      
      // Calculate initial hash for change detection
      const initialData = await this.getCurrentLocalData();
      this.lastSyncedDataHash = this.calculateDataHash(initialData);
      
      // Only log on first initialization, not on every call
      if (!this.syncListeners.has('appData')) {
        console.log(`✅ Firebase sync initialized for user: ${userId}`);
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing sync:', error);
      this.cleanup();
      this.isInitialized = false;
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  // Load all user data from Firestore (silent mode - minimal logs)
  // Made public for external access (settings, theme, notifications hooks)
  async loadFromFirestore(userId?: string): Promise<UserAppData | null> {
    const db = getFirestoreInstance();
    const targetUserId = userId || this.currentUserId;
    if (!db || !targetUserId) return null;
    
    try {
      const userDataRef = doc(db, 'users', targetUserId, 'appData', 'data');
      const userDataSnap = await getDoc(userDataRef);

      if (userDataSnap.exists()) {
        const data = userDataSnap.data() as UserAppData;
        
        // Merge with local data (Firestore takes priority for first load)
        await this.mergeWithLocal(data);
        
        return data;
      } else {
        // No Firestore data, save local data to Firestore
        await this.saveToFirestore(targetUserId);
        return null;
      }
    } catch (error: any) {
      // Only log actual errors
      if (error.code !== 'unavailable' && error.code !== 'cancelled') {
        console.error('Error loading from Firestore:', error);
      }
      return null;
    }
  }

  // Set up real-time listeners for continuous sync (silent mode - no console logs)
  private setupRealtimeListeners(userId: string): void {
    const db = getFirestoreInstance();
    if (!db) return;
    
    // Reset reconnect attempts for this user
    this.reconnectAttempts.set('appData', 0);
    this.reconnectAttempts.set('playlists', 0);
    
    // Main app data listener
    const appDataRef = doc(db, 'users', userId, 'appData', 'data');
    const unsubscribeAppData = onSnapshot(
      appDataRef,
      (snapshot) => {
        // Reset reconnect attempts on successful connection
        this.reconnectAttempts.set('appData', 0);
        
        if (snapshot.exists() && !this.isSyncing) {
          const data = snapshot.data() as UserAppData;
          this.handleRemoteUpdate(data);
        }
      },
      (error) => {
        // Only log actual errors, not normal connection issues
        if (error.code !== 'unavailable' && error.code !== 'cancelled') {
          console.error('Error in app data listener:', error);
        }
        this.handleListenerError('appData', userId, () => {
          // Retry setup
          const existingUnsubscribe = this.syncListeners.get('appData');
          if (existingUnsubscribe) {
            existingUnsubscribe();
          }
          this.setupRealtimeListeners(userId);
        });
      }
    );
    this.syncListeners.set('appData', unsubscribeAppData);

    // Playlists subcollection listener
    if (!this.syncListeners.has('playlists')) {
      const playlistsRef = collection(db, 'users', userId, 'playlists');
      const unsubscribePlaylists = onSnapshot(
        playlistsRef,
        (snapshot) => {
          // Reset reconnect attempts on successful connection
          this.reconnectAttempts.set('playlists', 0);
          
          if (!this.isSyncing) {
            const playlists: Playlist[] = [];
            snapshot.forEach((doc) => {
              playlists.push({ id: doc.id, ...doc.data() } as Playlist);
            });
            this.handlePlaylistsUpdate(playlists);
          }
        },
        (error) => {
          // Only log actual errors, not normal connection issues
          if (error.code !== 'unavailable' && error.code !== 'cancelled') {
            console.error('Error in playlists listener:', error);
          }
          this.handleListenerError('playlists', userId, () => {
            // Retry setup
            const existingUnsubscribe = this.syncListeners.get('playlists');
            if (existingUnsubscribe) {
              existingUnsubscribe();
              this.syncListeners.delete('playlists');
            }
            this.setupRealtimeListeners(userId);
          });
        }
      );
      this.syncListeners.set('playlists', unsubscribePlaylists);
    }
  }

  // Handle listener errors with exponential backoff
  private handleListenerError(listenerKey: string, userId: string, retryCallback: () => void): void {
    const attempts = this.reconnectAttempts.get(listenerKey) || 0;
    
    if (attempts >= this.maxReconnectAttempts) {
      console.warn(`Max reconnect attempts reached for ${listenerKey}. Stopping automatic reconnection.`);
      // Remove listener to prevent further errors
      const unsubscribe = this.syncListeners.get(listenerKey);
      if (unsubscribe) {
        unsubscribe();
        this.syncListeners.delete(listenerKey);
      }
      return;
    }

    const newAttempts = attempts + 1;
    this.reconnectAttempts.set(listenerKey, newAttempts);
    
    // Exponential backoff: delay * 2^attempts
    const delay = this.reconnectDelay * Math.pow(2, attempts - 1);
    
    // Silent retry - no console log
    
    setTimeout(() => {
      retryCallback();
    }, delay);
  }

  // Handle remote updates from Firestore
  private async handleRemoteUpdate(data: UserAppData): Promise<void> {
    this.isSyncing = true;
    
    try {
      // Update local storage with Firestore data
      if (data.settings) {
        this.saveToLocalStorage('nexus-settings', data.settings);
        // Trigger Electron storage update if available
        if (window.electronAPI) {
          await window.electronAPI.updateSettings(data.settings);
        }
      }

      if (data.favorites) {
        this.saveToLocalStorage('nexus-favorites', data.favorites);
        // Trigger Electron storage update if available
        if (window.electronAPI) {
          for (const trackId of data.favorites) {
            await window.electronAPI.addFavorite(trackId);
          }
        }
      }

      if (data.history) {
        this.saveToLocalStorage('nexus-play-history', data.history);
      }

      if (data.theme) {
        this.saveToLocalStorage('nexus-theme', data.theme);
      }

      if (data.notificationsEnabled !== undefined) {
        this.saveToLocalStorage('nexus-notifications-enabled', data.notificationsEnabled);
      }

      if (data.volume !== undefined) {
        this.saveToLocalStorage('nexus-volume', data.volume);
      }

      if (data.searchHistory) {
        this.saveToLocalStorage('nexus-search-history', data.searchHistory);
      }

      if (data.uploadedMedia && this.currentUserId) {
        // Use user-isolated storage key
        const storageKey = getUserStorageKeySync('nexus-uploaded-media', this.currentUserId);
        this.saveToLocalStorage(storageKey, data.uploadedMedia);
      } else if (data.uploadedMedia) {
        // Fallback to old key for backward compatibility
        this.saveToLocalStorage('nexus-uploaded-media', data.uploadedMedia);
      }

      if (data.cloudinaryConfig) {
        this.saveToLocalStorage('nexus-cloudinary-config', data.cloudinaryConfig);
      }

      if (data.equalizerPresets) {
        this.saveToLocalStorage('nexus-equalizer-presets', data.equalizerPresets);
      }

      if (data.scrobblerSettings) {
        this.saveToLocalStorage('nexus-scrobbler-settings', data.scrobblerSettings);
      }

      // Update hash after remote update
      this.lastSyncedDataHash = this.calculateDataHash(data);

      // Dispatch custom events for UI updates
      window.dispatchEvent(new CustomEvent('firebase-sync-update', { detail: data }));
      
      // Silent sync - no console logs for normal operations
    } catch (error) {
      console.error('Error handling remote update:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  // Handle playlists update
  private async handlePlaylistsUpdate(playlists: Playlist[]): Promise<void> {
    this.isSyncing = true;
    
    try {
      this.saveToLocalStorage('nexus-playlists', playlists);
      
      // Trigger Electron storage update if available
      if (window.electronAPI) {
        // Note: Electron storage manages playlists differently, 
        // so we might need to sync them individually
        for (const playlist of playlists) {
          // Check if playlist exists, update or create
          const existing = await window.electronAPI.getPlaylists();
          const exists = existing.find(p => p.id === playlist.id);
          
          if (exists) {
            await window.electronAPI.updatePlaylist(playlist.id, {
              name: playlist.name,
              trackIds: playlist.trackIds,
            });
          } else {
            await window.electronAPI.createPlaylist(playlist.name, playlist.trackIds);
          }
        }
      }

      window.dispatchEvent(new CustomEvent('firebase-playlists-update', { detail: playlists }));
      
      // Silent sync - no console logs for normal operations
    } catch (error) {
      console.error('Error handling playlists update:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  // Save data to Firestore (only if changed)
  async saveToFirestore(userId: string, data?: Partial<UserAppData>): Promise<void> {
    const db = getFirestoreInstance();
    if (!db || !userId) {
      console.warn('Cannot save to Firestore: no user ID or Firestore not initialized');
      return;
    }

    // Always save locally first
    if (data) {
      this.saveDataLocally(data);
    }

    // Check if data has changed before syncing
    const currentData = await this.getCurrentLocalData();
    const mergedData: UserAppData = {
      ...currentData,
      ...data,
    };
    const newHash = this.calculateDataHash(mergedData);

    // Only sync if data has changed
    if (newHash === this.lastSyncedDataHash) {
      return; // Silent - no changes
    }

    this.isSyncing = true;
    
    // Emit sync start event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nexus-sync-start'));
    }

    try {
      const userDataRef = doc(db, 'users', userId, 'appData', 'data');
      
      // Merge with provided data
      const dataToSave: UserAppData = {
        ...mergedData,
        lastSyncAt: new Date().toISOString(),
        version: (currentData.version || 0) + 1,
      };

      await setDoc(userDataRef, dataToSave, { merge: true });
      
      // Update hash after successful sync
      this.lastSyncedDataHash = newHash;
      this.pendingChanges.clear();
      
      // Emit sync complete event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nexus-sync-complete'));
      }
      
      // Silent sync - no console logs for normal operations
    } catch (error) {
      console.error('Error saving to Firestore:', error);
      // Mark as pending for retry
      if (data) {
        Object.keys(data).forEach(key => this.pendingChanges.add(key));
      }
      
      // Emit sync error event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nexus-sync-error'));
      }
      
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  // Save data locally immediately
  private saveDataLocally(data: Partial<UserAppData>): void {
    if (data.settings) {
      this.saveToLocalStorage('nexus-settings', data.settings);
    }
    if (data.favorites) {
      this.saveToLocalStorage('nexus-favorites', data.favorites);
    }
    if (data.history) {
      this.saveToLocalStorage('nexus-play-history', data.history);
    }
    if (data.theme) {
      this.saveToLocalStorage('nexus-theme', data.theme);
    }
    if (data.notificationsEnabled !== undefined) {
      this.saveToLocalStorage('nexus-notifications-enabled', data.notificationsEnabled);
    }
    if (data.volume !== undefined) {
      this.saveToLocalStorage('nexus-volume', data.volume);
    }
    if (data.searchHistory) {
      this.saveToLocalStorage('nexus-search-history', data.searchHistory);
    }
      if (data.uploadedMedia) {
        if (this.currentUserId) {
          // Use user-isolated storage key
          const storageKey = getUserStorageKeySync('nexus-uploaded-media', this.currentUserId);
          this.saveToLocalStorage(storageKey, data.uploadedMedia);
        } else {
          // Fallback to old key for backward compatibility
          this.saveToLocalStorage('nexus-uploaded-media', data.uploadedMedia);
        }
      }
    if (data.cloudinaryConfig) {
      this.saveToLocalStorage('nexus-cloudinary-config', data.cloudinaryConfig);
    }
    if (data.equalizerPresets) {
      this.saveToLocalStorage('nexus-equalizer-presets', data.equalizerPresets);
    }
    if (data.scrobblerSettings) {
      this.saveToLocalStorage('nexus-scrobbler-settings', data.scrobblerSettings);
    }
  }

  // Save playlists to Firestore
  async savePlaylistsToFirestore(userId: string, playlists: Playlist[]): Promise<void> {
    const db = getFirestoreInstance();
    if (!db || !userId) {
      console.warn('Cannot save playlists: no user ID or Firestore not initialized');
      return;
    }

    this.isSyncing = true;

    try {
      // Delete all existing playlists first (or update them)
      const playlistsRef = collection(db, 'users', userId, 'playlists');
      const existingSnap = await getDocs(playlistsRef);
      
      // Update or create playlists
      for (const playlist of playlists) {
        const playlistRef = doc(db, 'users', userId, 'playlists', playlist.id);
        await setDoc(playlistRef, {
          ...playlist,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      // Delete playlists that no longer exist locally
      const localIds = new Set(playlists.map(p => p.id));
      existingSnap.forEach((docSnap) => {
        if (!localIds.has(docSnap.id)) {
          deleteDoc(docSnap.ref);
        }
      });

      // Silent - playlists saved
    } catch (error) {
      console.error('Error saving playlists to Firestore:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  // Get current local data
  private getCurrentLocalData(): Partial<UserAppData> {
    const data: Partial<UserAppData> = {};

    // Load from localStorage
    const settings = this.loadFromLocalStorage<Settings>('nexus-settings');
    if (settings) data.settings = settings;

    const favorites = this.loadFromLocalStorage<string[]>('nexus-favorites');
    if (favorites) data.favorites = favorites;

    const history = this.loadFromLocalStorage<HistoryEntry[]>('nexus-play-history');
    if (history) data.history = history;

    const theme = this.loadFromLocalStorage<'dark' | 'light' | 'cyberpunk' | 'minimal' | 'spotify' | 'apple-music' | 'youtube-music' | 'tidal' | 'deezer' | 'system'>('nexus-theme');
    if (theme) data.theme = theme;

    const notificationsEnabled = this.loadFromLocalStorage<boolean>('nexus-notifications-enabled');
    if (notificationsEnabled !== null) data.notificationsEnabled = notificationsEnabled;

    const volume = this.loadFromLocalStorage<number>('nexus-volume');
    if (volume !== null) data.volume = volume;

    const searchHistory = this.loadFromLocalStorage<string[]>('nexus-search-history');
    if (searchHistory) data.searchHistory = searchHistory;

    // Load uploaded media with user isolation
    // Note: This is called during sync, so we need to use the currentUserId
    if (this.currentUserId) {
      const storageKey = getUserStorageKeySync('nexus-uploaded-media', this.currentUserId);
      const uploadedMedia = this.loadFromLocalStorage<Array<{ id: string; name: string; uploadedAt: string; cloudProvider?: "cloudinary" | "nexus" | "bunny" | "planethoster"; url?: string; size?: number }>>(storageKey);
      if (uploadedMedia) {
        // Type assertion needed because localStorage might have old data with different types
        data.uploadedMedia = uploadedMedia.map(item => ({
          ...item,
          cloudProvider: (item.cloudProvider === "cloudinary" || item.cloudProvider === "nexus" || item.cloudProvider === "bunny" || item.cloudProvider === "planethoster") 
            ? item.cloudProvider 
            : undefined
        }));
      }
    } else {
      // Fallback to old key for backward compatibility
      const uploadedMedia = this.loadFromLocalStorage<Array<{ id: string; name: string; uploadedAt: string; cloudProvider?: "cloudinary" | "nexus" | "bunny" | "planethoster"; url?: string; size?: number }>>('nexus-uploaded-media');
      if (uploadedMedia) {
        data.uploadedMedia = uploadedMedia.map(item => ({
          ...item,
          cloudProvider: (item.cloudProvider === "cloudinary" || item.cloudProvider === "nexus" || item.cloudProvider === "bunny" || item.cloudProvider === "planethoster") 
            ? item.cloudProvider 
            : undefined
        }));
      }
    }

    const cloudinaryConfig = this.loadFromLocalStorage<any>('nexus-cloudinary-config');
    if (cloudinaryConfig) data.cloudinaryConfig = cloudinaryConfig;

    const equalizerPresets = this.loadFromLocalStorage<EqualizerPreset[]>('nexus-equalizer-presets');
    if (equalizerPresets) data.equalizerPresets = equalizerPresets;

    const scrobblerSettings = this.loadFromLocalStorage<any>('nexus-scrobbler-settings');
    if (scrobblerSettings) data.scrobblerSettings = scrobblerSettings;

    return data;
  }

  // Calculate hash for change detection
  private calculateDataHash(data: Partial<UserAppData>): string {
    // Create a simplified version for hashing (exclude metadata fields)
    const hashableData = {
      settings: data.settings,
      favorites: data.favorites,
      history: data.history,
      theme: data.theme,
      notificationsEnabled: data.notificationsEnabled,
      volume: data.volume,
      searchHistory: data.searchHistory,
      uploadedMedia: data.uploadedMedia,
      cloudinaryConfig: data.cloudinaryConfig,
      equalizerPresets: data.equalizerPresets,
      scrobblerSettings: data.scrobblerSettings,
    };
    
    // Simple hash using JSON stringify (for change detection)
    return JSON.stringify(hashableData);
  }

  // Start periodic sync (every hour)
  private startPeriodicSync(userId: string): void {
    // Clear existing interval if any
    if (this.periodicSyncInterval) {
      clearInterval(this.periodicSyncInterval);
    }

    this.periodicSyncInterval = setInterval(async () => {
      if (!this.currentUserId || this.isSyncing) {
        return;
      }

      try {
        // Silent periodic sync check
        const currentData = await this.getCurrentLocalData();
        const newHash = this.calculateDataHash(currentData);

        // Only sync if there are pending changes or data has changed
        if (this.pendingChanges.size > 0 || newHash !== this.lastSyncedDataHash) {
          // Silent periodic sync - only sync if needed
          await this.saveToFirestore(userId);
        }
      } catch (error) {
        console.error('Error during periodic sync:', error);
      }
    }, this.syncIntervalMs);

    // Silent - no console log for periodic sync start
  }

  // Stop periodic sync
  private stopPeriodicSync(): void {
    if (this.periodicSyncInterval) {
      clearInterval(this.periodicSyncInterval);
      this.periodicSyncInterval = null;
    }
  }

  // Merge Firestore data with local data (conflict resolution)
  private async mergeWithLocal(firestoreData: UserAppData): Promise<void> {
    // For now, Firestore data takes priority on first load
    // In the future, we could implement more sophisticated conflict resolution
    // (e.g., last-write-wins, or merge based on timestamps)
    
    await this.handleRemoteUpdate(firestoreData);
  }

  // Queue a sync operation (with debounce and change detection)
  queueSync(type: string, data: any): void {
    // Save locally immediately
    const dataMap: Record<string, any> = { [type]: data };
    this.saveDataLocally(dataMap as Partial<UserAppData>);
    
    // Mark as pending change
    this.pendingChanges.add(type);

    // Clear existing debounce timer
    if (this.changeDetectionDebounce) {
      clearTimeout(this.changeDetectionDebounce);
    }

    // Debounce sync to Firestore (only sync if changes persist after delay)
    this.changeDetectionDebounce = setTimeout(async () => {
      if (!this.currentUserId) {
        return;
      }

      try {
        // Check if data actually changed before syncing
        const currentData = await this.getCurrentLocalData();
        const newHash = this.calculateDataHash(currentData);

        if (newHash !== this.lastSyncedDataHash) {
          // Silent sync - no console log
          await this.saveToFirestore(this.currentUserId, { [type]: data } as Partial<UserAppData>);
        } else {
          // Silent - no changes
          this.pendingChanges.delete(type);
        }
      } catch (error) {
        console.error(`Error syncing ${type}:`, error);
        // Will be retried in periodic sync
      }
    }, this.changeDetectionDelay);
  }

  // Process sync queue
  private async processSyncQueue(): Promise<void> {
    if (this.isSyncing || !this.currentUserId || this.syncQueue.length === 0) {
      return;
    }

    const item = this.syncQueue.shift();
    if (!item) return;

    try {
      switch (item.type) {
        case 'settings':
          await this.saveToFirestore(this.currentUserId, { settings: item.data });
          break;
        case 'favorites':
          await this.saveToFirestore(this.currentUserId, { favorites: item.data });
          break;
        case 'history':
          await this.saveToFirestore(this.currentUserId, { history: item.data });
          break;
        case 'theme':
          await this.saveToFirestore(this.currentUserId, { theme: item.data });
          break;
        case 'notifications':
          await this.saveToFirestore(this.currentUserId, { notificationsEnabled: item.data });
          break;
        case 'volume':
          await this.saveToFirestore(this.currentUserId, { volume: item.data });
          break;
        case 'searchHistory':
          await this.saveToFirestore(this.currentUserId, { searchHistory: item.data });
          break;
        case 'uploadedMedia':
          await this.saveToFirestore(this.currentUserId, { uploadedMedia: item.data });
          break;
        case 'cloudinary':
          await this.saveToFirestore(this.currentUserId, { cloudinaryConfig: item.data });
          break;
        case 'equalizer':
          await this.saveToFirestore(this.currentUserId, { equalizerPresets: item.data });
          break;
        case 'scrobbler':
          await this.saveToFirestore(this.currentUserId, { scrobblerSettings: item.data });
          break;
        case 'playlists':
          await this.savePlaylistsToFirestore(this.currentUserId, item.data);
          break;
      }
    } catch (error) {
      console.error(`Error syncing ${item.type}:`, error);
      // Re-queue on error
      this.syncQueue.unshift(item);
    }

    // Process next item
    if (this.syncQueue.length > 0) {
      setTimeout(() => this.processSyncQueue(), 100);
    }
  }

  // Helper methods for localStorage
  private saveToLocalStorage<T>(key: string, value: T): void {
    try {
      // For string values (like theme), save as plain string to match useTheme.ts behavior
      // For complex objects, save as JSON
      if (typeof value === 'string') {
        localStorage.setItem(key, value);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.error(`Error saving to localStorage (${key}):`, error);
    }
  }

  private loadFromLocalStorage<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;
      
      // Try to parse as JSON first
      try {
        return JSON.parse(item) as T;
      } catch {
        // If parsing fails, it might be a plain string (like "dark" for theme)
        // Return it as-is if it's a string value
        return item as unknown as T;
      }
    } catch (error) {
      console.error(`Error loading from localStorage (${key}):`, error);
      return null;
    }
  }

  // Cleanup listeners
  cleanup(): void {
    this.syncListeners.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {
        console.error('Error unsubscribing listener:', error);
      }
    });
    this.syncListeners.clear();
    this.reconnectAttempts.clear();
    this.stopPeriodicSync();
    
    if (this.changeDetectionDebounce) {
      clearTimeout(this.changeDetectionDebounce);
      this.changeDetectionDebounce = null;
    }
    
    this.currentUserId = null;
    this.lastSyncedDataHash = null;
    this.pendingChanges.clear();
  }

  // Get sync status
  getSyncStatus(): { isSyncing: boolean; queueLength: number } {
    return {
      isSyncing: this.isSyncing,
      queueLength: this.syncQueue.length,
    };
  }

  // Force an immediate sync to Firestore
  async forceSyncNow(): Promise<void> {
    if (!this.currentUserId || !db) {
      console.warn('Cannot force sync: no user ID or Firestore not initialized');
      return;
    }

    try {
      // Save all local data to Firestore
      await this.saveToFirestore(this.currentUserId);
      console.log('Force sync completed successfully');
    } catch (error) {
      console.error('Force sync failed:', error);
      throw error;
    }
  }
}

export const firebaseSyncService = new FirebaseSyncService();

