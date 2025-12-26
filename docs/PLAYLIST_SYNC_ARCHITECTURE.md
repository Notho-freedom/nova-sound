# 🔄 Synchronisation des Playlists - Architecture Complète

## 📡 Source de Vérité avec Firebase

### Flux de Synchronisation

```
┌─────────────────────────────────────────────────────────────────┐
│                         FIREBASE (Cloud)                         │
│                    (Source de vérité globale)                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ sync bidirectionnelle
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│             firebaseSyncService (Electron/Web)                   │
│  ├─ Écoute les changements Firebase                             │
│  ├─ Dispatch 'firebase-playlists-update' CustomEvent            │
│  └─ queueSync() envoie les changements locaux vers Firebase     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ écoute event
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│            usePlaylists() Hook (État Local)                      │
│  ├─ Écoute 'firebase-playlists-update'                          │
│  ├─ Écoute 'local-playlists-update'                             │
│  ├─ createPlaylist() → firebaseSyncService.queueSync()          │
│  ├─ updatePlaylist() → firebaseSyncService.queueSync()          │
│  └─ deletePlaylist() → firebaseSyncService.queueSync()          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ passe `playlists` prop
                           │
              ┌────────────┴────────────┐
              │                         │
    ┌─────────▼────────┐    ┌──────────▼──────────┐
    │   PlaylistView   │    │  Sidebar Component  │
    │  (Affichage +    │    │ (Navigation +       │
    │   Gestion)       │    │  Quick Access)      │
    └──────────────────┘    └─────────────────────┘
```

## 🏗️ Composants Clés

### 1. **usePlaylists** (`src/hooks/usePlaylists.ts`)
- **Responsabilité**: Gestion d'état des playlists + sync Firebase
- **État**: `playlists: Playlist[]`
- **Opérations CRUD**:
  - `createPlaylist(name, trackIds)` 
  - `updatePlaylist(id, data)`
  - `deletePlaylist(id)`
  - `addTracksToPlaylist(playlistId, trackIds)`
  - `removeTracksFromPlaylist(playlistId, trackIds)`
