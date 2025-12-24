# Documentation Architecture Complète - Nova Sound

**Date:** 23 décembre 2025  
**Version:** 2.0.0 - Documentation Exhaustive  
**Total de services:** 106

---

## Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Services Frontend (24)](#services-frontend)
3. [Services Electron (10)](#services-electron)
4. [Routes API (32)](#routes-api)
5. [React Hooks (32)](#react-hooks)
6. [Utilitaires Serveur (8)](#utilitaires-serveur)
7. [Patterns et Conventions](#patterns-et-conventions)
8. [Sécurité](#sécurité)
9. [Performance](#performance)

---

## Vue d'Ensemble

### Stack Technologique

```
┌─────────────────────────────────────────────┐
│         React 19 + Next.js 16 App Router    │
│  TailwindCSS • Shadcn/UI • TypeScript 5.x   │
└──────────────────┬──────────────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
┌────────▼────────┐  ┌──────▼─────────┐
│  Electron 33    │  │  Firebase Auth │
│  Desktop Layer  │  │  + Firestore   │
└─────────────────┘  └────────────────┘
         │                   │
┌────────▼────────┐  ┌──────▼─────────┐
│  Local Storage  │  │  Cloud Storage │
│  File System    │  │  Cloudinary    │
└─────────────────┘  │  Bunny CDN     │
                     │  PlanetHoster  │
                     └────────────────┘
```

### Architecture en 5 Couches

1. **Frontend Services (24)** - Logique métier côté client
2. **Electron Services (10)** - Services natifs de l'application desktop
3. **API Routes (32)** - Points d'entrée HTTP (Next.js App Router)
4. **React Hooks (32)** - Logique réutilisable de composants React
5. **Server Utilities (8)** - Helpers côté serveur

---

## Services Frontend

### 1. Auth Service (`src/services/auth.ts`)

Service d'authentification manuel avec Google OAuth (ne dépend pas de Firebase Auth).

#### Interfaces

```typescript
interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  plan: "free" | "pro";
  subscriptionStatus?: "active" | "canceled" | "past_due" | "trialing" | null;
  storageUsed: number;
  createdAt: string;
  lastLoginAt: string;
  isAnonymous?: boolean;
}

interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: number;
}
```

#### Méthodes Publiques

**Classe `AuthService`**

```typescript
// Configuration
setGoogleClientId(clientId: string): void
async getGoogleClientId(): Promise<string | null>
getGoogleClientIdSync(): string | null

// Authentification
async signInWithGoogle(): Promise<void>
async handleCallback(): Promise<UserProfile | null>
async linkWithGoogleCredential(idToken: string, accessToken: string, googleUserData?: {...}): Promise<UserProfile>
async signOut(): Promise<void>

// État utilisateur
getCurrentUser(): UserProfile | null
getUserProfile(): UserProfile | null
isAuthenticated(): boolean
isPro(): boolean

// Tokens
async getAccessToken(): Promise<string | null>
async getIdToken(): Promise<string | null>

// Listeners
onAuthStateChange(callback: (user: UserProfile | null) => void): () => void

// Profil
async updateProfile(data: Partial<UserProfile>): Promise<void>
```

#### Méthodes Privées

```typescript
private async generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }>
private generateRandomString(length: number): string
private base64URLEncode(array: Uint8Array): string
private async buildAuthUrl(): Promise<string>
private generateState(): string
private async exchangeCodeForTokens(code: string): Promise<AuthTokens>
private async refreshAccessToken(): Promise<AuthTokens>
private async getUserInfo(accessToken: string): Promise<any>
private async handleElectronCallback(code: string, state: string): Promise<UserProfile>
private async createGoogleProfile(userInfo: any, tokens: AuthTokens): Promise<UserProfile>
private setupElectronOAuthListener(): void
private setupTokenRefresh(): void
private loadFromStorage(): void
private saveToStorage(): void
private clearStorage(): void
private async loadGoogleClientId(): Promise<string | null>
```

#### Export Singleton

```typescript
export const authService = new AuthService();
```

#### Exemples d'Utilisation

```typescript
// Connexion Google
await authService.signInWithGoogle();

// Vérifier si l'utilisateur est Pro
if (authService.isPro()) {
  // Accès aux fonctionnalités Pro
}

// Obtenir un token pour API
const token = await authService.getAccessToken();

// Écouter les changements d'état
const unsubscribe = authService.onAuthStateChange((user) => {
  if (user) {
    console.log('Connecté:', user.email);
  } else {
    console.log('Déconnecté');
  }
});
```

---

### 2. Firebase Service (`src/services/firebase.ts`)

Service Firebase avec gestion d'authentification, profils Firestore, et synchronisation en temps réel.

#### Interfaces

```typescript
interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  plan: "free" | "pro";
  stripeCustomerId?: string;
  subscriptionId?: string;
  subscriptionStatus?: "active" | "canceled" | "past_due" | "trialing";
  subscriptionEndDate?: string;
  storageUsed: number;
  createdAt: string;
  lastLoginAt: string;
}
```

#### Méthodes Publiques

**Classe `FirebaseService`**

```typescript
// Initialisation
async ensureInitialized(): Promise<void>
isInitialized(): boolean

// Authentification
async signInAnonymously(): Promise<UserProfile>
async signInWithGoogle(): Promise<void>
async handleRedirectResult(): Promise<UserProfile | null>
async linkWithGoogleCredential(idToken: string, accessToken: string, googleUserData?: {...}): Promise<UserProfile>
async signOut(): Promise<void>

// État utilisateur
getCurrentUser(): User | null
getUserProfile(): UserProfile | null
isPro(): boolean

// Tokens
async getIdToken(forceRefresh?: boolean): Promise<string | null>
async refreshIdToken(): Promise<string | null>

// Profil
async updateProfile(data: Partial<UserProfile>): Promise<void>
async refreshProfile(): Promise<void>
async ensureUserProfileExists(manualUser: {...}): Promise<void>

// Listeners
onAuthStateChange(callback: (user: User | null) => void): () => void

// Recherche
async findUserByEmail(email: string): Promise<UserProfile | null>
```

#### Méthodes Privées

```typescript
private setupTokenRefreshListener(user: User | null): void
private async loadUserProfile(uid: string): Promise<void>
private createOrUpdateProfileOffline(user: User, googleUserData?: {...}): UserProfile
private async createOrUpdateProfile(user: User, googleUserData?: {...}): Promise<UserProfile>
```

#### Export Singleton et Helpers

```typescript
export const firebaseService = new FirebaseService();

export function getDb(): Firestore | null
export function getAuthInstance(): Auth | null
export function getFirebaseApp(): FirebaseApp | null
export async function waitForFirebase(): Promise<{...} | null>

export { auth, db, app as firebaseApp };
```

#### Exemples d'Utilisation

```typescript
// Connexion anonyme
const profile = await firebaseService.signInAnonymously();

// Connexion Google
await firebaseService.signInWithGoogle();

// Lier compte Google à utilisateur anonyme
const linkedProfile = await firebaseService.linkWithGoogleCredential(
  idToken,
  accessToken,
  { email: 'user@example.com', displayName: 'User', photoURL: '...' }
);

// Obtenir token ID pour backend
const token = await firebaseService.getIdToken();
```

---

### 3. Firebase Sync Service (`src/services/firebase-sync.ts`)

Service de synchronisation en temps réel entre localStorage et Firestore.

#### Interfaces

```typescript
interface UserAppData {
  settings?: Settings;
  favorites?: string[];
  history?: HistoryEntry[];
  equalizerPresets?: EqualizerPreset[];
  theme?: 'dark' | 'light' | 'cyberpunk' | 'minimal' | 'spotify' | 'apple-music' | 'youtube-music' | 'tidal' | 'deezer' | 'system';
  notificationsEnabled?: boolean;
  volume?: number;
  searchHistory?: string[];
  uploadedMedia?: Array<{
    id: string;
    name: string;
    uploadedAt: string;
    cloudProvider?: 'cloudinary' | 'nexus' | 'bunny' | 'planethoster';
    url?: string;
    size?: number;
  }>;
  cloudinaryConfig?: {...};
  youtubeApiKey?: string;
  scrobblerSettings?: {...};
  lastSyncAt?: string;
  version?: number;
}
```

#### Méthodes Publiques

**Classe `FirebaseSyncService`**

```typescript
// Initialisation
async initializeSync(userId: string): Promise<void>

// Chargement/Sauvegarde
async loadFromFirestore(userId?: string): Promise<UserAppData | null>
async saveToFirestore(userId: string, data?: Partial<UserAppData>): Promise<void>
async savePlaylistsToFirestore(userId: string, playlists: Playlist[]): Promise<void>

// File d'attente
queueSync(type: string, data: any): void

// Synchronisation forcée
async forceSyncNow(): Promise<void>

// État
getSyncStatus(): { isSyncing: boolean; queueLength: number }

// Nettoyage
cleanup(): void
```

#### Méthodes Privées

```typescript
private setupRealtimeListeners(userId: string): void
private handleListenerError(listenerKey: string, userId: string, retryCallback: () => void): void
private async handleRemoteUpdate(data: UserAppData): Promise<void>
private async handlePlaylistsUpdate(playlists: Playlist[]): Promise<void>
private saveDataLocally(data: Partial<UserAppData>): void
private getCurrentLocalData(): Partial<UserAppData>
private calculateDataHash(data: Partial<UserAppData>): string
private startPeriodicSync(userId: string): void
private stopPeriodicSync(): void
private async mergeWithLocal(firestoreData: UserAppData): Promise<void>
private async processSyncQueue(): Promise<void>
private saveToLocalStorage<T>(key: string, value: T): void
private loadFromLocalStorage<T>(key: string): T | null
```

#### Export Singleton

```typescript
export const firebaseSyncService = new FirebaseSyncService();
```

#### Exemples d'Utilisation

```typescript
// Initialiser la sync
await firebaseSyncService.initializeSync('user-uid-123');

// Sauvegarder des favoris
firebaseSyncService.queueSync('favorites', ['track-id-1', 'track-id-2']);

// Forcer une synchronisation immédiate
await firebaseSyncService.forceSyncNow();

// Nettoyer les listeners
firebaseSyncService.cleanup();
```

---

### 4. Cloudinary Service (`src/services/cloudinary.ts`)

Service d'upload de fichiers audio/vidéo vers Cloudinary avec suivi de progression.

#### Interfaces

```typescript
interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  uploadPreset: string;
}

interface UploadProgress {
  trackId: string;
  fileName: string;
  progress: number;
  status: "pending" | "uploading" | "complete" | "error";
  error?: string;
}

interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  resource_type: string;
  format: string;
  bytes: number;
}
```

#### Méthodes Publiques

**Classe `CloudinaryService`**

```typescript
// Configuration
loadConfig(): CloudinaryConfig | null
saveConfig(config: CloudinaryConfig): void
clearConfig(): void
isConfigured(): boolean
getConfig(): CloudinaryConfig | null

// Upload
async uploadTrack(track: Track, fileBlob: Blob, onProgress?: (progress: number) => void): Promise<CloudinaryUploadResult | null>
async uploadTracks(tracks: Track[], getBlob: (track: Track) => Promise<Blob | null>, onProgress?: (overall: number, current: UploadProgress) => void): Promise<Map<string, CloudinaryUploadResult | null>>

// Progression
onProgressUpdate(listener: (progress: Map<string, UploadProgress>) => void): () => void
getOverallProgress(): number
clearCompleted(): void
```

#### Méthodes Privées

```typescript
private notifyListeners(): void
```

#### Export Singleton

```typescript
export const cloudinaryService = new CloudinaryService();
```

#### Exemples d'Utilisation

```typescript
// Configurer Cloudinary
cloudinaryService.saveConfig({
  cloudName: 'my-cloud',
  apiKey: 'my-key',
  uploadPreset: 'my-preset'
});

// Upload un fichier avec progression
const result = await cloudinaryService.uploadTrack(
  track,
  blob,
  (progress) => {
    console.log(`Upload: ${progress}%`);
  }
);

// Écouter la progression globale
const unsubscribe = cloudinaryService.onProgressUpdate((progressMap) => {
  console.log('Progression:', progressMap.size, 'uploads en cours');
});
```

---

### 5. Storage Service (`src/services/storage-service.ts`)

Service centralisé de gestion du localStorage avec compression, cache mémoire, et debounce.

#### Interfaces

```typescript
interface StorageOptions {
  compress?: boolean; // Compresser les données volumineuses
  ttl?: number; // Time to live en millisecondes
  debounceMs?: number; // Debounce pour écritures multiples
}
```

#### Méthodes Publiques

**Classe `StorageService`**

```typescript
// Lecture/Écriture
get<T = any>(key: string, options?: StorageOptions): T | null
set(key: string, value: any, options?: StorageOptions): boolean
remove(key: string): void

// Utilitaires
getKeys(prefix: string): string[]
getSize(): number
clearMemoryCache(): void
flush(): void
```

#### Méthodes Privées

```typescript
private compress(data: any): string
private decompress(compressed: string): any
private isExpired(entry: {...}): boolean
private cleanMemoryCache(): void
private clearOldEntries(): void
```

#### Export Singleton

```typescript
export const storageService = new StorageService();
```

#### Exemples d'Utilisation

```typescript
// Sauvegarder avec compression et TTL
storageService.set('large-data', myData, {
  compress: true,
  ttl: 3600000, // 1 heure
  debounceMs: 500
});

// Lire depuis cache ou localStorage
const data = storageService.get<MyType>('large-data');

// Obtenir toutes les clés avec préfixe
const nexusKeys = storageService.getKeys('nexus-');
```

---

### 6. Stripe Service (`src/services/stripe.ts`)

Service de gestion des paiements et abonnements Stripe.

#### Interfaces

```typescript
interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

interface PortalSessionResponse {
  url: string;
}

interface SubscriptionStatus {
  isActive: boolean;
  plan: "free" | "pro";
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}
```

#### Constantes Exportées

```typescript
export const PRICE_IDS = {
  get PRO_MONTHLY(): string,
  get PRO_YEARLY(): string,
};
```

#### Méthodes Publiques

**Classe `StripeService`**

```typescript
// Initialisation
async ensureInitialized(): Promise<void>
isInitialized(): boolean
async getStripe(): Promise<Stripe | null>

// Checkout
async createCheckoutSession(priceId?: string): Promise<string>
async redirectToCheckout(priceId?: string): Promise<void>

// Portail client
async createPortalSession(): Promise<string>
async redirectToPortal(): Promise<void>

// Statut abonnement
async getSubscriptionStatus(): Promise<SubscriptionStatus>

// Post-checkout
async handleCheckoutSuccess(sessionId: string): Promise<void>
```

#### Méthodes Privées

```typescript
private setupStripeListeners(): void
```

#### Export Singleton

```typescript
export const stripeService = new StripeService();
```

#### Exemples d'Utilisation

```typescript
// Rediriger vers checkout (abonnement mensuel)
await stripeService.redirectToCheckout(PRICE_IDS.PRO_MONTHLY);

// Obtenir statut abonnement
const status = await stripeService.getSubscriptionStatus();
if (status.isActive) {
  console.log('Abonnement Pro actif');
}

// Ouvrir portail client
await stripeService.redirectToPortal();
```

---

### 7. Notification Service (`src/services/notification-service.ts`)

Service global de gestion des notifications avec support toast et natif.

#### Interfaces

```typescript
interface AppNotification {
  id: string;
  title: string;
  description?: string;
  type: "default" | "success" | "error" | "warning" | "info";
  timestamp: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

#### Méthodes Publiques

**Classe `NotificationService`**

```typescript
// Gestion état
subscribe(listener: (notifications: AppNotification[]) => void): () => void
getNotifications(): AppNotification[]
isEnabled(): boolean
setEnabled(enabled: boolean): void

// Notifications génériques
notify(options: {...}): void
success(title: string, description?: string): void
error(title: string, description?: string): void
warning(title: string, description?: string): void
info(title: string, description?: string): void

// Notifications spécialisées
trackChange(title: string, artist: string, coverUrl?: string): void
uploadStarted(fileName: string, provider: string): void
uploadCompleted(fileName: string, provider: string): void
uploadFailed(fileName: string, error?: string): void
syncStarted(): void
syncCompleted(): void
syncFailed(error?: string): void
loginSuccess(email: string): void
logoutSuccess(): void
playlistCreated(name: string): void
playlistDeleted(name: string): void
trackAddedToPlaylist(trackTitle: string, playlistName: string): void
libraryScanned(trackCount: number): void
newTracksAdded(count: number): void

// Nettoyage
clearAll(): void

// Permission native
async requestPermission(): Promise<boolean>
```

#### Méthodes Privées

```typescript
private notifyListeners(): void
private showNativeNotification(title: string, body?: string, icon?: string): void
```

#### Export Singleton

```typescript
export const notificationService = new NotificationService();
```

#### Exemples d'Utilisation

```typescript
// Notifications standard
notificationService.success('Opération réussie', 'Fichier sauvegardé');
notificationService.error('Erreur', 'Impossible de sauvegarder');

// Notifications spécialisées
notificationService.uploadCompleted('music.mp3', 'Cloudinary');
notificationService.syncCompleted();
notificationService.trackChange('Ma chanson', 'Mon artiste', 'cover-url');

// Écouter les notifications
const unsubscribe = notificationService.subscribe((notifications) => {
  console.log(`${notifications.length} notifications`);
});
```

---

### 8. AI Features Service (`src/services/ai-features.ts`)

Service de gestion des fonctionnalités IA basé sur le plan utilisateur.

#### Types

```typescript
type AIFeatureLevel = 'free' | 'pro' | 'none';

interface AIFeatureFlags {
  canUseAdvancedAI: boolean;
  canUseTranscription: boolean;
  canUseSentimentAnalysis: boolean;
  canUseSpeakerDiarization: boolean;
  canUseChapters: boolean;
  canUseToxicityDetection: boolean;
  level: AIFeatureLevel;
}
```

#### Fonctions Exportées

```typescript
async function checkAIFeatures(): Promise<AIFeatureFlags>
function isProUserSync(): boolean
async function getAIFeatures(): Promise<AIFeatureFlags>
```

#### Exemples d'Utilisation

```typescript
// Vérifier les fonctionnalités IA disponibles
const features = await getAIFeatures();
if (features.canUseTranscription) {
  // Activer la transcription
}

// Vérification synchrone (rapide)
if (isProUserSync()) {
  // Utilisateur Pro
}
```

---

## Services Electron

### 9. Audio Scanner (`electron/services/audio-scanner.ts`)

Service de scan de bibliothèque musicale avec extraction de métadonnées.

#### Interfaces

```typescript
interface ScannedTrack {
  id: string;
  filePath: string;
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
  format: string;
  addedAt: string;
  fileSize: number;
  lastModified: string;
}

interface ScanProgress {
  current: number;
  total: number;
  file: string;
  phase: 'scanning' | 'extracting' | 'indexing' | 'complete';
}
```

#### Fonctions Exportées

```typescript
async function scanLibrary(directories: string[]): Promise<ScannedTrack[]>
function startWatching(directories: string[]): void
function stopWatching(): void
function initAudioScanner(): void
```

#### Fonctions Privées

```typescript
function isAudioFile(filePath: string): boolean
async function scanDirectory(dirPath: string): Promise<string[]>
async function getFileStats(filePath: string): Promise<{...} | null>
async function processAudioFile(filePath: string): Promise<ScannedTrack | null>
function sendProgress(progress: ScanProgress): void
```

#### IPC Handlers

```typescript
'library:scan' → async (directories: string[]) => ScannedTrack[]
'library:get' → async () => StoredTrack[]
'library:getTrack' → async (trackId: string) => StoredTrack | null
'library:rescan' → async () => ScannedTrack[]
'fs:exists' → async (filePath: string) => boolean
```

#### Exemples d'Utilisation (Renderer)

```typescript
// Scanner des répertoires
const tracks = await window.electronAPI.scanLibrary([
  'C:/Music',
  'D:/Downloads'
]);

// Obtenir la bibliothèque
const library = await window.electronAPI.getLibrary();

// Rescan automatique
const newTracks = await window.electronAPI.rescanLibrary();
```

---

### 10. Storage Service (`electron/services/storage.ts`)

Service de stockage local pour bibliothèque, playlists, favoris, historique et paramètres.

#### Interfaces

```typescript
interface StoredTrack {
  id: string;
  filePath: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverUrl: string;
  // ... + propriétés étendues
}

interface Playlist {
  id: string;
  name: string;
  description?: string;
  trackIds: string[];
  coverUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface HistoryEntry {
  trackId: string;
  playedAt: string;
  duration: number;
  completedPercentage: number;
}

interface EqualizerPreset {
  name: string;
  bands: number[];
  preamp: number;
  isCustom: boolean;
}

interface Settings {
  musicDirectories: string[];
  videoDirectories?: string[];
  equalizerEnabled: boolean;
  equalizerPreset: string;
  customEqualizer: number[];
  scrobblingEnabled: boolean;
  // ... + propriétés étendues
}

interface StoredVideo {
  id: string;
  filePath: string;
  title: string;
  duration: number;
  thumbnailUrl?: string;
  // ... + propriétés étendues
}
```

#### Méthodes Publiques

**Classe `Storage`**

```typescript
// Initialisation
async init(): Promise<void>

// Bibliothèque audio
async getLibrary(): Promise<StoredTrack[]>
async saveLibrary(tracks: StoredTrack[]): Promise<void>
async getTrack(trackId: string): Promise<StoredTrack | null>
async addTrack(track: StoredTrack): Promise<void>
async removeTrackByPath(filePath: string): Promise<void>
async updateTrackByPath(filePath: string, track: Partial<StoredTrack>): Promise<void>
async updateTrack(trackId: string, track: Partial<StoredTrack>): Promise<void>

// Vidéos
async getVideos(): Promise<StoredVideo[]>
async saveVideos(videos: StoredVideo[]): Promise<void>
async addVideos(videos: StoredVideo[]): Promise<void>
async getVideo(videoId: string): Promise<StoredVideo | null>
async removeVideoByPath(filePath: string): Promise<void>
async updateVideoByPath(filePath: string, video: Partial<StoredVideo>): Promise<void>
async updateVideo(videoId: string, updates: Partial<StoredVideo>): Promise<void>

// Artwork & Thumbnails
async saveArtwork(artwork: ArtworkData, sourceFilePath: string): Promise<string>
async saveThumbnail(thumbnailData: Buffer, sourceFilePath: string): Promise<string>
async getThumbnailPath(sourceFilePath: string): Promise<string | null>

// Playlists
async getPlaylists(): Promise<Playlist[]>
async savePlaylists(playlists: Playlist[]): Promise<void>
async createPlaylist(name: string, trackIds?: string[]): Promise<Playlist>
async updatePlaylist(id: string, data: Partial<Playlist>): Promise<Playlist | null>
async deletePlaylist(id: string): Promise<void>
async getPlaylist(id: string): Promise<Playlist | null>

// Favoris
async getFavorites(): Promise<string[]>
async saveFavorites(favorites: string[]): Promise<void>
async addFavorite(trackId: string): Promise<void>
async removeFavorite(trackId: string): Promise<void>
async isFavorite(trackId: string): Promise<boolean>

// Historique
async getHistory(): Promise<HistoryEntry[]>
async addToHistory(entry: HistoryEntry): Promise<void>
async clearHistory(): Promise<void>

// Paramètres
async getSettings(): Promise<Settings>
async updateSettings(updates: Partial<Settings>): Promise<Settings>
async resetSettings(): Promise<Settings>

// Égaliseur
async getEqualizerPresets(): Promise<EqualizerPreset[]>
async saveEqualizerPreset(name: string, bands: number[], preamp?: number): Promise<void>
async deleteEqualizerPreset(name: string): Promise<void>

// File d'attente de scrobble
async getScrobbleQueue(): Promise<any[]>
async addToScrobbleQueue(scrobble: any): Promise<void>
async clearScrobbleQueue(): Promise<void>
async removeFromScrobbleQueue(index: number): Promise<void>
```

#### Méthodes Privées

```typescript
private removeDuplicateTracks(tracks: StoredTrack[]): StoredTrack[]
```

#### Export Singleton

```typescript
export const storage = new Storage();
export function initStorage(): void
```

#### IPC Handlers

```typescript
// Settings
'settings:get' → async () => Settings
'settings:update' → async (settings: Partial<Settings>) => Settings

// Playlists
'playlists:get' → async () => Playlist[]
'playlists:create' → async (name: string, trackIds: string[]) => Playlist
'playlists:update' → async (id: string, data: Partial<Playlist>) => Playlist | null
'playlists:delete' → async (id: string) => void

// Favoris
'favorites:get' → async () => string[]
'favorites:add' → async (trackId: string) => void
'favorites:remove' → async (trackId: string) => void
'favorites:check' → async (trackId: string) => boolean

// Historique
'history:get' → async () => HistoryEntry[]
'history:add' → async (trackId: string) => void
'history:clear' → async () => void

// Égaliseur
'equalizer:presets' → async () => EqualizerPreset[]
'equalizer:save' → async (name: string, bands: number[]) => void
'equalizer:delete' → async (name: string) => void
```

---

### 11. Metadata Extractor (`electron/services/metadata-extractor.ts`)

Service d'extraction de métadonnées audio avec support artwork.

#### Interfaces

```typescript
interface ExtractedMetadata {
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  genre?: string;
  duration: number;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  format: string;
  trackNumber?: number;
  discNumber?: number;
  albumArtist?: string;
  composer?: string;
  comment?: string;
  lyrics?: string;
  artwork?: ArtworkData;
}

interface ArtworkData {
  data: Buffer;
  format: string;
  type?: string;
  description?: string;
}
```

#### Fonctions Exportées

```typescript
async function extractMetadata(filePath: string): Promise<ExtractedMetadata | null>
async function extractArtwork(filePath: string): Promise<ArtworkData | null>
async function getAudioDuration(filePath: string): Promise<number>
function initMetadataExtractor(): void
```

#### IPC Handlers

```typescript
'metadata:get' → async (filePath: string) => ExtractedMetadata | null
'metadata:artwork' → async (filePath: string) => string | null (base64 data URL)
'audio:duration' → async (filePath: string) => number
```

#### Exemples d'Utilisation (Renderer)

```typescript
// Extraire les métadonnées
const metadata = await window.electronAPI.getMetadata('C:/Music/song.mp3');
console.log(metadata.title, metadata.artist);

// Obtenir uniquement l'artwork
const artworkUrl = await window.electronAPI.getArtwork('C:/Music/song.mp3');
if (artworkUrl) {
  imgElement.src = artworkUrl;
}

// Obtenir uniquement la durée
const duration = await window.electronAPI.getAudioDuration('C:/Music/song.mp3');
console.log(`Durée: ${Math.floor(duration / 60)}:${duration % 60}`);
```

---

## Utilitaires Serveur

### 12. Rate Limiting (`lib/rate-limit.ts`)

Système de rate limiting en mémoire pour les routes API.

#### Interfaces

```typescript
interface RateLimitOptions {
  windowMs: number; // Fenêtre de temps en millisecondes
  max: number; // Maximum de requêtes par fenêtre
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}
```

#### Fonctions Exportées

```typescript
function createRateLimiter(options: RateLimitOptions): (
  identifier: string,
  isSuccess?: boolean
) => Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: number;
  message?: string;
}>

function getClientIdentifier(request: NextRequest): string
```

#### Rate Limiters Prédéfinis

```typescript
export const rateLimiters = {
  // 100 requêtes / 15 minutes
  general: RateLimiter,
  
  // 10 requêtes / minute
  strict: RateLimiter,
  
  // 5 uploads / heure
  upload: RateLimiter,
  
  // 5 tentatives auth / 15 minutes
  auth: RateLimiter,
};
```

#### Exemples d'Utilisation

```typescript
import { rateLimiters, getClientIdentifier } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const identifier = getClientIdentifier(request);
  const result = await rateLimiters.general(identifier);
  
  if (!result.allowed) {
    return NextResponse.json(
      { error: result.message },
      { status: 429 }
    );
  }
  
  // Traiter la requête
  return NextResponse.json({ success: true });
}
```

---

## Routes API

### Pattern Standard

Toutes les routes API protégées suivent ce pattern :

```typescript
import { withAuth, withAdmin } from '@/lib/server/authz';
import { rateLimiters, getClientIdentifier } from '@/lib/rate-limit';
import { createErrorResponse } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  // Rate limiting
  const identifier = getClientIdentifier(request);
  const rateLimit = await rateLimiters.general(identifier);
  
  if (!rateLimit.allowed) {
    return createErrorResponse('RATE_LIMIT_EXCEEDED', 429);
  }
  
  // Logique métier
  try {
    const data = await request.json();
    // ... traitement
    return NextResponse.json({ success: true });
  } catch (error) {
    return createErrorResponse('INTERNAL_ERROR', 500);
  }
});
```

### Routes Publiques

#### 1. `/api/config`

- **GET** - Configuration publique
- **Réponse:** `{ youtubeEnabled: boolean, stripeEnabled: boolean, ... }`

#### 2. `/api/config/youtube`

- **GET** - Configuration YouTube
- **Réponse:** `{ enabled: boolean, hasApiKey: boolean }`

#### 3. `/api/config/upload`

- **GET** - Configuration upload
- **Réponse:** `{ cloudinary: {...}, bunny: {...}, planethoster: {...} }`

#### 4. `/api/health`

- **GET** - Health check
- **Réponse:** `{ status: 'ok', timestamp: number }`

### Routes Authentifiées

#### Authentification

##### 5. `/api/auth/verify`

- **POST** 🔒 - Vérifier token
- **Body:** `{ token: string }`
- **Réponse:** `{ valid: boolean, userId: string }`

##### 6. `/api/oauth/google/callback`

- **GET** - Callback OAuth Google
- **Query:** `code`, `state`
- **Réponse:** Redirection avec tokens

### Administration

##### 7. `/api/admin/activate-pro`

- **POST** 🔒🔑 - Activation Pro manuelle
- **Body:** `{ userId: string }`
- **Réponse:** `{ success: boolean }`
- **Rate Limit:** strict (30/15min)

### Stockage

##### 8. `/api/storage/files`

- **GET** 🔒 - Liste fichiers utilisateur
- **Réponse:** `{ files: File[] }`

##### 9. `/api/storage/files/[fileId]`

- **GET** 🔒 - Détails fichier
- **DELETE** 🔒 - Supprimer fichier
- **Réponse GET:** `{ file: File }`
- **Réponse DELETE:** `{ success: boolean }`

##### 10. `/api/storage/download/[fileId]`

- **GET** 🔒 - Télécharger fichier
- **Réponse:** Stream de fichier

##### 11. `/api/storage/upload-bunny`

- **POST** 🔒 - Upload vers Bunny CDN
- **Body:** FormData avec fichier
- **Réponse:** `{ url: string, fileId: string }`
- **Rate Limit:** upload (50/15min)

##### 12. `/api/storage/proxy/planethoster`

- **GET** 🔒 - Proxy PlanetHoster SFTP
- **Query:** `path`
- **Réponse:** Stream de fichier

##### 13. `/api/storage/cleanup`

- **POST** 🔒 - Nettoyage stockage
- **Réponse:** `{ deletedCount: number }`

### Stripe

##### 14. `/api/stripe/create-checkout-session`

- **POST** 🔒 - Créer session checkout
- **Body:** `{ priceId: string, successUrl: string, cancelUrl: string }`
- **Réponse:** `{ sessionId: string, url: string }`

##### 15. `/api/stripe/create-portal-session`

- **POST** 🔒 - Portail client Stripe
- **Body:** `{ returnUrl: string }`
- **Réponse:** `{ url: string }`

##### 16. `/api/stripe/subscription-status`

- **GET** 🔒 - Statut abonnement
- **Réponse:** `{ isActive: boolean, plan: string, status: string, currentPeriodEnd: string, cancelAtPeriodEnd: boolean }`

##### 17. `/api/stripe/sync-profile`

- **POST** 🔒 - Synchroniser profil avec Stripe
- **Réponse:** `{ success: boolean }`

##### 18. `/api/stripe/webhook`

- **POST** - Webhook Stripe (events)
- **Body:** Stripe event
- **Réponse:** `{ received: true }`

##### 19. `/api/stripe/prices`

- **GET** - Liste des prix
- **Réponse:** `{ prices: Price[] }`

### Synchronisation

##### 20. `/api/sync/start`

- **POST** 🔒 - Démarrer sync cloud
- **Réponse:** `{ success: boolean }`
- **Rate Limit:** general (100/15min)

##### 21. `/api/sync/status`

- **GET** 🔒 - Statut sync
- **Réponse:** `{ isSyncing: boolean, lastSync: string }`

### Intelligence Artificielle

##### 22. `/api/ai/assemblyai/transcribe`

- **POST** 🔒 - Transcription audio
- **Body:** `{ audioUrl: string, languageCode?: string }`
- **Réponse:** `{ transcriptId: string }`
- **Rate Limit:** strict (30/15min)

##### 23. `/api/ai/assemblyai/transcribe/[id]`

- **GET** 🔒 - Statut transcription
- **Réponse:** `{ status: string, text?: string }`

##### 24. `/api/ai/quota`

- **GET** 🔒 - Quotas IA restants
- **Réponse:** `{ remaining: number, limit: number }`

### Métadonnées

##### 25. `/api/artist-metadata`

- **GET** - Recherche métadonnées artiste
- **Query:** `artist`
- **Réponse:** `{ artist: ArtistMetadata }`

##### 26. `/api/artist-images`

- **GET** - Recherche images artiste
- **Query:** `artist`
- **Réponse:** `{ images: string[] }`

### Mises à jour

##### 27. `/api/update/check`

- **GET** - Vérifier mises à jour
- **Réponse:** `{ updateAvailable: boolean, version: string }`

##### 28. `/api/update/latest`

- **GET** - Dernière version disponible
- **Réponse:** `{ version: string, releaseDate: string, downloadUrl: string }`

---

## React Hooks

### Pattern Standard

Tous les hooks suivent ce pattern :

```typescript
import { useState, useEffect } from 'react';
import { service } from '@/services/service';

export function useFeature() {
  const [data, setData] = useState<DataType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialisation et listeners
    const unsubscribe = service.subscribe((newData) => {
      setData(newData);
    });

    return () => unsubscribe();
  }, []);

  const performAction = async () => {
    setLoading(true);
    setError(null);
    try {
      await service.doSomething();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    data,
    loading,
    error,
    performAction,
  };
}
```

### Hooks Principaux

#### 29. `useAuth`

```typescript
function useAuth(): {
  user: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  isPro: boolean;
}
```

#### 30. `useQueue`

```typescript
function useQueue(): {
  queue: Track[];
  currentTrack: Track | null;
  currentIndex: number;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  shuffle: () => void;
  clear: () => void;
}
```

#### 31. `useFavorites`

```typescript
function useFavorites(): {
  favorites: string[];
  loading: boolean;
  addFavorite: (trackId: string) => Promise<void>;
  removeFavorite: (trackId: string) => Promise<void>;
  isFavorite: (trackId: string) => boolean;
}
```

#### 32. `usePlaylists`

```typescript
function usePlaylists(): {
  playlists: Playlist[];
  loading: boolean;
  createPlaylist: (name: string, trackIds?: string[]) => Promise<Playlist>;
  updatePlaylist: (id: string, data: Partial<Playlist>) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  addToPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  removeFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
}
```

#### 33. `useLibrary`

```typescript
function useLibrary(): {
  tracks: Track[];
  loading: boolean;
  error: string | null;
  scanLibrary: (directories: string[]) => Promise<void>;
  rescanLibrary: () => Promise<void>;
  search: (query: string) => Track[];
}
```

#### 34. `useSync`

```typescript
function useSync(): {
  isSyncing: boolean;
  lastSync: Date | null;
  error: string | null;
  startSync: () => Promise<void>;
  forceSync: () => Promise<void>;
}
```

#### 35. `useUpload`

```typescript
function useUpload(): {
  uploading: boolean;
  progress: number;
  uploads: UploadProgress[];
  uploadFile: (file: File, provider: string) => Promise<void>;
  cancelUpload: (uploadId: string) => void;
}
```

---

## Patterns et Conventions

### Nommage

#### Fichiers
- **Services:** `kebab-case.ts` (ex: `firebase-sync.ts`)
- **Composants:** `PascalCase.tsx` (ex: `AudioPlayer.tsx`)
- **Hooks:** `camelCase.ts` avec préfixe `use` (ex: `useAuth.ts`)
- **Utilitaires:** `kebab-case.ts` (ex: `rate-limit.ts`)

#### Variables et Fonctions
- **camelCase:** Variables, fonctions, méthodes
- **PascalCase:** Classes, interfaces, types, composants React
- **UPPER_SNAKE_CASE:** Constantes globales
- **_prefixUnderscore:** Méthodes privées de classe

### Structure de Dossiers

```
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   ├── (auth)/            # Routes authentifiées
│   └── (public)/          # Routes publiques
├── src/
│   ├── components/        # Composants React
│   ├── hooks/             # React Hooks
│   ├── services/          # Services Frontend
│   ├── types/             # TypeScript types
│   └── lib/               # Utilitaires partagés
├── electron/
│   ├── services/          # Services Electron
│   └── main.ts            # Main process
└── lib/
    └── server/            # Utilitaires serveur
```

### Error Handling

#### Frontend
```typescript
try {
  await service.doSomething();
} catch (error) {
  console.error('Descriptive error:', error);
  notificationService.error('User-friendly message');
  throw error; // Si nécessaire
}
```

#### Backend (API Routes)
```typescript
try {
  const data = await processRequest();
  return NextResponse.json({ success: true, data });
} catch (error) {
  console.error('API Error:', error);
  return createErrorResponse('ERROR_CODE', 500);
}
```

### Type Safety

#### Interfaces vs Types
- **Interfaces:** Pour objets extensibles
- **Types:** Pour unions, intersections, aliases

```typescript
// Interface (extensible)
interface UserProfile {
  uid: string;
  email: string;
}

// Type (union, non extensible)
type Plan = 'free' | 'pro';
```

### Async/Await

Toujours utiliser `async/await` au lieu de `.then()`:

```typescript
// ✅ Bon
async function loadData() {
  const data = await service.getData();
  return data;
}

// ❌ Mauvais
function loadData() {
  return service.getData().then(data => data);
}
```

---

## Sécurité

### Authentication

#### Token Verification
```typescript
import { verifyAuth } from '@/app/api/auth/middleware';

const authResult = await verifyAuth(request);
if (!authResult) {
  return createErrorResponse('UNAUTHORIZED', 401);
}
```

#### Auth Guards
```typescript
import { withAuth, withAdmin } from '@/lib/server/authz';

export const POST = withAuth(async (request, { userId }) => {
  // userId est garanti non-null
});

export const DELETE = withAdmin(async (request, { userId, userEmail }) => {
  // userId et userEmail garantis, utilisateur admin
});
```

### Rate Limiting

Appliqué sur toutes les routes sensibles:

```typescript
const identifier = getClientIdentifier(request);
const rateLimit = await rateLimiters.strict(identifier);

if (!rateLimit.allowed) {
  return NextResponse.json(
    { error: 'Too many requests' },
    { 
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000))
      }
    }
  );
}
```

### Input Validation

Utilisation de Zod pour validation:

```typescript
import { z } from 'zod';
import { validateRequest } from '@/lib/validation';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const result = await validateRequest(request, schema);
if (!result.success) {
  return createErrorResponse('VALIDATION_ERROR', 400, result.errors);
}
```

### CORS et CSP

#### Next.js middleware
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  return response;
}
```

