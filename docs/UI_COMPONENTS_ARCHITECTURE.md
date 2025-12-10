# Architecture Modulaire des Composants UI - NEXUS Audio Player

## 🎨 Vue d'ensemble

Les composants UI de NEXUS sont organisés en **systèmes indépendants et interconnectés** selon les principes d'architecture modulaire, avec des interfaces clairement définies via les props React.

---

## 📦 Systèmes de Composants

### 1. **Système de Layout** (`layout`)
**Localisation**: `src/components/DesktopApp.tsx`, `src/components/Sidebar.tsx`, `src/components/TitleBar.tsx`

**Composants**:
- `DesktopApp` - Orchestrateur principal (root component)
- `Sidebar` - Navigation latérale
- `TitleBar` - Barre de titre (Electron)

**Responsabilités**:
- Structure de l'application
- Navigation entre vues
- Gestion de l'état global de l'UI

**Interfaces**:
```typescript
interface DesktopAppProps {
  // Pas de props - composant root
}

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
}

interface TitleBarProps {
  // Props gérées via Electron API
}
```

**Dépendances**: Aucune (système de base)

**Utilisé par**: Application root

---

### 2. **Système de Player** (`player`)
**Localisation**: `src/components/NowPlayingBar.tsx`, `src/components/FullscreenPlayer.tsx`, `src/components/PlayerControls.tsx`, `src/components/ProgressBar.tsx`

**Composants**:
- `NowPlayingBar` - Barre de lecture en bas
- `FullscreenPlayer` - Lecteur plein écran
- `PlayerControls` - Contrôles de lecture
- `ProgressBar` - Barre de progression

**Responsabilités**:
- Affichage du morceau en cours
- Contrôles de lecture (play/pause/next/prev)
- Gestion du volume
- Progression temporelle

**Interfaces**:
```typescript
interface NowPlayingBarProps {
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
  isQueueOpen: boolean;
}

interface FullscreenPlayerProps {
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
  onClose: () => void;
  onToggleFavorite?: () => void;
}

interface PlayerControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onShuffle: () => void;
  onRepeat: () => void;
  isShuffle: boolean;
  repeatMode: "off" | "all" | "one";
}
```

**Dépendances**:
- Track type
- UI Components (Slider, Button, Tooltip)

**Utilisé par**:
- DesktopApp
- FullscreenPlayer

---

### 3. **Système de Queue** (`queue`)
**Localisation**: `src/components/QueuePanel.tsx`

**Composants**:
- `QueuePanel` - Panneau de file d'attente

**Responsabilités**:
- Affichage de la file d'attente
- Historique de lecture
- Sélection de morceaux dans la queue

**Interfaces**:
```typescript
interface QueuePanelProps {
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onTrackSelect: (index: number) => void;
  onClose: () => void;
}
```

**Dépendances**:
- Track type
- UI Components (ScrollArea)

**Utilisé par**:
- DesktopApp

---

### 4. **Système de Vues** (`views`)
**Localisation**: `src/components/views/`

**Composants**:
- `HomeView` - Vue d'accueil
- `LibraryView` - Vue bibliothèque
- `SearchView` - Vue recherche
- `SettingsView` - Vue paramètres
- `VideosView` - Vue vidéos
- `DownloadsView` - Vue téléchargements

**Responsabilités**:
- Affichage de contenu spécifique
- Interactions utilisateur par domaine
- Navigation interne

**Interfaces**:
```typescript
interface HomeViewProps {
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onTrackSelect: (index: number) => void;
  recentTracks?: Track[];
  favoriteTracks?: Track[];
}

interface LibraryViewProps {
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

interface SearchViewProps {
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onTrackSelect: (index: number) => void;
}

interface SettingsViewProps {
  // Pas de props - gère son propre état
}

interface VideosViewProps {
  // Pas de props - gère son propre état via hooks
}

interface DownloadsViewProps {
  // Pas de props - gère son propre état via hooks
}
```

**Dépendances**:
- Track type
- Hooks (useLibrary, useFavorites, usePlaylists, etc.)
- UI Components
- Context Menus

**Utilisé par**:
- DesktopApp (via routing)

---

### 5. **Système de Context Menus** (`context-menus`)
**Localisation**: `src/components/TrackContextMenu.tsx`, `src/components/AlbumContextMenu.tsx`, `src/components/ArtistContextMenu.tsx`, `src/components/PlaylistContextMenu.tsx`

**Composants**:
- `TrackContextMenu` - Menu contextuel pour pistes
- `AlbumContextMenu` - Menu contextuel pour albums
- `ArtistContextMenu` - Menu contextuel pour artistes
- `PlaylistContextMenu` - Menu contextuel pour playlists

**Responsabilités**:
- Actions contextuelles sur les éléments
- Intégration avec les hooks métier
- Affichage conditionnel d'options