- **Synchronisation**: Émet `firebaseSyncService.queueSync('playlists', updated)`
- **Événements écoutés**:
  - `firebase-playlists-update` (depuis Firebase)
  - `local-playlists-update` (depuis d'autres composants)

### 2. **usePlaylistMetadata** (`src/hooks/usePlaylistMetadata.ts`)
- **Responsabilité**: Enrichir les playlists avec métadonnées visuelles
- **Entrées**: `playlists: Playlist[], tracks: Track[]`
- **Sorties**: `PlaylistMetadata[]` contenant:
  - `coverUrl`: URL de la première cover
  - `coverUrls`: Tableau des 4 premières covers
  - `totalDuration`: Durée totale en secondes
  - `artists`: Artistes uniques
  - `trackCount`: Nombre de tracks
- **Utilité**: Évite les calculs répétés dans les composants

### 3. **DesktopApp** (`src/components/DesktopApp.tsx`)
- **Responsabilité**: Orchestration centrale
- **État source**:
  ```tsx
  const { playlists, ... } = usePlaylists();
  const { libraryTracks, ... } = useLibrary();
  ```
- **Passe aux enfants**:
  ```tsx
  <Sidebar tracks={libraryTracks} playlists={playlists} ... />
  <PlaylistView tracks={libraryTracks} playlists={playlists} ... />
  ```

### 4. **PlaylistView** (`src/components/views/PlaylistView.tsx`)
- **Reçoit**: `playlists` prop + `tracks` prop
- **Affiche**:
  - Liste/grille des playlists avec métadonnées
  - Détails d'une playlist sélectionnée
  - Fonction édition/suppression
- **Appelle**: `onUpdatePlaylist()`, `onDeletePlaylist()` callbacks
- **Utilise**: `usePlaylistMetadata()` pour enrichir l'affichage

### 5. **Sidebar** (`src/components/Sidebar.tsx`)
- **Reçoit**: `playlists` prop + `tracks` prop
- **Affiche**: 
  - Tuiles des 5 premières playlists
  - Cover, nombre de titres, durée
  - "Voir tout" si > 5 playlists
- **Interactions**:
  - Play/shuffle playlist
  - Créer/éditer/supprimer
  - Navigue vers `playlists` view
- **Utilise**: `usePlaylistMetadata()` pour covers et durées

## 🔀 Flux de Données en Pratique

### Cas 1: Créer une Playlist

```
Utilisateur clique "Créer" → 
  Sidebar ou PlaylistView →
    appelle onCreatePlaylist(name, trackIds) →
      DesktopApp.handleCreatePlaylist() →
        createPlaylist() du hook →
          firebaseSyncService.queueSync('playlists', updated) →
            Firebase stocke la nouvelle playlist →
              firebaseSyncService reçoit confirmation →
                dispatch 'firebase-playlists-update' →
                  usePlaylists() met à jour state →
                    DesktopApp met à jour props →
                      PlaylistView et Sidebar re-rendent
```

### Cas 2: Supprimer une Playlist

```
Utilisateur clique "Supprimer" →
  PlaylistView ou Sidebar →
    appelle onDeletePlaylist(id) →
      DesktopApp.handleDeletePlaylist() →
        deletePlaylist(id) du hook →
          usePlaylists() crée updatedPlaylists (sans id) →
            firebaseSyncService.queueSync('playlists', updatedPlaylists) →
              Firebase supprime la playlist →
                firebaseSyncService reçoit confirmation →
                  dispatch 'firebase-playlists-update' →
                    usePlaylists() met à jour state →
                      DesktopApp met à jour props →
                        PlaylistView et Sidebar re-rendent
```

### Cas 3: Ajouter des Tracks à une Playlist

```
Utilisateur sélectionne tracks →
  PlaylistView →
    appelle onAddTracksToPlaylist(playlistId, trackIds) →
      DesktopApp →
        appelle updatePlaylist(id, { trackIds: [...old, ...new] }) →
          usePlaylists() →
            firebaseSyncService.queueSync('playlists', updated) →
              Firebase met à jour les trackIds →
                firebaseSyncService reçoit confirmation →
                  dispatch 'firebase-playlists-update' →
                    PlaylistView recharge playlistTracks
```

## 🎨 Enrichissement des Métadonnées

### Comment ça marche

```tsx
// Dans Sidebar ou PlaylistView:
const playlistMetadata = usePlaylistMetadata(playlists, tracks);

// Pour chaque playlist:
// 1. Trouve les tracks réels via trackIds
const playlistTracks = playlist.trackIds
  .map(id => tracks.find(t => t.id === id))
  .filter(Boolean);

// 2. Extrait les covers (max 4)
const coverUrls = playlistTracks
  .slice(0, 4)
  .map(t => getCoverUrl(t.coverUrl));

// 3. Calcule la durée totale
const totalDuration = playlistTracks
  .reduce((sum, t) => sum + t.duration, 0);

// 4. Récupère les artistes uniques
const artists = Array.from(
  new Set(playlistTracks.map(t => t.artist))
).sort();
```

### Résultat: Tuile Sidebar Enrichie

```
┌──────────────────────────────────┐
│  [Cover] My Cool Playlist        │
│          4 titres • 12m      [▶] │
└──────────────────────────────────┘

Affichage: 
- Cover: Image du premier track
- Nom: "My Cool Playlist"
- Compte: "4 titres"
- Durée: "12m" (si > 0)
- Bouton play: Actionnable
```

## 🔐 Garanties d'Intégrité

### 1. Pas de Duplication d'État
✅ **usePlaylists** = source unique
❌ Pas de hook séparé dans PlaylistView ou Sidebar
✅ Prop fallback: `const playlists = propPlaylists ?? hookPlaylists`

### 2. Synchronisation Cohérente
✅ Toutes les mutations passent par `firebaseSyncService.queueSync()`
✅ Firebase dispatch `firebase-playlists-update` event
✅ usePlaylists() écoute et met à jour state
✅ DesktopApp passe props à tous les enfants

### 3. Pas de Cache Stale
✅ Métadonnées recalculées quand `playlists` ou `tracks` change
✅ useMemo = recalcul automatique
✅ Covers toujours du premier track réel

### 4. Suppression Sûre
✅ deletePlaylist() filtre directement les playlists
✅ Pas de dépendance sur stale closure
✅ Event émis après la mise à jour complète

## 📊 Vérification du Flux

Pour vérifier que tout est synchronisé:

```typescript
// 1. DevTools: Vérifier usePlaylists() state
// Dans DesktopApp, console.log(playlists)

// 2. Vérifier que Sidebar reçoit la prop
// Dans Sidebar, console.log(propPlaylists)

// 3. Vérifier métadonnées enrichies
// console.log(usePlaylistMetadata(playlists, tracks))

// 4. Vérifier sync Firebase
// Dans firebase-sync.ts, voir les logs "⏳ FirebaseSync"

// 5. Vérifier événements
// window.addEventListener('firebase-playlists-update', console.log)
// window.addEventListener('local-playlists-update', console.log)
```

## 🚀 Prochaines Étapes Recommandées

1. **Ajouter affichage grille** dans PlaylistView avec 4 covers (`.slice(0, 4)`)
2. **Afficher durée totale** dans PlaylistView hero (utiliser `totalDuration`)
3. **Trier par durée/artistes** dans PlaylistView details
4. **Cache des métadonnées** si calcul trop lourd
5. **Validation syncro** en produit via logs Firebase

## Résumé Rapide

| Composant | Rôle | Sync Firebase |
|-----------|------|---------------|
| **usePlaylists** | État + CRUD | ✅ Oui (via queueSync) |
| **DesktopApp** | Orchestration | ✅ Via prop passing |
| **PlaylistView** | Affichage | ✅ Reçoit prop |
| **Sidebar** | Navigation | ✅ Reçoit prop |
| **usePlaylistMetadata** | Enrichissement | ✅ Recalcul auto |

**Clé**: Toujours passer `playlists` de DesktopApp, jamais utiliser le hook directement dans les composants enfants!