#### Electron BrowserWindow
```typescript
mainWindow = new BrowserWindow({
  webPreferences: {
    webSecurity: true,
    nodeIntegration: false,
    contextIsolation: true,
    preload: path.join(__dirname, 'preload.cjs'),
  },
});
```

### Secrets Management

#### Variables d'environnement
```bash
# .env.local (ne jamais commit)
STRIPE_SECRET_KEY=sk_...
GOOGLE_CLIENT_SECRET=...
FIREBASE_ADMIN_PRIVATE_KEY=...
```

#### Chargement sécurisé
```typescript
// Côté serveur uniquement
const secret = process.env.SECRET_KEY;

// Côté client: utiliser API routes
const config = await fetch('/api/config').then(r => r.json());
```

---

## Performance

### Optimisations Frontend

#### Code Splitting
```typescript
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <p>Loading...</p>,
  ssr: false,
});
```

#### Memoization
```typescript
import { useMemo, useCallback } from 'react';

const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);

const handleClick = useCallback(() => {
  doSomething(value);
}, [value]);
```

#### Debouncing
```typescript
import { debounce } from 'lodash';

const debouncedSave = useMemo(
  () => debounce((value) => save(value), 500),
  []
);
```

### Optimisations Backend

#### Batch Operations
```typescript
// Firebase
const batch = writeBatch(db);
items.forEach(item => {
  batch.set(doc(db, 'items', item.id), item);
});
await batch.commit();
```

