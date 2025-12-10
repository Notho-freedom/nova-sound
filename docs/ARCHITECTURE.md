# Architecture Modulaire - NEXUS Audio Player

## 🏗️ Vue d'ensemble

L'application NEXUS est structurée en **systèmes indépendants et interconnectés** selon les principes d'architecture modulaire.

---

## 📦 Systèmes Principaux

### 1. **Système d'Authentification** (`auth`)
**Localisation**: `src/services/auth.ts`, `app/api/auth/`

**Responsabilités**:
- Authentification OAuth (Google)
- Gestion des tokens
- Profil utilisateur

**Interfaces**:
```typescript
interface AuthService {
  getCurrentUser(): User | null;
  getAccessToken(): Promise<string | null>;
  getUserProfile(): UserProfile | null;
  isPro(): boolean;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}
```

**Dépendances**: Aucune (système de base)

**Utilisé par**:
- Firebase Service
- Nexus Server Service
- Stripe Service
- Tous les hooks d'upload

---

### 2. **Système Firebase** (`firebase`)
**Localisation**: `src/services/firebase.ts`, `lib/firebaseAdmin.ts`

**Responsabilités**:
- Authentification Firebase
- Synchronisation des données utilisateur
- Gestion du profil Firebase

**Interfaces**:
```typescript
interface FirebaseService {
  initialize(): Promise<void>;
  getCurrentUser(): User | null;
  getIdToken(): Promise<string | null>;
  isPro(): boolean;
  getUserProfile(): UserProfile | null;
}
```

**Dépendances**: 
- Auth Service (fallback)

**Utilisé par**:
- Firebase Sync Service
- Nexus Server Service
- Stripe Service
- Tous les composants nécessitant l'auth

---

### 3. **Système de Synchronisation** (`firebase-sync`)
**Localisation**: `src/services/firebase-sync.ts`

**Responsabilités**:
- Synchronisation bidirectionnelle Firebase ↔ LocalStorage
- Gestion de la queue de synchronisation
- Résolution des conflits

**Interfaces**:
```typescript
interface FirebaseSyncService {
  queueSync(type: string, data: any): void;
  startSync(): Promise<void>;
  stopSync(): void;
  getSyncStatus(): SyncStatus;
}
```

**Dépendances**:
- Firebase Service
- Storage Utils

**Utilisé par**:
- Tous les hooks (favorites, playlists, history)
- Services d'upload (Cloudinary, Nexus, Bunny)

---

### 4. **Système de Stockage Cloud** (`storage`)
**Localisation**: `src/services/cloudinary.ts`, `src/services/nexus-server.ts`, `lib/bunny.ts`, `lib/planethoster-sftp.ts`

**Sous-systèmes**:

#### 4.1. **Cloudinary Storage**
- Upload vers Cloudinary
- Gestion des transformations
- Tracking des uploads

#### 4.2. **Nexus Server Storage**
- Upload vers serveur Nexus
- Support Bunny CDN (Pro)
- Support PlanetHoster SFTP (Pro)
- Fallback stockage local

#### 4.3. **Bunny CDN**
- Upload vers Bunny Storage
- Génération d'URLs signées
- CDN global

#### 4.4. **PlanetHoster SFTP**
- Upload sécurisé via SFTP
- Support clés SSH
- Hébergement dédié

**Interfaces**:
```typescript
interface StorageProvider {
  upload(file: Buffer, path: string): Promise<UploadResult>;
  delete(path: string): Promise<void>;
  getUrl(path: string): string;
  isConfigured(): boolean;
}
```

**Dépendances**:
- Auth Service (vérification Pro)
- Firebase Sync (tracking)

**Utilisé par**:
- Hooks d'upload (useCloudinaryUpload, useNexusUpload)
- API routes (`/api/storage/*`)

---

### 5. **Système de Paiement** (`stripe`)
**Localisation**: `src/services/stripe.ts`, `lib/stripe-utils.ts`, `app/api/stripe/`

**Responsabilités**:
- Gestion des abonnements Stripe
- Checkout sessions
- Billing portal
- Vérification du statut Pro

**Interfaces**:
```typescript
interface StripeService {
  createCheckoutSession(priceId: string): Promise<CheckoutSession>;
  createPortalSession(): Promise<PortalSession>;
  getSubscriptionStatus(): Promise<SubscriptionStatus>;
  isPro(): Promise<boolean>;
}
```

**Dépendances**:
- Auth Service
- Firebase Service

**Utilisé par**:
- Settings View
- Hooks d'upload (vérification Pro)

---

### 6. **Système de Bibliothèque** (`library`)
**Localisation**: `src/hooks/useLibrary.ts`, `electron/services/audio-scanner.ts`, `electron/services/video-scanner.ts`