**Interfaces**:
```typescript
interface TrackContextMenuProps {
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

interface AlbumContextMenuProps {
  album: Album;
  tracks: Track[];
  onPlay: () => void;
  onPlayNext: () => void;
  onAddToQueue: () => void;
  onAddToPlaylist: (playlistId: string) => void;
  children: React.ReactNode;
}

interface ArtistContextMenuProps {
  artist: Artist;
  tracks: Track[];
  onPlay: () => void;
  onPlayNext: () => void;
  onAddToQueue: () => void;
  onAddToPlaylist: (playlistId: string) => void;
  children: React.ReactNode;
}

interface PlaylistContextMenuProps {
  playlist: Playlist;
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onExport?: () => void;
  children: React.ReactNode;
}
```

**Dépendances**:
- Track/Album/Artist/Playlist types
- UI Components (ContextMenu)
- Hooks (useFavorites, usePlaylists, useCloudinaryUpload, etc.)

**Utilisé par**:
- LibraryView
- TrackList
- TrackGridView
- TrackListView
- Sidebar (playlists)

---

### 6. **Système d'Affichage de Tracks** (`track-display`)
**Localisation**: `src/components/TrackList.tsx`, `src/components/TrackListView.tsx`, `src/components/TrackGridView.tsx`

**Composants**:
- `TrackList` - Liste de pistes (composant wrapper)
- `TrackListView` - Vue liste
- `TrackGridView` - Vue grille

**Responsabilités**:
- Affichage de listes de pistes
- Support de différents modes d'affichage
- Intégration avec context menus

**Interfaces**:
```typescript
interface TrackListProps {
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
  canUploadToNexus?: boolean;
}

interface TrackListViewProps {
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
  canUploadToNexus?: boolean;
}

interface TrackGridViewProps {
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
```

**Dépendances**:
- Track type
- TrackContextMenu
- UI Components

**Utilisé par**:
- LibraryView
- HomeView
- SearchView

---

### 7. **Système de Media** (`media`)
**Localisation**: `src/components/AlbumArt.tsx`, `src/components/AudioVisualizer.tsx`, `src/components/VideoPlayer.tsx`, `src/components/MusicPlayer.tsx`

**Composants**:
- `AlbumArt` - Artwork d'album
- `AudioVisualizer` - Visualiseur audio
- `VideoPlayer` - Lecteur vidéo
- `MusicPlayer` - Lecteur audio (wrapper)

**Responsabilités**:
- Affichage de médias
- Visualisation audio
- Lecture vidéo

**Interfaces**:
```typescript
interface AlbumArtProps {
  track: Track;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showPlayButton?: boolean;
  isPlaying?: boolean;
  onPlay?: () => void;
}

interface AudioVisualizerProps {
  audioElement: HTMLAudioElement | null;
  type?: "bars" | "wave" | "circle";
  color?: string;
  className?: string;
}

interface VideoPlayerProps {
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

interface MusicPlayerProps {
  track: Track;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
}
```

**Dépendances**:
- Track/Video types
- UI Components

**Utilisé par**:
- NowPlayingBar
- FullscreenPlayer
- VideosView

---

### 8. **Système d'Utilitaires UI** (`ui-utils`)
**Localisation**: `src/components/PageHeader.tsx`, `src/components/LoadingScreen.tsx`, `src/components/BackgroundEffects.tsx`, `src/components/LyricsDisplay.tsx`, `src/components/Equalizer.tsx`

**Composants**:
- `PageHeader` - En-tête de page
- `LoadingScreen` - Écran de chargement
- `BackgroundEffects` - Effets de fond
- `LyricsDisplay` - Affichage de paroles
- `Equalizer` - Égaliseur audio

**Responsabilités**:
- Composants utilitaires réutilisables
- Effets visuels
- Affichage de contenu spécialisé

**Interfaces**:
```typescript
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

interface LoadingScreenProps {
  message?: string;
  progress?: number;
}

interface BackgroundEffectsProps {
  track?: Track;
  intensity?: number;
}

interface LyricsDisplayProps {
  track: Track;
  currentTime: number;
  isPlaying: boolean;
}

interface EqualizerProps {
  enabled: boolean;
  preset: string;
  customBands: number[];
  onEnabledChange: (enabled: boolean) => void;
  onPresetChange: (preset: string) => void;
  onBandsChange: (bands: number[]) => void;
}
```

**Dépendances**:
- Track type (pour certains)
- UI Components

**Utilisé par**:
- Toutes les vues (PageHeader)
- DesktopApp (LoadingScreen, BackgroundEffects)
- FullscreenPlayer (LyricsDisplay)
- SettingsView (Equalizer)

---

### 9. **Système de Modals** (`modals`)
**Localisation**: `src/components/PlaylistModal.tsx`

**Composants**:
- `PlaylistModal` - Modal de création/édition de playlist

