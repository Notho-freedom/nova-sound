# 🎬 Intégration YouTube dans Nexus

## ✅ Conformité légale

Cette intégration utilise **uniquement l'API officielle YouTube IFrame Player**, ce qui est **100% conforme** aux conditions d'utilisation de YouTube.

**Ce que nous faisons :**
- ✅ Utilisation de l'API YouTube IFrame Player officielle
- ✅ Lecture via le player YouTube intégré
- ✅ Contrôle de l'expérience utilisateur (play, pause, volume, seek)
- ✅ Mode audio-only (masquage visuel de la vidéo)

**Ce que nous ne faisons PAS :**
- ❌ Téléchargement de flux vidéo/audio
- ❌ Extraction de contenu
- ❌ Re-streaming via proxy
- ❌ Utilisation de `youtube-dl` ou outils similaires

---

## 🧩 Architecture

```
VideoPlayer (composant unifié)
 ├── Détection automatique de la source média
 ├── YouTube → YouTubePlayer (API officielle)
 └── Local/Cloud → VideoElement HTML5 natif
```

---

## 📦 Composants créés

### 1. `src/lib/youtube.ts`
Utilitaires pour détecter et parser les URLs YouTube :
- `detectMediaSource()` - Détecte le type de source
- `isYouTubeUrl()` - Vérifie si une URL est YouTube
- `extractYouTubeVideoId()` - Extrait l'ID vidéo
- `parseYouTubeUrl()` - Parse une URL complète

### 2. `src/hooks/useYouTubePlayer.ts`
Hook React pour gérer le player YouTube :
- Chargement automatique de l'API IFrame
- Gestion de l'état (play, pause, volume, etc.)
- Contrôles unifiés

### 3. `src/components/YouTubePlayer.tsx`
Composant React pour le player YouTube :
- Intégration IFrame officielle
- Mode audio-only disponible
- Callbacks pour événements

### 4. `src/components/VideoPlayer.tsx` (modifié)
Détection automatique et intégration transparente :
- Détecte automatiquement si c'est YouTube
- Utilise YouTubePlayer ou VideoElement selon la source
- Interface unifiée pour toutes les sources

---

## 🔑 Configuration de la clé API YouTube (pour la recherche)

Pour utiliser la fonctionnalité de recherche YouTube, vous devez configurer une clé API YouTube Data v3 :

1. **Créer un projet Google Cloud** :
   - Allez sur https://console.cloud.google.com/
   - Créez un nouveau projet ou sélectionnez un projet existant

2. **Activer l'API YouTube Data v3** :
   - Dans le menu, allez dans "APIs & Services" > "Library"
   - Recherchez "YouTube Data API v3"
   - Cliquez sur "Enable"

3. **Créer une clé API** :
   - Allez dans "APIs & Services" > "Credentials"
   - Cliquez sur "Create Credentials" > "API Key"
   - Copiez la clé générée

4. **Configurer dans Nexus** :
   - Ajoutez la variable d'environnement `NEXT_PUBLIC_YOUTUBE_API_KEY` dans votre fichier `.env.local`
   - Ou configurez-la dans les paramètres de l'application (si implémenté)

**Note** : L'API YouTube Data v3 est gratuite jusqu'à 10 000 unités/jour, ce qui est largement suffisant pour un usage personnel.

---

## 🚀 Utilisation

### Ajouter une vidéo YouTube

```typescript
import { detectMediaSource, extractYouTubeVideoId } from "@/lib/youtube";

const video: Video = {
  id: "youtube-123",
  filePath: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  title: "Ma vidéo YouTube",
  duration: 0, // Sera mis à jour automatiquement
  fileSize: 0,
  addedAt: new Date().toISOString(),
  // Détection automatique
  mediaSource: detectMediaSource("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
  youtubeVideoId: extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
};
```

### Utiliser VideoPlayer (détection automatique)

```tsx
import { VideoPlayer } from "@/components/VideoPlayer";

<VideoPlayer
  video={video} // YouTube ou local, détection automatique
  autoPlay={true}
  showControls={true}
/>
```

