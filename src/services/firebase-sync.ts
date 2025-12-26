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
  Firestore,
  writeBatch,
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
  
  // YouTube API key (stored securely)
  youtubeApiKey?: string;
  
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
  private realtimeListenersEnabled: boolean = false; // Désactivé par défaut
  private initialLoadComplete: boolean = false;
  
  // Backup system
  private lastBackupTime: number = 0;
  private backupInterval: NodeJS.Timeout | null = null;
  private backupIntervalMs: number = 60 * 60 * 1000; // 1 heure
  private lastBackupDataHash: string | null = null;
  
  async initializeSync(userId: string): Promise<void> {
    // Validate that userId is a Firebase Auth UID (28 characters, no @, no user_ prefix)
    // This prevents using old Google UIDs that don't work with Firestore rules
    const isFirebaseUid = userId && userId.length === 28 && !userId.includes('@') && !userId.includes('user_');
    if (!isFirebaseUid) {
      console.error(`❌ Cannot initialize Firebase sync: Invalid UID format. Expected Firebase Auth UID (28 chars), got: ${userId}`);
      throw new Error(`Invalid Firebase Auth UID format: ${userId}`);
    }
    // Ensure Firebase is initialized first (non-bloquant)
    const { firebaseService } = await import('./firebase');
    await firebaseService.ensureInitialized();
    
    const db = getFirestoreInstance();
    if (!db) {
      console.warn('🔄 Firestore not initialized, waiting for Firebase...');
      // Try to wait for Firebase to be ready
      const firebase = await waitForFirebase();
      if (!firebase || !firebase.db) {
        console.warn('⚠️ Firebase not available, sync disabled');
        return;
      }
      // Retry getting Firestore instance after wait
      const retryDb = getFirestoreInstance();
      if (!retryDb) {
        console.warn('⚠️ Firestore still not available after wait, sync disabled');
        return;
      }
    }

    // Empêcher l'initialisation multiple
    if (this.isInitialized && this.currentUserId === userId) {
      console.log('⏳ FirebaseSync: Déjà initialisé pour cet utilisateur, ignoré');
      return; // Déjà initialisé pour cet utilisateur
    }

    // Prevent concurrent initialization
    if (this.isInitializing) {
      console.log('⏳ FirebaseSync: Initialisation déjà en cours, ignoré');
      return; // Silent - already initializing
    }

    if (this.currentUserId === userId && this.syncListeners.size > 0) {
      console.log('⏳ FirebaseSync: Sync déjà active pour cet utilisateur, ignoré');
      return; // Silent - already initialized
    }

    this.isInitializing = true;

    try {
      // Clean up previous listeners
      this.cleanup();

      this.currentUserId = userId;
      
      // Différer la migration pour ne pas bloquer l'initialisation
      // (opération non-critique qui peut être faite en arrière-plan)
      setTimeout(async () => {
        try {
          const { migrateToUserIsolatedStorage } = await import('../lib/storage-utils');
          await migrateToUserIsolatedStorage();
        } catch (error) {
          console.error('Failed to migrate to user-isolated storage:', error);
        }
      }, 1000);
      
      // NOUVEAU SYSTÈME: Charger les données depuis Firebase une seule fois au login
      // Les listeners temps réel sont désactivés pour éviter d'écraser les changements locaux
      console.log('🔄 Initial load: Fetching backup from Firebase...');
      await this.loadInitialDataFromFirebase(userId);
      
      // Différer la synchronisation périodique
      // Cette opération synchronise Local → Firebase
      const deferredInit = async () => {
        try {
          // Sauvegarder les données locales vers Firebase comme backup
          console.log('💾 Syncing local data to Firebase as backup...');
          await this.saveToFirestore(userId);
          
          // Calculate initial hash for change detection
          const initialData = await this.getCurrentLocalData();
          this.lastSyncedDataHash = this.calculateDataHash(initialData);
        } catch (error) {
          console.error('Error during deferred sync initialization:', error);
        }
      };

      // Utiliser requestIdleCallback pour différer les opérations non-critiques
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => deferredInit(), { timeout: 3000 });
      } else {
        setTimeout(deferredInit, 500);
      }
      
      // Start periodic sync (every hour) - différé
      setTimeout(() => this.startPeriodicSync(userId), 2000);
      
      // Only log on first initialization, not on every call
      if (!this.syncListeners.has('appData')) {
        console.log(`✅ Firebase sync initialized for user: ${userId}`);
      }
      
      this.isInitialized = true;
      
      // Verify sync is working by checking listeners
      if (this.syncListeners.size === 0) {
        console.warn('⚠️ Firebase sync initialized but no listeners were set up');
      } else {
        console.log(`✅ Firebase sync active with ${this.syncListeners.size} listener(s):`, Array.from(this.syncListeners.keys()));
      }
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

  // Chargement initial des données depuis Firebase (backup/restore au login uniquement)
  private async loadInitialDataFromFirebase(userId: string): Promise<void> {
    const db = getFirestoreInstance();
    if (!db) {
      console.error('Firestore instance not available');
      return;
    }

    try {
      this.isSyncing = true; // Empêche les interférences pendant le chargement
      
      // Charger les données principales
      const appDataRef = doc(db, 'users', userId, 'appData', 'data');
      const appDataSnap = await getDoc(appDataRef);
      
      if (appDataSnap.exists()) {
        const firebaseData = appDataSnap.data() as UserAppData;
        console.log('📥 Initial load: Found backup data in Firebase');
        
        // Merger intelligemment avec les données locales
        await this.mergeFirebaseWithLocal(firebaseData);
      } else {
        console.log('📥 Initial load: No backup in Firebase yet');
      }

      // Charger les playlists
      const playlistsRef = collection(db, 'users', userId, 'playlists');
      const playlistsSnap = await getDocs(playlistsRef);
      
      if (!playlistsSnap.empty) {
        const playlists: Playlist[] = [];
        playlistsSnap.forEach((doc) => {
          playlists.push({ id: doc.id, ...doc.data() } as Playlist);
        });
        console.log(`📥 Initial load: Found ${playlists.length} playlists in Firebase`);
        
        // Merger avec les playlists locales
        await this.mergePlaylistsWithLocal(playlists);
      }

      this.initialLoadComplete = true;
      console.log('✅ Initial load complete. Local is now source of truth.');
      
      // Démarrer le système de backup automatique
      this.startAutomaticBackup(userId);
      
    } catch (error) {
      console.error('Error loading initial data from Firebase:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  // Système de backup automatique
  private startAutomaticBackup(userId: string): void {
    // Arrêter le backup précédent si existant
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }
    
    console.log('🕐 Starting automatic backup system (every 1 hour if data changed)');
    
    // Créer un backup initial
    setTimeout(() => {
      this.createBackupIfNeeded(userId);
    }, 5000); // Premier backup après 5 secondes
    
    // Backup périodique
    this.backupInterval = setInterval(async () => {
      await this.createBackupIfNeeded(userId);
    }, this.backupIntervalMs);
  }

  // Créer un backup uniquement si les données ont changé
  private async createBackupIfNeeded(userId: string): Promise<void> {
    const db = getFirestoreInstance();
    if (!db) return;
    
    try {
      // Récupérer les données actuelles
      const currentData = await this.getCurrentLocalData();
      const currentHash = this.calculateDataHash(currentData);
      
      // Vérifier si les données ont changé depuis le dernier backup
      if (currentHash === this.lastBackupDataHash) {
        console.log('ℹ️ Backup skipped: No changes detected');
        return;
      }
      
      // Créer le backup avec timestamp
      const timestamp = Date.now();
      const backupId = `backup_appdata_${timestamp}`;
      
      const backupRef = doc(db, 'users', userId, 'backups', backupId);
      await setDoc(backupRef, {
        ...currentData,
        backupCreatedAt: new Date().toISOString(),
        backupTimestamp: timestamp,
        version: currentData.version || 1
      });
      
      this.lastBackupDataHash = currentHash;
      this.lastBackupTime = timestamp;
      
      console.log(`💾 Backup created: ${backupId}`);
      
      // Nettoyer les vieux backups (garder seulement les 10 derniers)
      await this.cleanupOldBackups(userId);
      
    } catch (error) {
      console.error('Error creating backup:', error);
    }
  }

  // Nettoyer les anciens backups (garder les 10 plus récents)
  private async cleanupOldBackups(userId: string): Promise<void> {
    const db = getFirestoreInstance();
    if (!db) return;
    
    try {
      const backupsRef = collection(db, 'users', userId, 'backups');
      const backupsSnap = await getDocs(backupsRef);
      
      if (backupsSnap.size <= 10) return; // Garder au moins 10 backups
      
      // Trier par timestamp (du plus ancien au plus récent)
      const backups = backupsSnap.docs
        .map(doc => ({ id: doc.id, timestamp: doc.data().backupTimestamp || 0 }))
        .sort((a, b) => a.timestamp - b.timestamp);
      
      // Supprimer les plus anciens (garder les 10 derniers)
      const toDelete = backups.slice(0, backups.length - 10);
      
      for (const backup of toDelete) {
        const backupDoc = doc(db, 'users', userId, 'backups', backup.id);
        await deleteDoc(backupDoc);
      }
      
      if (toDelete.length > 0) {
        console.log(`🗑️ Cleaned up ${toDelete.length} old backup(s)`);
      }
    } catch (error) {
      console.error('Error cleaning up old backups:', error);
    }
  }

  // Restaurer depuis un backup spécifique
  async restoreFromBackup(userId: string, backupId: string): Promise<boolean> {
    const db = getFirestoreInstance();
    if (!db) return false;
    
    try {
      const backupRef = doc(db, 'users', userId, 'backups', backupId);
      const backupSnap = await getDoc(backupRef);
      
      if (!backupSnap.exists()) {
        console.error('Backup not found:', backupId);
        return false;
      }
      
      const backupData = backupSnap.data() as UserAppData;
      await this.mergeFirebaseWithLocal(backupData);
      
      console.log(`✅ Restored from backup: ${backupId}`);
      return true;
    } catch (error) {
      console.error('Error restoring from backup:', error);
      return false;
    }
  }

  // Lister les backups disponibles
  async listBackups(userId: string): Promise<Array<{ id: string; timestamp: number; date: string }>> {
    const db = getFirestoreInstance();
    if (!db) return [];
    
    try {
      const backupsRef = collection(db, 'users', userId, 'backups');
      const backupsSnap = await getDocs(backupsRef);
      
      return backupsSnap.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            timestamp: data.backupTimestamp || 0,
            date: data.backupCreatedAt || 'Unknown'
          };
        })
        .sort((a, b) => b.timestamp - a.timestamp); // Plus récent en premier
    } catch (error) {
      console.error('Error listing backups:', error);
      return [];
    }
  }

  // Comparaison intelligente de valeurs
  // Retourne: 'keep-local' | 'use-firebase' | 'merge' | 'no-change'
  private intelligentCompare(local: any, firebase: any, type: 'object' | 'array' | 'primitive'): string {
    // Cas 1: Firebase a une valeur, local est null/undefined/vide
    const localIsEmpty = local === null || local === undefined || 
      (Array.isArray(local) && local.length === 0) ||
      (typeof local === 'object' && !Array.isArray(local) && Object.keys(local).length === 0);
    
    const firebaseIsEmpty = firebase === null || firebase === undefined ||
      (Array.isArray(firebase) && firebase.length === 0) ||
      (typeof firebase === 'object' && !Array.isArray(firebase) && Object.keys(firebase).length === 0);
    
    if (localIsEmpty && !firebaseIsEmpty) {
      return 'use-firebase'; // Firebase a des données, local est vide → restaurer
    }
    
    if (!localIsEmpty && firebaseIsEmpty) {
      return 'keep-local'; // Local a des données, Firebase est vide → garder local
    }
    
    if (localIsEmpty && firebaseIsEmpty) {
      return 'no-change'; // Les deux sont vides → rien à faire
    }
    
    // Cas 2: Les deux ont des valeurs → comparer
    if (type === 'array') {
      // Pour les arrays (favoris, history), on merge (union)
      return 'merge';
    }
    
    if (type === 'object') {
      // Pour les objets, comparer JSON
      const localStr = JSON.stringify(local);
      const firebaseStr = JSON.stringify(firebase);
      return localStr === firebaseStr ? 'no-change' : 'keep-local';
    }
    
    // Cas 3: Valeurs primitives
    return local === firebase ? 'no-change' : 'keep-local';
  }

  // Merger intelligemment les données Firebase avec le local
  // RÈGLE: Comparaison intelligente pour chaque champ
  private async mergeFirebaseWithLocal(firebaseData: UserAppData): Promise<void> {
    console.log('🔄 Intelligent merge: Comparing Firebase backup with local data...');
    
    const localData = await this.getCurrentLocalData();
    let changesApplied = 0;
    
    // Settings
    const settingsAction = this.intelligentCompare(localData.settings, firebaseData.settings, 'object');
    if (settingsAction === 'use-firebase') {
      console.log('📥 Settings: Local empty → Restoring from Firebase');
      this.saveToLocalStorage('nexus-settings', firebaseData.settings);
      changesApplied++;
    } else if (settingsAction === 'no-change') {
      console.log('✓ Settings: Identical, no change needed');
    } else {
      console.log('✓ Settings: Keeping local (has value)');
    }
    
    // Favorites (merge = union)
    const favoritesAction = this.intelligentCompare(localData.favorites, firebaseData.favorites, 'array');
    if (favoritesAction === 'use-firebase') {
      console.log('📥 Favorites: Local empty → Restoring from Firebase');
      this.saveToLocalStorage('nexus-favorites', firebaseData.favorites);
      window.dispatchEvent(new CustomEvent('favorites-updated'));
      changesApplied++;
    } else if (favoritesAction === 'merge') {
      const localFavorites = localData.favorites || [];
      const firebaseFavorites = firebaseData.favorites || [];
      const merged = [...new Set([...localFavorites, ...firebaseFavorites])];
      if (merged.length > localFavorites.length) {
        console.log(`📥 Favorites: Merging ${localFavorites.length} local + ${firebaseFavorites.length} Firebase = ${merged.length} total`);
        this.saveToLocalStorage('nexus-favorites', merged);
        window.dispatchEvent(new CustomEvent('favorites-updated'));
        changesApplied++;
      } else {
        console.log('✓ Favorites: No new items to merge');
      }
    }
    
    // History
    const historyAction = this.intelligentCompare(localData.history, firebaseData.history, 'array');
    if (historyAction === 'use-firebase') {
      console.log(`📥 History: Local empty → Restoring ${firebaseData.history?.length || 0} entries from Firebase`);
      this.saveToLocalStorage('nexus-play-history', firebaseData.history);
      window.dispatchEvent(new CustomEvent('firebase-history-update', { detail: { history: firebaseData.history } }));
      changesApplied++;
    } else {
      console.log('✓ History: Keeping local');
    }
    
    // Theme & Volume: TOUJOURS garder local (préférences actuelles)
    console.log('✓ Theme & Volume: Keeping local (user preferences)');
    
    // Cloudinary Config
    const cloudinaryAction = this.intelligentCompare(localData.cloudinaryConfig, firebaseData.cloudinaryConfig, 'object');
    if (cloudinaryAction === 'use-firebase') {
      console.log('📥 Cloudinary: Local empty → Restoring from Firebase');
      this.saveToLocalStorage('nexus-cloudinary-config', firebaseData.cloudinaryConfig);
      changesApplied++;
    } else if (cloudinaryAction === 'no-change') {
      console.log('✓ Cloudinary: Identical configuration');
    } else {
      console.log('✓ Cloudinary: Keeping local configuration');
    }
    
    // Equalizer Presets
    const equalizerAction = this.intelligentCompare(localData.equalizerPresets, firebaseData.equalizerPresets, 'array');
    if (equalizerAction === 'use-firebase') {
      console.log('📥 Equalizer: Local empty → Restoring from Firebase');
      this.saveToLocalStorage('nexus-equalizer-presets', firebaseData.equalizerPresets);
      changesApplied++;
    } else {
      console.log('✓ Equalizer: Keeping local presets');
    }
    
    // Uploaded Media
    const mediaAction = this.intelligentCompare(localData.uploadedMedia, firebaseData.uploadedMedia, 'array');
    if (mediaAction === 'use-firebase') {
      console.log('📥 Uploaded Media: Local empty → Restoring from Firebase');
      if (this.currentUserId) {
        const storageKey = getUserStorageKeySync('nexus-uploaded-media', this.currentUserId);
        this.saveToLocalStorage(storageKey, firebaseData.uploadedMedia);
      }
      changesApplied++;
    }
    
    console.log(`✅ Intelligent merge complete: ${changesApplied} changes applied from Firebase backup.`);
  }

  // Merger les playlists Firebase avec le local
  private async mergePlaylistsWithLocal(firebasePlaylists: Playlist[]): Promise<void> {
    const localPlaylists = this.loadFromLocalStorage<Playlist[]>('nexus-playlists') || [];
    
    // Merger par ID (garder les versions locales en priorité)
    const merged = new Map<string, Playlist>();
    
    // D'abord ajouter les playlists Firebase
    firebasePlaylists.forEach(p => merged.set(p.id, p));
    
    // Puis écraser avec les versions locales (priorité au local)
    localPlaylists.forEach(p => merged.set(p.id, p));
    
    const result = Array.from(merged.values());
    
    if (result.length > localPlaylists.length) {
      console.log(`📥 Merged playlists: ${localPlaylists.length} local + ${firebasePlaylists.length} Firebase = ${result.length} total`);
      this.saveToLocalStorage('nexus-playlists', result);
      window.dispatchEvent(new CustomEvent('playlists-updated'));
    }
  }

  // Set up real-time listeners for continuous sync (DÉSACTIVÉ PAR DÉFAUT)
  // Les listeners temps réel sont désactivés pour éviter d'écraser les changements locaux
  // La synchronisation se fait maintenant: Local → Firebase uniquement
  private setupRealtimeListeners(userId: string): void {
    // DÉSACTIVÉ: Les listeners temps réel écrasent les changements locaux
    // On utilise maintenant un système de chargement initial + sync unidirectionnel (Local → Firebase)
    if (!this.realtimeListenersEnabled) {
      console.log('ℹ️ Real-time listeners DISABLED. Local is source of truth.');
      console.log('💾 Sync direction: Local → Firebase (backup mode)');
      return;
    }
    
    // Le code ci-dessous n'est exécuté que si explicitement activé (pour debug/tests)
    console.warn('⚠️ Real-time listeners ENABLED. This may overwrite local changes!');
    
    const db = getFirestoreInstance();
    if (!db) {
      console.warn('⚠️ Cannot setup real-time listeners: Firestore not initialized');
      return;
    }
    
    console.log(`🔄 Setting up real-time listeners for user: ${userId}`);
    
    // Reset reconnect attempts for this user
    this.reconnectAttempts.set('appData', 0);
    this.reconnectAttempts.set('playlists', 0);
    
    // Main app data listener (optimisé: ignore metadata changes pour performance)
    const appDataRef = doc(db, 'users', userId, 'appData', 'data');
    const unsubscribeAppData = onSnapshot(
      appDataRef,
      {
        includeMetadataChanges: false, // Ignorer les changements de métadonnées (optimisation performance)
      },
      (snapshot) => {
        // Reset reconnect attempts on successful connection
        this.reconnectAttempts.set('appData', 0);
        
        if (snapshot.exists() && !this.isSyncing) {
          const data = snapshot.data() as UserAppData;
          console.log('📥 Firebase sync: Received app data update from Firestore');
          this.handleRemoteUpdate(data);
        } else if (!snapshot.exists()) {
          console.log('📥 Firebase sync: No app data in Firestore yet, will save local data on next sync');
        }
      },
      (error) => {
        // Only log actual errors, not normal connection issues
        if (error.code !== 'unavailable' && error.code !== 'cancelled') {
          console.error('❌ Error in app data listener:', error);
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
    console.log('✅ App data listener set up and active');

    // Playlists subcollection listener (optimisé: ignore metadata changes pour performance)
    if (!this.syncListeners.has('playlists')) {
      const playlistsRef = collection(db, 'users', userId, 'playlists');
      const unsubscribePlaylists = onSnapshot(
        playlistsRef,
        {
          includeMetadataChanges: false, // Ignorer les changements de métadonnées (optimisation performance)
        },
        (snapshot) => {
          // Reset reconnect attempts on successful connection
          this.reconnectAttempts.set('playlists', 0);
          
          if (!this.isSyncing) {
            const playlists: Playlist[] = [];
            snapshot.forEach((doc) => {
              playlists.push({ id: doc.id, ...doc.data() } as Playlist);
            });
            console.log(`📥 Firebase sync: Received playlists update (${snapshot.docChanges().length} changes, ${playlists.length} total)`);
            this.handlePlaylistsUpdate(playlists);
          }
        },
        (error) => {
          // Only log actual errors, not normal connection issues
          if (error.code !== 'unavailable' && error.code !== 'cancelled') {
            console.error('❌ Error in playlists listener:', error);
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
      console.log('✅ Playlists listener set up and active');
    } else {
      console.log('ℹ️ Playlists listener already exists, skipping');
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
  // Optimisé: opérations non-bloquantes via queueMicrotask
  private async handleRemoteUpdate(data: UserAppData): Promise<void> {
    this.isSyncing = true;
    
    try {
      // Batch all localStorage operations to minimize main thread blocking
      // Use queueMicrotask to yield to the browser between operations
      const saveOperations: Array<() => void> = [];
      
      if (data.settings) {
        saveOperations.push(() => this.saveToLocalStorage('nexus-settings', data.settings));
      }

      if (data.favorites) {
        saveOperations.push(() => this.saveToLocalStorage('nexus-favorites', data.favorites));
      }

      if (data.history && Array.isArray(data.history) && data.history.length > 0) {
        console.log('[FirebaseSync] Mise à jour historique depuis Firebase:', data.history.length, 'entrées');
        saveOperations.push(() => {
          this.saveToLocalStorage('nexus-play-history', data.history);
          window.dispatchEvent(new CustomEvent('firebase-history-update', { 
            detail: { history: data.history } 
          }));
        });
      } else if (data.history && Array.isArray(data.history) && data.history.length === 0) {
        saveOperations.push(() => {
          this.saveToLocalStorage('nexus-play-history', data.history);
          window.dispatchEvent(new CustomEvent('firebase-history-update', { 
            detail: { history: data.history } 
          }));
        });
      }

      // Only save theme if it matches the current local theme (don't override user's choice)
      if (data.theme) {
        const currentTheme = this.loadFromLocalStorage<string>('nexus-theme');
        if (!currentTheme || currentTheme === data.theme) {
          saveOperations.push(() => this.saveToLocalStorage('nexus-theme', data.theme));
        } else {
          console.log('[FirebaseSync] Skipping theme update: local theme', currentTheme, 'differs from Firebase theme', data.theme);
        }
      }

      if (data.notificationsEnabled !== undefined) {
        saveOperations.push(() => this.saveToLocalStorage('nexus-notifications-enabled', data.notificationsEnabled));
      }

      if (data.volume !== undefined) {
        saveOperations.push(() => this.saveToLocalStorage('nexus-volume', data.volume));
      }

      if (data.searchHistory) {
        saveOperations.push(() => this.saveToLocalStorage('nexus-search-history', data.searchHistory));
      }

      if (data.uploadedMedia && this.currentUserId) {
        const storageKey = getUserStorageKeySync('nexus-uploaded-media', this.currentUserId);
        saveOperations.push(() => this.saveToLocalStorage(storageKey, data.uploadedMedia));
      } else if (data.uploadedMedia) {
        saveOperations.push(() => this.saveToLocalStorage('nexus-uploaded-media', data.uploadedMedia));
      }

      if (data.cloudinaryConfig) {
        saveOperations.push(() => this.saveToLocalStorage('nexus-cloudinary-config', data.cloudinaryConfig));
      }

      if (data.equalizerPresets) {
        saveOperations.push(() => this.saveToLocalStorage('nexus-equalizer-presets', data.equalizerPresets));
      }

      if (data.scrobblerSettings) {
        saveOperations.push(() => this.saveToLocalStorage('nexus-scrobbler-settings', data.scrobblerSettings));
      }
      
      if (data.youtubeApiKey !== undefined) {
        saveOperations.push(() => {
          this.saveToLocalStorage('nexus-youtube-api-key', data.youtubeApiKey);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('youtube-api-key-updated', { detail: data.youtubeApiKey }));
          }
        });
      }

      // Exécuter les opérations de manière non-bloquante
      // Utiliser queueMicrotask pour céder au navigateur entre les opérations
      for (let i = 0; i < saveOperations.length; i++) {
        await new Promise<void>(resolve => {
          queueMicrotask(() => {
            saveOperations[i]();
            resolve();
          });
        });
      }

      // Trigger Electron storage update if available (en arrière-plan)
      if (window.electronAPI && data.settings) {
        // Différer les opérations Electron pour ne pas bloquer
        setTimeout(async () => {
          try {
            await window.electronAPI!.updateSettings(data.settings!);
          } catch (error) {
            console.warn('Error updating Electron settings:', error);
          }
        }, 0);
      }

      if (window.electronAPI && data.favorites) {
        // Différer les opérations Electron pour ne pas bloquer
        setTimeout(async () => {
          try {
            for (const trackId of data.favorites!) {
              await window.electronAPI!.addFavorite(trackId);
            }
          } catch (error) {
            console.warn('Error updating Electron favorites:', error);
          }
        }, 0);
      }

      // Update hash after remote update
      this.lastSyncedDataHash = this.calculateDataHash(data);

      // Dispatch custom events for UI updates (non-bloquant)
      queueMicrotask(() => {
        // Exclude theme from sync event if it differs from local theme to prevent override
        const currentTheme = this.loadFromLocalStorage<string>('nexus-theme');
        const eventData = { ...data };
        if (currentTheme && data.theme && currentTheme !== data.theme) {
          delete eventData.theme;
        }
        
        window.dispatchEvent(new CustomEvent('firebase-sync-update', { detail: eventData }));
        
        if (data.history && Array.isArray(data.history)) {
          window.dispatchEvent(new CustomEvent('firebase-history-update', { 
            detail: { history: data.history } 
          }));
        }
      });
      
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
    if (data.youtubeApiKey !== undefined) {
      this.saveToLocalStorage('nexus-youtube-api-key', data.youtubeApiKey);
    }
  }

  // Save playlists to Firestore (optimisé avec batch writes)
  async savePlaylistsToFirestore(userId: string, playlists: Playlist[]): Promise<void> {
    const db = getFirestoreInstance();
    if (!db || !userId) {
      console.warn('Cannot save playlists: no user ID or Firestore not initialized');
      return;
    }

    this.isSyncing = true;

    try {
      const playlistsRef = collection(db, 'users', userId, 'playlists');
      const existingSnap = await getDocs(playlistsRef);
      const existingIds = new Set(existingSnap.docs.map(doc => doc.id));
      
      // Utiliser batch writes pour performance maximale (max 500 opérations par batch)
      const batch = writeBatch(db);
      let batchCount = 0;
      const MAX_BATCH_SIZE = 500;
      
      // Update or create playlists avec batch writes (performance maximale)
      for (const playlist of playlists) {
        const playlistRef = doc(db, 'users', userId, 'playlists', playlist.id);
        batch.set(playlistRef, {
          ...playlist,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        batchCount++;
        
        // Commit batch si on atteint la limite (500 opérations max par batch)
        if (batchCount >= MAX_BATCH_SIZE) {
          await batch.commit();
          // Créer un nouveau batch pour les opérations suivantes
          const newBatch = writeBatch(db);
          Object.assign(batch, newBatch);
          batchCount = 0;
        }
      }

      // Delete playlists that no longer exist locally (avec batch)
      const localIds = new Set(playlists.map(p => p.id));
      for (const docSnap of existingSnap.docs) {
        if (!localIds.has(docSnap.id)) {
          batch.delete(docSnap.ref);
          batchCount++;
          
          // Commit batch si on atteint la limite
          if (batchCount >= MAX_BATCH_SIZE) {
            await batch.commit();
            const newBatch = writeBatch(db);
            Object.assign(batch, newBatch);
            batchCount = 0;
          }
        }
      }
      
      // Commit le batch final s'il reste des opérations
      if (batchCount > 0) {
        await batch.commit();
      }

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

    const youtubeApiKey = this.loadFromLocalStorage<string>('nexus-youtube-api-key');
    if (youtubeApiKey) data.youtubeApiKey = youtubeApiKey;

    return data;
  }

  // Calculate hash for change detection and backup comparison
  private calculateDataHash(data: Partial<UserAppData>): string {
    // Create a simplified version for hashing (exclude metadata fields)
    const hashableData = {
      settings: data.settings,
      favorites: data.favorites?.sort(), // Trier pour détecter les changements d'ordre
      history: data.history?.slice(0, 50), // Comparer seulement les 50 dernières entrées
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
    const str = JSON.stringify(hashableData);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  // Start periodic sync (every hour)
  private startPeriodicSync(userId: string): void {
    // Clear existing interval if any
    if (this.periodicSyncInterval) {
      clearInterval(this.periodicSyncInterval);
      console.log('🔄 Restarting periodic sync');
    } else {
      console.log('🔄 Starting periodic sync (every hour)');
    }

    this.periodicSyncInterval = setInterval(async () => {
      if (!this.currentUserId || this.isSyncing) {
        return;
      }
      
      console.log('🔄 Periodic sync triggered');

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
  // Non-blocking: toutes les opérations sont différées pour ne pas ralentir la navigation
  queueSync(type: string, data: any): void {
    // Utiliser requestIdleCallback ou setTimeout pour ne jamais bloquer l'UI
    const deferredOperation = () => {
      // Save locally immediately (synchrone mais très rapide)
      const dataMap: Record<string, any> = { [type]: data };
      this.saveDataLocally(dataMap as Partial<UserAppData>);
      
      // Mark as pending change
      this.pendingChanges.add(type);

      // Clear existing debounce timer
      if (this.changeDetectionDebounce) {
        clearTimeout(this.changeDetectionDebounce);
      }

      // Debounce sync to Firestore (only sync if changes persist after delay)
      // Utiliser un délai plus long pour éviter de bloquer la navigation
      this.changeDetectionDebounce = setTimeout(async () => {
        if (!this.currentUserId) {
          return;
        }

        // Différer l'opération Firestore via requestIdleCallback pour ne jamais bloquer
        const performSync = async () => {
          try {
            // Check if data actually changed before syncing
            const currentData = await this.getCurrentLocalData();
            const newHash = this.calculateDataHash(currentData);

            if (newHash !== this.lastSyncedDataHash) {
              // Silent sync - no console log
              await this.saveToFirestore(this.currentUserId!, { [type]: data } as Partial<UserAppData>);
            } else {
              // Silent - no changes
              this.pendingChanges.delete(type);
            }
          } catch (error) {
            console.error(`Error syncing ${type}:`, error);
            // Will be retried in periodic sync
          }
        };

        // Exécuter via requestIdleCallback si disponible, sinon setTimeout
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          (window as any).requestIdleCallback(() => performSync(), { timeout: 5000 });
        } else {
          setTimeout(performSync, 100);
        }
      }, this.changeDetectionDelay);
    };

    // Différer l'opération initiale pour ne pas bloquer la navigation
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(deferredOperation, { timeout: 1000 });
    } else {
      setTimeout(deferredOperation, 0);
    }
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
    console.log(`🔄 Cleaning up Firebase sync (${this.syncListeners.size} listeners)`);
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
    this.isInitialized = false;
    this.currentUserId = null;
    console.log('✅ Firebase sync cleanup complete');
    
    if (this.changeDetectionDebounce) {
      clearTimeout(this.changeDetectionDebounce);
      this.changeDetectionDebounce = null;
    }
    
    // Arrêter le backup automatique
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
    }
    
    this.currentUserId = null;
    this.lastSyncedDataHash = null;
    this.lastBackupDataHash = null;
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
    const db = getFirestoreInstance();
    if (!db) {
      console.warn('Cannot force sync: Firestore not initialized');
      return;
    }

    // Get user ID from Firebase if not set
    let userId = this.currentUserId;
    if (!userId) {
      const { firebaseService } = await import('./firebase');
      const currentUser = firebaseService.getCurrentUser();
      if (!currentUser || currentUser.isAnonymous) {
        console.warn('Cannot force sync: no authenticated user');
        return;
      }
      userId = currentUser.uid;
      // Initialize sync if not already done
      if (!this.isInitialized) {
        await this.initializeSync(userId);
      }
    }

    if (!userId) {
      console.warn('Cannot force sync: no user ID available');
      return;
    }

    try {
      // Save all local data to Firestore
      await this.saveToFirestore(userId);
      console.log('Force sync completed successfully');
    } catch (error) {
      console.error('Force sync failed:', error);
      throw error;
    }
  }
}

export const firebaseSyncService = new FirebaseSyncService();

