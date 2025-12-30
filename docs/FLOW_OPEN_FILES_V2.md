# Parcours Complet: "Ouvrir des Fichiers" (Open Files) - Version Complète

**Document Date**: December 30, 2025  
**Status**: ✅ **Fichiers chargés en temps réel dans la queue**

---

## 🎯 Vue d'ensemble du flux

```
Utilisateur clique sur "Ouvrir des fichiers…"
        ↓
MenuBar dispatche custom event "nexus-open-files"
        ↓
DesktopApp écoute et lance handleOpenFilesEvent
        ↓
Affichage du sélecteur de fichiers audio
        ↓
Utilisateur sélectionne un ou plusieurs fichiers
        ↓
✨ CONVERSION EN TRACK OBJECTS
        ↓
✨ AJOUT À LA QUEUE
        ↓
✨ DÉMARRAGE DE LA LECTURE du premier fichier
        ↓
Toast de succès
```

---

## 📍 Étape 1: Déclenchement dans le Menu (MenuBar.tsx)

### Location: [MenuBar.tsx](src/components/MenuBar.tsx#L84-L88)

```tsx
const handleOpenFiles = () => {
  window.dispatchEvent(new CustomEvent("nexus-open-files", { detail: { multiple: true } }));
  setOpenMenu(null);
};
```