**Responsabilités**:
- Dialogs et modals
- Formulaires complexes

**Interfaces**:
```typescript
interface PlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlist?: Playlist;
  tracks?: Track[];
  onSave: (name: string, trackIds: string[]) => void;
}
```

**Dépendances**:
- Playlist/Track types
- UI Components (Dialog, Input, Button)

**Utilisé par**:
- Sidebar
- LibraryView

---

### 10. **Système UI de Base** (`ui-base`)
**Localisation**: `src/components/ui/`

**Composants**: 42 composants shadcn/ui
- Button, Input, Slider, Dialog, etc.

**Responsabilités**:
- Composants UI primitifs
- Design system
- Accessibilité

**Interfaces**:
- Props standardisées selon shadcn/ui
- Types exportés depuis chaque composant

**Dépendances**: Aucune (système de base)

**Utilisé par**: Tous les autres composants

---

## 🔗 Interconnexions

### Diagramme de dépendances

```
┌─────────────┐
│  DesktopApp │ (orchestrateur)
└──────┬──────┘
       │
       ├──> Sidebar
       ├──> TitleBar
       ├──> NowPlayingBar
       ├──> QueuePanel
       ├──> Views (Home, Library, etc.)
       └──> BackgroundEffects
       
┌─────────────┐
│   Views     │
└──────┬──────┘
       │
       ├──> PageHeader
       ├──> TrackList/TrackListView/TrackGridView
       ├──> Context Menus
       └──> UI Components
       
┌─────────────┐
│ TrackList   │
└──────┬──────┘
       │
       ├──> TrackContextMenu
       └──> UI Components
       
┌─────────────┐
│ NowPlayingBar│
└──────┬──────┘
       │
       ├──> PlayerControls
       ├──> ProgressBar
       ├──> AlbumArt
       └──> UI Components
       
┌─────────────┐
│ Fullscreen  │
└──────┬──────┘
       │
       ├──> AudioVisualizer
       ├──> LyricsDisplay
       ├──> BackgroundEffects
       └──> PlayerControls
```

---

## 🎯 Principes d'Architecture

### 1. **Indépendance des Composants**
- ✅ Chaque composant peut être utilisé isolément
- ✅ Props clairement définies
- ✅ Pas de dépendances circulaires
- ✅ Composants réutilisables

### 2. **Communication via Props**
- ✅ Props TypeScript typées
- ✅ Callbacks pour les actions
- ✅ État géré par le parent ou hooks
- ✅ Pas de state global (sauf hooks)

### 3. **Séparation des Responsabilités**
- ✅ Layout = Structure
- ✅ Views = Contenu
- ✅ Player = Lecture
- ✅ Context Menus = Actions
- ✅ UI Base = Primitives

### 4. **Composition**
- ✅ Composants composables
- ✅ Wrapper components (TrackList)
- ✅ Higher-order patterns
- ✅ Render props (si nécessaire)

### 5. **Performance**
- ✅ Lazy loading (VideosView, DownloadsView)
- ✅ React.memo pour TrackList
- ✅ Code splitting automatique
- ✅ Optimisations React

---

## 📝 Patterns Utilisés

### 1. **Container/Presentational Pattern**
- Views = Containers (logique + hooks)
- UI Components = Presentational (props seulement)

### 2. **Compound Components**
- Context Menus (Trigger + Content)
- UI Components (Dialog, Dropdown, etc.)

### 3. **Render Props**
- TrackList peut accepter des render props pour customisation

### 4. **Hooks Pattern**
- Logique métier dans hooks
- Composants = présentation pure

---

## ✅ Vérification de l'Architecture

### Indépendance
- ✅ Composants peuvent être remplacés individuellement
- ✅ Pas de dépendances circulaires
- ✅ Props clairement définies

### Interconnexion
- ✅ Communication via props TypeScript
- ✅ Hooks comme couche d'abstraction
- ✅ DesktopApp comme orchestrateur

### Maintenabilité
- ✅ Code organisé par responsabilité
- ✅ Composants réutilisables
- ✅ Types TypeScript partout

---

## 🔄 Flux de Données

### Affichage d'une piste

```
DesktopApp (state)
    ↓
LibraryView (props)
    ↓
TrackListView (props)
    ↓
TrackContextMenu (props)
    ↓
Actions (callbacks)
    ↓
Hooks (logique métier)
    ↓
Services (API calls)
```

### Lecture d'une piste

```
DesktopApp (state)
    ↓
NowPlayingBar (props)
    ↓
PlayerControls (props)
    ↓
Callbacks (onPlayPause, etc.)
    ↓
DesktopApp (state update)
    ↓
Audio Element (HTML5)
```

---

## 📚 Références

- [React Component Patterns](https://react.dev/learn)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [TypeScript React Props](https://www.typescriptlang.org/docs/handbook/react.html)

