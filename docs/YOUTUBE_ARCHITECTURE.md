# 🎬 Architecture YouTube Nexus - Documentation Complète

## 📋 Vue d'ensemble

Le système YouTube de Nexus est une architecture hybride intelligente qui garantit :
- ✅ **Lecture YouTube fonctionne TOUJOURS** (même sans quota)
- ✅ **Réduction maximale** de consommation quota API
- ✅ **UX continue** (zéro écran d'erreur)
- ✅ **100% légal** en production

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         SYSTÈME YOUTUBE NEXUS                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │ SERVICE CENTRAL (src/services/youtube-service.ts)                  │     │
│  ├──────────────────────────────────────────────────────────────────────┤     │
│  │ Point d'entrée unifié pour toutes les opérations YouTube            │     │
│  │ - Recherche                                                          │     │
│  │ - Métadonnées                                                        │     │
│  │ - Cache                                                              │     │
│  │ - Batch operations                                                   │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │ SERVICES SPÉCIALISÉS (src/services/)                                │     │
│  ├──────────────────────────────────────────────────────────────────────┤     │
│  │ youtube-provider.ts  → Router intelligent (cache→oembed→api→fallback)│     │
│  │ youtube-cache.ts     → Cache L1 (RAM) + L2 (Firebase) multi-niveaux │     │
│  │ youtube-quota-manager.ts → Circuit breaker + budget journalier      │     │
│  │ youtube-oembed.ts    → Métadonnées NO-QUOTA via oEmbed              │     │
│  │ youtube-prefetch.ts  → Préchargement intelligent en arrière-plan    │     │
│  │ youtube-batch.ts     → Opérations batch pour économiser quota       │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │ UTILITAIRES (src/lib/)                                               │     │
│  ├──────────────────────────────────────────────────────────────────────┤     │
│  │ youtube.ts           → Détection/parsing URLs, extraction videoId   │     │
│  │ youtube-suggestions.ts → Tendances, suggestions basées historique  │     │
│  │ youtube-artist-search.ts → Recherche par artiste                    │     │
│  │ youtube-metadata.ts  → Extraction métadonnées                       │     │
│  │ youtube-to-track.ts  → Conversion Video → Track                     │     │
│  │ youtube-playlists.ts → Gestion playlists YouTube                    │     │
│  │ youtube-track-cache.ts → Cache tracks audio                         │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │ HOOKS (src/hooks/)                                                   │     │
│  ├──────────────────────────────────────────────────────────────────────┤     │
│  │ useYouTubeSearch.ts      → Recherche avec cache + fallback          │     │
│  │ useYouTubeAutocomplete.ts → Autocomplétion + historique             │     │
│  │ useYouTubePlayer.ts      → API IFrame YouTube                       │     │
│  │ useYouTubeSimilarTracks.ts → Suggestions similaires                 │     │
│  │ useYouTubeSuggestions.ts → Suggestions générales                    │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │ COMPOSANTS (src/components/)                                         │     │
│  ├──────────────────────────────────────────────────────────────────────┤     │
│  │ YouTubePlayer.tsx        → Player IFrame officiel                   │     │
│  │ YouTubeSearchView.tsx    → Page de recherche YouTube                │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Pipeline de Routage Intelligent

### 1. Récupération de Métadonnées

```
getVideoMetadata(videoId)
    ↓
1. Cache L1 (mémoire) - NO QUOTA
    ↓ (si miss)
2. Cache L2 (Firestore) - NO QUOTA
    ↓ (si miss)
3. oEmbed YouTube - NO QUOTA
    ↓ (si miss)
4. YouTube Data API - QUOTA (si disponible)
    ↓ (si échec)
5. Fallback minimal - NO QUOTA
```

### 2. Recherche de Vidéos

```
searchVideos(query)
    ↓
1. Cache (recherche précédente) - NO QUOTA
    ↓ (si miss)
2. YouTube Data API - QUOTA (si disponible)
    ↓ (si échec/quota épuisé)
3. Fallback historique (recherches similaires) - NO QUOTA
```

## 🎯 Service Central : YouTubeService

Le service centralisé `youtubeService` unifie toutes les opérations YouTube :

```typescript
import { youtubeService } from '@/services/youtube-service';

// Récupérer les métadonnées
const metadata = await youtubeService.getVideoMetadata('video-id');

// Rechercher des vidéos
const results = await youtubeService.searchVideos('query', {
  maxResults: 20,
  useCache: true,
  fallbackToHistory: true,
});

// Convertir en Video
const video = youtubeService.searchResultToVideo(results.results[0]);

// Convertir en Track
const track = youtubeService.searchResultToTrack(results.results[0]);

// Vérifier l'état du système
const status = youtubeService.getSystemStatus();
```

## 💾 Système de Cache Multi-Niveaux

### Cache L1 (Mémoire)
- **TTL** : 12h pour vidéos, 7 jours pour recherches
- **Max size** : 1000 vidéos, 500 recherches
- **Nettoyage** : LRU (Least Recently Used)

### Cache L2 (Firestore)
- **TTL adaptatif** :
  - Vidéos très populaires (>10M vues) : 7 jours
  - Vidéos populaires (>1M vues) : 3 jours
  - Vidéos normales : 12h
- **Compression** : Descriptions tronquées, tags limités

## 🔌 Circuit Breaker

Le système de circuit breaker protège contre les surcharges :

- **Seuil** : 3 échecs consécutifs
- **État** : Circuit ouvert pendant 5 minutes
- **Reset automatique** : Après 5 minutes ou premier succès

## 📊 Gestion du Quota

### Budgets Journaliers
- **Quota total** : 10 000 unités/jour
- **Budget recherche** : 1 000 unités (10 recherches max)
- **Budget métadonnées** : 8 000 unités
- **Budget batch** : 1 000 unités

### États du Quota
- **OK** : < 80% utilisé
- **LOW** : 80-95% utilisé
- **EXHAUSTED** : > 95% utilisé ou circuit breaker ouvert

## 🧪 Tests

### Tests Unitaires
- `youtube-service.test.ts` - Service central
- `youtube-quota-manager.test.ts` - Gestionnaire de quota
- `youtube-cache.test.ts` - Système de cache

### Tests d'Intégration
- Tests end-to-end du pipeline complet
- Tests de fallback et résilience

## 🔧 Utilisation

### Recherche de Vidéos

```typescript
import { youtubeService } from '@/services/youtube-service';

const { results, source, error } = await youtubeService.searchVideos('query', {
  maxResults: 20,
  useCache: true,
  fallbackToHistory: true,
});

if (results.length > 0) {
  const video = youtubeService.searchResultToVideo(results[0]);
  // Utiliser la vidéo
}
```

### Récupération de Métadonnées

```typescript
const { success, metadata, source } = await youtubeService.getVideoMetadata('video-id');

if (success && metadata) {
  console.log(`Titre: ${metadata.title}`);
  console.log(`Source: ${source}`); // 'cache', 'oembed', 'api', ou 'fallback'
}
```

### Vérification de l'État

```typescript
const status = youtubeService.getSystemStatus();

if (status.quotaState === 'EXHAUSTED') {
  console.log('Quota épuisé, mode lecture optimisé');
}

if (status.message) {
  console.log(status.message);
}
```

## 🚀 Migration vers le Service Central

Pour migrer du code existant vers le service central :

### Avant
```typescript
import { youtubeProvider } from '@/services/youtube-provider';
import { youtubeCacheService } from '@/services/youtube-cache';

const metadata = await youtubeProvider.getVideoMetadata('video-id');
const cached = await youtubeCacheService.getVideo('video-id');
```

### Après
```typescript
import { youtubeService } from '@/services/youtube-service';

const { metadata } = await youtubeService.getVideoMetadata('video-id');
// Le cache est géré automatiquement
```

## 📝 Notes Importantes

1. **Lecture toujours disponible** : La lecture YouTube via IFrame API fonctionne TOUJOURS, même sans quota
2. **Cache prioritaire** : Le cache est toujours vérifié en premier pour économiser le quota
3. **Fallback intelligent** : En cas d'échec, le système utilise des fallbacks (oEmbed, historique, etc.)
4. **Circuit breaker** : Protège contre les surcharges et réinitialise automatiquement

## 🔐 Conformité Légale

- ✅ Utilisation de l'API YouTube IFrame Player officielle
- ✅ Respect des conditions d'utilisation YouTube
- ✅ Pas de téléchargement de flux
- ✅ Pas d'extraction de contenu
- ✅ Pas de re-streaming via proxy

