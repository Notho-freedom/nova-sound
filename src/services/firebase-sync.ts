import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { firebaseApp } from './firebase';
import type { 
  Settings, 
  Playlist, 
  EqualizerPreset,
  HistoryEntry 
} from '../types/music';

let db: ReturnType<typeof getFirestore> | null = null;

// Initialize Firestore
try {
  db = getFirestore(firebaseApp);
} catch (error) {
  console.error('Error initializing Firestore for sync:', error);
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
  theme?: 'dark' | 'light' | 'system';
  
  // Notifications enabled
  notificationsEnabled?: boolean;
  
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

  // Initialize sync for a user
  async initializeSync(userId: string): Promise<void> {
    if (!db) {
      console.warn('Firestore not initialized, cannot sync');
      return;
    }

    if (this.currentUserId === userId) {
      return; // Already initialized
    }

    // Clean up previous listeners
    this.cleanup();

    this.currentUserId = userId;
    
    // Load initial data from Firestore
    await this.loadFromFirestore(userId);
    
    // Set up real-time listeners
    this.setupRealtimeListeners(userId);
    
    console.log(`✅ Firebase sync initialized for user: ${userId}`);
  }

  // Load all user data from Firestore
  private async loadFromFirestore(userId: string): Promise<void> {
    if (!db) return;
    
    try {
      const userDataRef = doc(db, 'users', userId, 'appData', 'data');
      const userDataSnap = await getDoc(userDataRef);

      if (userDataSnap.exists()) {
        const data = userDataSnap.data() as UserAppData;
        
        // Merge with local data (Firestore takes priority for first load)
        await this.mergeWithLocal(data);
        
        console.log('📥 User data loaded from Firestore');
      } else {
        // No Firestore data, save local data to Firestore
        await this.saveToFirestore(userId);
        console.log('💾 Local data saved to Firestore (first time)');
      }
    } catch (error) {
      console.error('Error loading from Firestore:', error);
    }
  }

  // Set up real-time listeners for continuous sync
  private setupRealtimeListeners(userId: string): void {
    if (!db) return;
    
    // Main app data listener
    const appDataRef = doc(db, 'users', userId, 'appData', 'data');
    const unsubscribeAppData = onSnapshot(
      appDataRef,
      (snapshot) => {
        if (snapshot.exists() && !this.isSyncing) {
          const data = snapshot.data() as UserAppData;
          this.handleRemoteUpdate(data);
        }
      },
      (error) => {
        console.error('Error in app data listener:', error);
      }
    );
    this.syncListeners.set('appData', unsubscribeAppData);

    // Playlists subcollection listener
    const playlistsRef = collection(db!, 'users', userId, 'playlists');
    const unsubscribePlaylists = onSnapshot(
      playlistsRef,
      (snapshot) => {
        if (!this.isSyncing) {
          const playlists: Playlist[] = [];
          snapshot.forEach((doc) => {
            playlists.push({ id: doc.id, ...doc.data() } as Playlist);
          });
          this.handlePlaylistsUpdate(playlists);
        }
      },
      (error) => {
        console.error('Error in playlists listener:', error);
      }
    );
    this.syncListeners.set('playlists', unsubscribePlaylists);
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

      if (data.cloudinaryConfig) {
        this.saveToLocalStorage('nexus-cloudinary-config', data.cloudinaryConfig);
      }

      if (data.equalizerPresets) {
        this.saveToLocalStorage('nexus-equalizer-presets', data.equalizerPresets);
      }

      if (data.scrobblerSettings) {
        this.saveToLocalStorage('nexus-scrobbler-settings', data.scrobblerSettings);
      }

      // Dispatch custom events for UI updates
      window.dispatchEvent(new CustomEvent('firebase-sync-update', { detail: data }));
      
      console.log('🔄 Remote data synced to local storage');
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
      
      console.log('🔄 Playlists synced from Firestore');
    } catch (error) {
      console.error('Error handling playlists update:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  // Save data to Firestore
  async saveToFirestore(userId: string, data?: Partial<UserAppData>): Promise<void> {
    if (!db || !userId) {
      console.warn('Cannot save to Firestore: no user ID or Firestore not initialized');
      return;
    }

    this.isSyncing = true;

    try {
      const userDataRef = doc(db, 'users', userId, 'appData', 'data');
      const currentData = await this.getCurrentLocalData();
      
      // Merge with provided data
      const dataToSave: UserAppData = {
        ...currentData,
        ...data,
        lastSyncAt: new Date().toISOString(),
        version: (currentData.version || 0) + 1,
      };

      await setDoc(userDataRef, dataToSave, { merge: true });
      
      console.log('💾 Data saved to Firestore');
    } catch (error) {
      console.error('Error saving to Firestore:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  // Save playlists to Firestore
  async savePlaylistsToFirestore(userId: string, playlists: Playlist[]): Promise<void> {
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
        const playlistRef = doc(db!, 'users', userId, 'playlists', playlist.id);
        await setDoc(playlistRef, {
          ...playlist,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      // Delete playlists that no longer exist locally
      const localIds = new Set(playlists.map(p => p.id));
      existingSnap.forEach((docSnap) => {
        if (!localIds.has(docSnap.id)) {
          docSnap.ref.delete();
        }
      });

      console.log('💾 Playlists saved to Firestore');
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

    const theme = this.loadFromLocalStorage<'dark' | 'light' | 'system'>('nexus-theme');
    if (theme) data.theme = theme;

    const notificationsEnabled = this.loadFromLocalStorage<boolean>('nexus-notifications-enabled');
    if (notificationsEnabled !== null) data.notificationsEnabled = notificationsEnabled;

    const cloudinaryConfig = this.loadFromLocalStorage<any>('nexus-cloudinary-config');
    if (cloudinaryConfig) data.cloudinaryConfig = cloudinaryConfig;

    const equalizerPresets = this.loadFromLocalStorage<EqualizerPreset[]>('nexus-equalizer-presets');
    if (equalizerPresets) data.equalizerPresets = equalizerPresets;

    const scrobblerSettings = this.loadFromLocalStorage<any>('nexus-scrobbler-settings');
    if (scrobblerSettings) data.scrobblerSettings = scrobblerSettings;

    return data;
  }

  // Merge Firestore data with local data (conflict resolution)
  private async mergeWithLocal(firestoreData: UserAppData): Promise<void> {
    // For now, Firestore data takes priority on first load
    // In the future, we could implement more sophisticated conflict resolution
    // (e.g., last-write-wins, or merge based on timestamps)
    
    await this.handleRemoteUpdate(firestoreData);
  }

  // Queue a sync operation
  queueSync(type: string, data: any): void {
    this.syncQueue.push({ type, data });
    this.processSyncQueue();
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
    this.syncListeners.forEach((unsubscribe) => unsubscribe());
    this.syncListeners.clear();
    this.currentUserId = null;
  }

  // Get sync status
  getSyncStatus(): { isSyncing: boolean; queueLength: number } {
    return {
      isSyncing: this.isSyncing,
      queueLength: this.syncQueue.length,
    };
  }
}

export const firebaseSyncService = new FirebaseSyncService();