**Sous-systèmes**:

#### 6.1. **Audio Library**
- Scan de fichiers audio
- Extraction de métadonnées
- Gestion de la bibliothèque

#### 6.2. **Video Library**
- Scan de fichiers vidéo
- Génération de thumbnails
- Gestion de la bibliothèque vidéo

**Interfaces**:
```typescript
interface LibraryService {
  scan(directories: string[]): Promise<void>;
  getTracks(): Promise<Track[]>;
  getVideos(): Promise<Video[]>;
  onScanProgress(callback: (progress: ScanProgress) => void): () => void;
}
```

**Dépendances**:
- Electron API (pour le scan local)
- Metadata Extractor

**Utilisé par**:
- Library View
- Desktop App
- Hooks (useLibrary, useVideos)

---

### 7. **Système de Lecture** (`player`)
**Localisation**: `src/components/MusicPlayer.tsx`, `src/components/VideoPlayer.tsx`, `src/hooks/useQueue.ts`

**Sous-systèmes**:

#### 7.1. **Audio Player**
- Lecture audio
- Contrôles de lecture
- Gestion de la queue

#### 7.2. **Video Player**
- Lecture vidéo
- Contrôles vidéo
- Gestion de la queue vidéo

#### 7.3. **Queue Management**
- Gestion de la file d'attente
- Shuffle/Repeat
- Persistance localStorage

**Interfaces**:
```typescript
interface PlayerService {
  play(track: Track): void;
  pause(): void;
  stop(): void;
  seek(time: number): void;
  setVolume(volume: number): void;
}

interface QueueService {
  addToQueue(tracks: Track[]): void;
  removeFromQueue(trackId: string): void;
  shuffle(): void;
  clear(): void;
  getQueue(): Track[];
}
```

**Dépendances**:
- Library Service
- Storage Service (pour les URLs)

**Utilisé par**:
- Desktop App
- Now Playing Bar
- Queue Panel

---

### 8. **Système Electron** (`electron`)
**Localisation**: `electron/`, `electron/services/`

**Sous-systèmes**:

#### 8.1. **File System Services**
- Audio Scanner
- Video Scanner
- Metadata Extractor
- Storage Manager

#### 8.2. **Media Services**
- Equalizer
- Lyrics Provider
- Scrobbler

#### 8.3. **Playlist Manager**
- Gestion des playlists locales
- Import/Export
- Synchronisation

**Interfaces**:
```typescript
interface ElectronAPI {
  // File system
  scanLibrary(directories: string[]): Promise<void>;
  getLibrary(): Promise<Track[]>;
  
  // Media
  getTrackMetadata(filePath: string): Promise<TrackMetadata>;
  getAlbumArt(filePath: string): Promise<string | null>;
  
  // Playlists
  getPlaylists(): Promise<Playlist[]>;
  createPlaylist(name: string, trackIds: string[]): Promise<Playlist>;
}
```

**Dépendances**: Aucune (système isolé)

**Utilisé par**:
- Tous les hooks (via window.electronAPI)
- Desktop App

---

### 9. **Système API** (`api`)
**Localisation**: `app/api/`

**Sous-systèmes**:

#### 9.1. **Storage API**
- `/api/storage/upload` - Upload général
- `/api/storage/upload-bunny` - Upload Bunny
- `/api/storage/upload-planethoster` - Upload PlanetHoster
- `/api/storage/files` - Liste des fichiers
- `/api/storage/download/[fileId]` - Téléchargement

#### 9.2. **Stripe API**
- `/api/stripe/create-checkout-session` - Création checkout
- `/api/stripe/create-portal-session` - Billing portal
- `/api/stripe/subscription-status` - Statut abonnement

#### 9.3. **Sync API**
- `/api/sync/start` - Démarrer sync
- `/api/sync/status` - Statut sync

#### 9.4. **Admin API**
- `/api/admin/activate-pro` - Activation Pro manuelle

**Interfaces**:
- REST API standard
- Rate limiting intégré
- Validation Zod
- Error handling standardisé

**Dépendances**:
- Storage Services
- Stripe Service
- Firebase Admin
- Auth Middleware

---

### 10. **Système UI** (`ui`)
**Localisation**: `src/components/`

**Sous-systèmes**:

#### 10.1. **Core Components**
- DesktopApp (orchestrateur principal)
- Sidebar, TitleBar
- NowPlayingBar, QueuePanel

#### 10.2. **Views**
- HomeView, LibraryView, SearchView
- SettingsView, VideosView, DownloadsView

#### 10.3. **Player Components**
- MusicPlayer, VideoPlayer
- FullscreenPlayer, PlayerControls

#### 10.4. **UI Components** (shadcn/ui)
- 42 composants UI réutilisables