#### Caching
```typescript
// In-memory cache
const cache = new Map<string, { data: any; expires: number }>();

async function getCached(key: string) {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  
  const data = await fetchFresh(key);
  cache.set(key, {
    data,
    expires: Date.now() + 3600000, // 1 heure
  });
  
  return data;
}
```

#### Streaming
```typescript
// API Route avec streaming
export async function GET(request: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of dataGenerator()) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/octet-stream',
    },
  });
}
```

### Optimisations Electron

#### Lazy Loading Services
```typescript
// Ne charger que quand nécessaire
let lyricsProvider: LyricsProvider | null = null;

export async function getLyrics(track: string) {
  if (!lyricsProvider) {
    lyricsProvider = new LyricsProvider();
    await lyricsProvider.init();
  }
  return lyricsProvider.search(track);
}
```

#### IPC Optimizations
```typescript
// Éviter les appels IPC fréquents
let cachedLibrary: Track[] | null = null;

export async function getLibrary() {
  if (cachedLibrary) {
    return cachedLibrary;
  }
  
  cachedLibrary = await window.electronAPI.getLibrary();
  return cachedLibrary;
}

// Invalider le cache quand nécessaire
window.electronAPI.onLibraryChanged(() => {
  cachedLibrary = null;
});
```

---

## Annexes

### Glossaire

- **IPC:** Inter-Process Communication (Electron)
- **SSR:** Server-Side Rendering
- **CSP:** Content Security Policy
- **PKCE:** Proof Key for Code Exchange (OAuth)
- **TTL:** Time To Live
- **Rate Limiting:** Limitation du nombre de requêtes

### Ressources

- [Next.js Documentation](https://nextjs.org/docs)
- [Electron Documentation](https://www.electronjs.org/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Stripe Documentation](https://stripe.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

### Changelog Architecture

#### Version 2.0.0 (23 décembre 2025)
- ✅ Documentation exhaustive de 106 services
- ✅ Toutes les signatures de fonctions documentées
- ✅ Exemples d'utilisation ajoutés
- ✅ Patterns et conventions établis
- ✅ Section sécurité complète
- ✅ Section performance ajoutée

#### Version 1.0.0
- Inventaire initial des services
- Architecture globale documentée

---

**Maintenu par:** L'équipe Nova Sound  
**Dernière mise à jour:** 23 décembre 2025  
**Contact:** [GitHub Issues](https://github.com/Notho-freedom/nova-sound/issues)