**Quoi**: Envoie le message global `nexus-open-files`  
**Où**: [MenuBar.tsx ligne 239](src/components/MenuBar.tsx#L239) - "Ouvrir des fichiers…"

---

## 📍 Étape 2: Event Listener Setup (DesktopApp.tsx)

### Location: [DesktopApp.tsx](src/components/DesktopApp.tsx#L1375-L1588)

**Enregistrement du listener** (ligne 1446):
```tsx
window.addEventListener('nexus-open-files', handleOpenFilesEvent);
```

---

## 📍 Étape 3: Handler Exécuté & Fichiers Chargés (DesktopApp.tsx ligne 1428-1487)

### 3.1 Création du sélecteur de fichiers
```tsx
const input = document.createElement('input');
input.type = 'file';
input.multiple = true;
input.accept = 'audio/*';
```

### 3.2 Gestion de la sélection - CONVERSION & CHARGEMENT
```tsx
input.onchange = async (e) => {
  const files = Array.from((e.target as HTMLInputElement).files || []);
  if (files.length === 0) return;
```

#### 3.2.1 Conversion en Track Objects
```tsx
const newTracks: Track[] = files.map((file, index) => {
  // Extraire "title - artist" du nom du fichier
  const fileName = file.name.replace(/\.[^/.]+$/, "");
  // "Bohemian Rhapsody - Queen.mp3" → "Bohemian Rhapsody - Queen"
  
  const [title, artist] = fileName.includes('-') 
    ? fileName.split('-').map(s => s.trim())
    : [fileName, 'Unknown Artist'];
  // Si pas de tiret, le nom complet devient le titre
  
  // Créer une URL blob pour lire le fichier
  const fileUrl = URL.createObjectURL(file);
  
  return {
    id: `local-${Date.now()}-${index}-${Math.random()}`,
    title: title || 'Unknown Track',
    artist: artist || 'Unknown Artist',
    album: 'Local Files',
    duration: 0, // Sera défini quand l'audio est chargé
    coverUrl: '',
    mediaSource: 'local',    // ← Source locale
    filePath: fileUrl,       // ← URL blob du fichier
    addedAt: new Date().toISOString(),
  };
});
```

**Exemple de transformation**:
```
Fichier: "Bohemian Rhapsody - Queen.mp3"
                    ↓
fileName: "Bohemian Rhapsody - Queen"
                    ↓
title: "Bohemian Rhapsody"
artist: "Queen"
fileUrl: "blob:http://localhost:3000/a1b2c3d4-e5f6-7890..."
                    ↓
Track Object:
{
  id: "local-1735603200000-0-0.123456",
  title: "Bohemian Rhapsody",
  artist: "Queen",
  album: "Local Files",
  mediaSource: "local",
  filePath: "blob:http://localhost:3000/a1b2c3d4-e5f6-7890...",
  ...
}
```

#### 3.2.2 Ajout à la Queue
```tsx
if (newTracks.length > 0) {
  // Ajouter les tracks à la file
  addToQueue(newTracks);
  
  // Jouer le premier fichier ajouté
  setCurrentIndex(queue.tracks.length);
  
  // Notification de succès
  toast.success(`${newTracks.length} fichier(s) ajouté(s) à la file`);
  console.log('[DesktopApp] Tracks loaded:', newTracks.length);
}
```

**Étapes**:
1. `addToQueue(newTracks)` - Ajoute les tracks à l'état global
2. `setCurrentIndex(queue.tracks.length)` - Définit l'index de lecture
3. Toast de succès - Feedback utilisateur

### 3.3 Activation du dialogue
```tsx
input.click();
```
- Déclenche le dialogue du système d'exploitation

### 3.4 Gestion des erreurs
```tsx
catch (err) {
  console.error('[DesktopApp] Error opening files:', err);
  toast.error('Erreur lors du traitement des fichiers');
}
```

---

## 🔄 Flux Complet Temporel

```
[T=0ms]   Utilisateur clique "Ouvrir des fichiers…"
          │
[T=1ms]   MenuBar.handleOpenFiles()
          │ window.dispatchEvent('nexus-open-files')
          │
[T=2ms]   DesktopApp listener déclenché
          │ handleOpenFilesEvent()
          │
[T=3ms]   Création <input type="file">
          │ input.click()
          │
[T=4ms]   └─ DIALOGUE SYSTÈME OUVERT

[T=5000ms+] Utilisateur sélectionne 3 fichiers MP3
            │
[T=5100ms]  Fichiers reçus dans onchange
            │ Extraction des noms
            │
[T=5150ms]  Conversion en 3 Track Objects
            │ Création d'URLs blob
            │
[T=5200ms]  addToQueue(3 tracks)
            │ setCurrentIndex()
            │
[T=5250ms]  ✅ Toast: "3 fichier(s) ajouté(s) à la file"
            │
[T=5300ms]  🎵 LECTURE DÉMARRE (premier fichier)
```

---

## 📊 Diagramme d'Architecture Complet

```
┌──────────────────────────────┐
│      UTILISATEUR             │
│   Sélectionne 3 fichiers MP3 │
└──────────────┬───────────────┘
               │
               │ Fichiers sélectionnés
               ▼
┌──────────────────────────────┐
│   FILE INPUT (DOM)           │
│   onchange triggered         │
└──────────────┬───────────────┘
               │
               │ Array.from(files)
               ▼
        ┌─────────────────┐
        │  3 FILE OBJECTS │
        │  - song1.mp3    │
        │  - song2.mp3    │
        │  - song3.mp3    │
        └────────┬────────┘
                 │
        ┌────────▼─────────────────────────┐
        │  CONVERSION EN TRACKS             │
        │  .map((file) => {                 │
        │    extract filename               │
        │    split by "-"                   │
        │    create blob URL                │
        │    return Track object            │
        │  })                               │
        └────────┬─────────────────────────┘
                 │
        ┌────────▼──────────────────┐
        │  3 TRACK OBJECTS CREATED  │
        │  {                         │
        │    id: "local-...",        │
        │    title: "Song 1",        │
        │    artist: "Artist 1",     │
        │    mediaSource: "local",   │
        │    filePath: "blob:...",   │
        │  },                        │
        │  ... (2 more tracks)       │
        └────────┬──────────────────┘
                 │
        ┌────────▼────────────────────────────┐
        │  AJOUT À LA QUEUE                    │
        │  addToQueue(newTracks)               │
        │  setCurrentIndex(queue.tracks.len)   │
        └────────┬────────────────────────────┘
                 │
        ┌────────▼──────────────────┐
        │   QUEUE STATE UPDATED     │
        │   (3 tracks ajoutés)      │
        └────────┬──────────────────┘
                 │
        ┌────────▼──────────────────────┐
        │  LECTURE DÉMARRE              │
        │  (first track plays)          │
        │  🎵 Song 1 - Artist 1        │
        └───────────────────────────────┘
```

---

## 🎵 État de la Queue Avant/Après

### Avant:
```
queue.tracks = [
  { id: "youtube-123", title: "Video Song", mediaSource: "youtube" },
  { id: "spotify-456", title: "Another Song", mediaSource: "youtube" }
]
queue.currentIndex = 0
```

### Après sélection de 3 fichiers:
```
queue.tracks = [
  { id: "youtube-123", title: "Video Song", mediaSource: "youtube" },
  { id: "spotify-456", title: "Another Song", mediaSource: "youtube" },
  { id: "local-1735603200000-0-0.123", title: "Bohemian Rhapsody", 
    artist: "Queen", mediaSource: "local", filePath: "blob:..." },
  { id: "local-1735603200000-1-0.456", title: "Stairway to Heaven", 
    artist: "Led Zeppelin", mediaSource: "local", filePath: "blob:..." },
  { id: "local-1735603200000-2-0.789", title: "Hotel California", 
    artist: "Eagles", mediaSource: "local", filePath: "blob:..." }
]
queue.currentIndex = 2  // Commence à jouer le premier fichier ajouté
```

---

## 🔗 Intégration avec le Lecteur Audio

Quand `mediaSource: 'local'` et `filePath: "blob:..."`:

1. **DesktopApp reçoit currentTrack** avec `filePath: "blob:..."`
2. **getAudioSrc()** utilise le blob URL
3. **HTMLAudioElement.src** = blob URL
4. **Lecture démarre** avec le blob du fichier local

```tsx
// Dans DesktopApp - quand currentTrack.mediaSource === 'local'
if (audioRef.current && currentTrack?.filePath) {
  audioRef.current.src = currentTrack.filePath;  // blob URL
  audioRef.current.play();
}
```

---

## ✅ Ce qui fonctionne maintenant

✅ **Sélection de fichiers audio multiples**
✅ **Conversion en Track objects avec extraction titre/artiste**
✅ **Création d'URLs blob pour le fichier**
✅ **Ajout à la queue de lecture**
✅ **Démarrage automatique du premier fichier**
✅ **Toast de feedback utilisateur**
✅ **Gestion d'erreurs complète**
✅ **Logs détaillés en console**

---

## 🚀 État de Lecture

Après avoir sélectionné les fichiers:

```
Nowplaying Bar affiche:
┌─────────────────────────────────────┐
│  🎵 Bohemian Rhapsody               │
│     Queen - Local Files             │
│     [▶] [01:23 / 05:55]              │
│     Volume: 🔊 70%                   │
└─────────────────────────────────────┘

Queue Panel affiche:
1. ✓ Bohemian Rhapsody - Queen
2. → Stairway to Heaven - Led Zeppelin
3.    Hotel California - Eagles
```

---

## 📝 Points Clés à Retenir

1. **Custom Event Pattern**: MenuBar dispatche → DesktopApp écoute
2. **Global Scope**: L'événement utilise `window` (accessible partout)
3. **Blob URLs**: Créées avec `URL.createObjectURL(file)` pour lecture locale
4. **Track Objects**: Tous les fichiers convertis en objets Track standardisés
5. **Queue Integration**: Utilise `addToQueue()` du hook `useQueue`
6. **Auto-play**: Le premier fichier est automatiquement sélectionné
7. **Non-Bloquant**: Les opérations utilisent async/await
8. **User Feedback**: Toast pour chaque action importante

---

**Last Updated**: December 30, 2025  
**Version**: 2.0 - Avec chargement réel en queue
