# Système de Récupération Automatique des Tracks YouTube

## Problème résolu

Quand des tracks YouTube sont enregistrés dans les favoris, l'historique ou les playlists, mais que leur cache local est perdu (redémarrage, nettoyage du cache, etc.), ces tracks disparaissent de l'interface utilisateur.

## Solution

Un système de récupération automatique qui :

1. **Détecte les tracks YouTube manquants** dans les favoris, historique et playlists
2. **Extrait leur `youtubeVideoId`** depuis l'ID du track
3. **Lance une recherche en arrière-plan** via l'API YouTube
4. **Recharge les métadonnées** et met à jour le cache local

## Architecture

### Fichiers impliqués

- **`src/lib/youtube-track-recovery.ts`** : Système principal de récupération
  - `recoverMissingYouTubeTrack()` : Récupère un track individuel
  - `recoverMissingYouTubeTracks()` : Récupère plusieurs tracks en batch
  - `queueTrackRecovery()` : Ajoute des tracks à une queue de traitement différé

- **`src/lib/track-resolver.ts`** : Résolution de tracks avec récupération automatique
  - `getTrackFromAllOrCache()` : Modifié pour lancer une récupération si le track n'est pas trouvé

- **`src/lib/history-utils.ts`** : Mapping de l'historique avec récupération
  - `mapHistoryEntriesToTracks()` : Détecte et récupère les tracks YouTube manquants

- **`src/components/DesktopApp.tsx`** : Point d'entrée principal
  - Récupération batch au démarrage de l'app (après 2 secondes)

### Flux de récupération

```
┌─────────────────────────────────────────────────────────┐
│  Utilisateur ouvre l'app                                │
│  ↓                                                       │
│  DesktopApp charge favoris, historique, playlists       │
│  ↓                                                       │
│  Détecte les IDs de tracks non présents dans allTracks  │
│  ↓                                                       │
│  Filtre uniquement les tracks YouTube                   │
│  ↓                                                       │
│  Lance recoverMissingYouTubeTracks() en batch           │
│  ↓                                                       │
│  Pour chaque track:                                     │
│    1. Extrait videoId de l'ID du track                 │
│    2. Appelle YouTube.getVideo(videoId)                │
│    3. Convertit YouTubeVideo → Track                    │
│    4. Cache le track (localStorage + Redis)            │
│  ↓                                                       │
│  Les tracks apparaissent dans l'UI                      │
└─────────────────────────────────────────────────────────┘
```

### Modes de récupération

#### 1. Récupération au démarrage (Batch)
- Lancée 2 secondes après le chargement de l'app
- Récupère tous les tracks YouTube manquants d'un coup
- Optimisé pour minimiser les appels API

```typescript
// Dans DesktopApp.tsx
useEffect(() => {
  const timer = setTimeout(async () => {
    const missingIds = [...]; // Collecter tous les IDs manquants
    await recoverMissingYouTubeTracks(missingIds);
  }, 2000);
  return () => clearTimeout(timer);
}, [favorites, history, playlists]);
```

#### 2. Récupération à la demande (Queue)
- Lancée quand un track spécifique est demandé
- Traite les tracks par batches de 10
- N'utilise pas de quota si déjà en cours

```typescript
// Dans track-resolver.ts
if (isYouTubeTrackId(trackId)) {
  queueTrackRecovery([trackId]);
}
```

## Formats d'ID supportés

Le système reconnaît plusieurs formats d'ID de tracks YouTube :

- `youtube-audio-{videoId}` (format standard)
- `youtube-{videoId}` (format alternatif)
- `yt-track-{videoId}` (format court)
- `{videoId}` (ID direct de 11 caractères)
- URLs YouTube complètes

## Configuration

### Variables d'environnement

```env
# Activer les logs de debug pour la récupération YouTube
NEXT_PUBLIC_DEBUG_YOUTUBE_RECOVERY=true
```

### Clé API YouTube

La récupération utilise automatiquement :
1. La clé stockée dans `localStorage` (`nexus-youtube-api-key`)
2. La variable d'environnement `NEXT_PUBLIC_YOUTUBE_API_KEY` si disponible

## Gestion du quota API

- Les récupérations utilisent le système de quota existant
- Les vidéos déjà en cache ne consomment pas de quota
- Les batches sont limités à 10 tracks pour éviter les timeouts

## Limitations

### Tracks locaux
Ce système fonctionne **uniquement pour les tracks YouTube**. Les tracks locaux utilisent un ID généré qui ne peut pas être résolu s'ils n'existent plus sur le disque.

### Vidéos supprimées
Si une vidéo YouTube est supprimée ou rendue privée, la récupération échouera silencieusement et le track restera manquant.

## Monitoring

### Logs de debug

Avec `NEXT_PUBLIC_DEBUG_YOUTUBE_RECOVERY=true` :

```
[YouTubeRecovery] 🔄 Récupération de youtube-audio-abc123 (videoId: abc123)
[YouTubeRecovery] ✅ Track youtube-audio-abc123 récupéré et mis en cache
[YouTubeRecovery] 📦 Batch récupération de 5 tracks
[YouTubeRecovery] ✅ 5/5 tracks récupérés
```

### Logs d'erreur

```
[YouTubeRecovery] ❌ Vidéo abc123 introuvable
[YouTubeRecovery] Erreur lors de la récupération de youtube-audio-abc123: API quota exceeded
```

## Tests

Pour tester le système :

1. Ajouter des tracks YouTube aux favoris
2. Vider le cache localStorage (`nexus-youtube-tracks-cache`)
3. Recharger l'app
4. Observer les logs : les tracks devraient être récupérés automatiquement

## Performance

- **Démarrage initial** : +2 secondes de délai (non bloquant)
- **Récupération batch** : ~500ms par batch de 10 tracks
- **Cache** : Les tracks récupérés sont immédiatement disponibles
- **Pause entre batches** : 500ms pour éviter de surcharger l'API

## Améliorations futures

- [ ] Retry automatique en cas d'échec
- [ ] Priorisation des tracks visibles (viewport)
- [ ] Persistance des échecs pour éviter les retries inutiles
- [ ] Support de la récupération incrémentale (streaming)
- [ ] Indicateur visuel de récupération en cours