### Utiliser YouTubePlayer directement

```tsx
import { YouTubePlayer } from "@/components/YouTubePlayer";

<YouTubePlayer
  videoId="dQw4w9WgXcQ"
  autoPlay={true}
  audioOnly={false} // Mode audio-only
  onReady={() => console.log("Player prêt")}
  onStateChange={(isPlaying) => console.log("Playing:", isPlaying)}
/>
```

---

## 🎧 Mode Audio-Only

Pour créer une expérience audio-first (comme Spotify) :

```tsx
<YouTubePlayer
  videoId="dQw4w9WgXcQ"
  audioOnly={true} // Masque la vidéo, affiche un visualizer
/>
```

**Comment ça marche :**
- L'iframe YouTube est rendue invisible (opacity: 0, scale: 0.1)
- Vous pouvez afficher un visualizer audio par-dessus
- L'utilisateur reste dans Nexus, pas de redirection

---

## 🔧 Types étendus

Les types `Video` et `Track` supportent maintenant :

```typescript
interface Video {
  // ... propriétés existantes
  mediaSource?: 'local' | 'youtube' | 'cloudinary' | 'nexus' | 'bunny' | 'planethoster' | 'soundcloud' | 'vimeo' | 'unknown';
  youtubeVideoId?: string;
}
```

---

## 🎯 Détection automatique

`VideoPlayer` détecte automatiquement la source :

1. **YouTube** → Utilise `YouTubePlayer` (API officielle)
2. **Local** → Utilise `<video>` HTML5 natif
3. **Cloud** → Utilise `<video>` HTML5 avec URL cloud

Aucune configuration supplémentaire nécessaire !

---

## 📝 Exemple complet

```typescript
// Créer une vidéo YouTube
const youtubeVideo: Video = {
  id: "yt-1",
  filePath: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  title: "Never Gonna Give You Up",
  duration: 0,
  fileSize: 0,
  addedAt: new Date().toISOString(),
  mediaSource: 'youtube',
  youtubeVideoId: 'dQw4w9WgXcQ',
};

// Utiliser dans VideoPlayer
<VideoPlayer
  video={youtubeVideo}
  videos={[youtubeVideo]}
  autoPlay={false}
  showControls={true}
/>
```

---

## ⚠️ Limitations YouTube

- **Pas de téléchargement** : Le contenu reste sur les serveurs YouTube
- **Publicité** : Les pubs YouTube peuvent apparaître (sauf Premium)
- **Qualité** : Contrôlée par YouTube selon la connexion
- **Disponibilité** : Dépend de la disponibilité de la vidéo sur YouTube

---

## 🔐 Sécurité

- ✅ Aucune clé API requise
- ✅ Pas de stockage de contenu
- ✅ Conforme aux ToS YouTube
- ✅ Pas de proxy ou contournement

---

## 🎨 Personnalisation

Vous pouvez personnaliser l'expérience via :

1. **Mode audio-only** : `audioOnly={true}`
2. **Contrôles personnalisés** : Utilisez les callbacks
3. **Visualizer** : Ajoutez un visualizer audio par-dessus
4. **Thème** : Stylez l'overlay audio-only

---

## 🐛 Dépannage

**Le player ne se charge pas :**
- Vérifiez la connexion internet
- Vérifiez que l'URL YouTube est valide
- Vérifiez la console pour les erreurs

**La vidéo ne joue pas :**
- Vérifiez que la vidéo n'est pas privée/restreinte
- Vérifiez les restrictions géographiques
- Vérifiez que l'ID vidéo est correct

**Erreurs TypeScript :**
- Assurez-vous que les types YouTube sont disponibles
- Vérifiez que `window.YT` est défini après chargement

---

## 📚 Ressources

- [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)
- [Conditions d'utilisation YouTube](https://www.youtube.com/static?template=terms)
- [Documentation API YouTube](https://developers.google.com/youtube)

---

**✅ Intégration 100% légale et conforme aux ToS YouTube**