**Interfaces**:
- Props React standard
- Hooks personnalisés pour la logique

**Dépendances**:
- Tous les autres systèmes (via hooks)

---

## 🔗 Interconnexions

### Diagramme de dépendances

```
┌─────────────┐
│   Auth      │ (système de base)
└──────┬──────┘
       │
       ├──> Firebase
       ├──> Stripe
       └──> Storage Services
       
┌─────────────┐
│  Firebase   │
└──────┬──────┘
       │
       ├──> Firebase Sync
       └──> Storage Services
       
┌─────────────┐
│   Storage   │
└──────┬──────┘
       │
       ├──> Cloudinary
       ├──> Bunny CDN
       ├──> PlanetHoster
       └──> Nexus Server
       
┌─────────────┐
│   Library   │
└──────┬──────┘
       │
       ├──> Electron Services
       └──> Player
       
┌─────────────┐
│   Player    │
└──────┬──────┘
       │
       ├──> Library
       └──> Storage (pour URLs)
       
┌─────────────┐
│    API      │
└──────┬──────┘
       │
       ├──> Storage Services
       ├──> Stripe Service
       ├──> Firebase Admin
       └──> Auth Middleware
```

---

## 🎯 Principes d'Architecture

### 1. **Indépendance des Systèmes**
- ✅ Chaque système peut fonctionner indépendamment
- ✅ Interfaces clairement définies
- ✅ Pas de dépendances circulaires
- ✅ Facilement remplaçable

### 2. **Communication via Interfaces**
- ✅ Services exposent des interfaces TypeScript
- ✅ Hooks encapsulent la logique métier
- ✅ API routes utilisent des middlewares standardisés

### 3. **Séparation des Responsabilités**
- ✅ Services = Logique métier
- ✅ Hooks = État et effets React
- ✅ Components = Présentation
- ✅ API = Contrôleurs HTTP

### 4. **Configuration Centralisée**
- ✅ Variables d'environnement (`env.example`)
- ✅ Validation automatique (`scripts/validate-env.js`)
- ✅ Configuration Next.js (`next.config.js`)

### 5. **Gestion d'Erreurs Standardisée**
- ✅ `lib/validation.ts` - Schémas Zod + Error codes
- ✅ `lib/rate-limit.ts` - Rate limiting uniforme
- ✅ Error responses standardisées

---

## 🔄 Flux de Données

### Upload d'un fichier

```
User Action
    ↓
useNexusUpload Hook
    ↓
Nexus Server Service
    ↓
API Route (/api/storage/upload)
    ↓
Storage Provider (Bunny/PlanetHoster/Local)
    ↓
Firebase Sync (tracking)
    ↓
LocalStorage (persistence)
```

### Lecture d'un fichier

```
User Action
    ↓
useLibrary Hook
    ↓
Electron API (getLibrary)
    ↓
Audio Scanner Service
    ↓
Metadata Extractor
    ↓
Player Component
    ↓
Audio Element (HTML5)
```

### Synchronisation Firebase

```
User Action
    ↓
Hook (useFavorites, usePlaylists, etc.)
    ↓
Firebase Sync Service
    ↓
Queue de synchronisation
    ↓
Firebase Firestore
    ↓
LocalStorage (backup)
```

---

## 📝 Améliorations Recommandées

### 1. **Dependency Injection**
Créer un système d'injection de dépendances pour faciliter les tests et le remplacement de services.

### 2. **Event Bus**
Implémenter un bus d'événements pour la communication inter-systèmes sans couplage.

### 3. **Service Registry**
Créer un registre de services pour la découverte automatique et la configuration.

### 4. **Interface Abstractions**
Créer des interfaces abstraites pour les providers de stockage (Strategy Pattern).

### 5. **Configuration Manager**
Centraliser toute la configuration dans un service dédié.

---

## ✅ Vérification de l'Architecture

### Indépendance
- ✅ Services peuvent être remplacés individuellement
- ✅ Pas de dépendances circulaires détectées
- ✅ Interfaces clairement définies

### Interconnexion
- ✅ Communication via interfaces TypeScript
- ✅ Hooks comme couche d'abstraction
- ✅ API routes comme points d'entrée

### Maintenabilité
- ✅ Code organisé par responsabilité
- ✅ Documentation complète
- ✅ Tests unitaires (hooks, libs)

---

## 📚 Références

- [Next.js App Router](https://nextjs.org/docs/app)
- [Electron Architecture](https://www.electronjs.org/docs/latest/tutorial/architecture)
- [React Hooks Patterns](https://react.dev/reference/react)
- [TypeScript Interfaces](https://www.typescriptlang.org/docs/handbook/interfaces.html)

