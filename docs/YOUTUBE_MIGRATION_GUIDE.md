# 🔄 Guide de Migration vers YouTubeService

Ce guide vous aide à migrer votre code existant vers le nouveau service centralisé `YouTubeService`.

## 📋 Pourquoi migrer ?

Le service centralisé offre :
- ✅ **API unifiée** : Un seul point d'entrée pour toutes les opérations YouTube
- ✅ **Meilleure maintenabilité** : Code centralisé et cohérent
- ✅ **Tests centralisés** : Plus facile à tester et déboguer
- ✅ **Évolutivité** : Facile d'ajouter de nouvelles fonctionnalités

## 🔧 Migration par Cas d'Usage

### 1. Recherche de Vidéos

#### Avant
```typescript
import { useYouTubeSearch } from '@/hooks/useYouTubeSearch';

const { results, loading, search } = useYouTubeSearch();
await search('query');
```

#### Après
```typescript
import { youtubeService } from '@/services/youtube-service';

const { results, source, error } = await youtubeService.searchVideos('query', {
  maxResults: 20,
  useCache: true,
  fallbackToHistory: true,
});
```

### 2. Récupération de Métadonnées

#### Avant
```typescript
import { youtubeProvider } from '@/services/youtube-provider';

const result = await youtubeProvider.getVideoMetadata('video-id');
```

#### Après
```typescript
import { youtubeService } from '@/services/youtube-service';

const { success, metadata, source } = await youtubeService.getVideoMetadata('video-id');
```

### 3. Conversion en Video/Track

#### Avant
```typescript
import { convertToVideo } from '@/hooks/useYouTubeSearch';
import { youtubeVideoToTrack } from '@/lib/youtube-to-track';

const video = convertToVideo(searchResult);
const track = youtubeVideoToTrack(searchResult, channelTitle);
```

#### Après
```typescript
import { youtubeService } from '@/services/youtube-service';

const video = youtubeService.searchResultToVideo(searchResult);
const track = youtubeService.searchResultToTrack(searchResult);
```

### 4. Vérification de l'État

#### Avant
```typescript
import { youtubeQuotaManager } from '@/services/youtube-quota-manager';

const canUse = youtubeQuotaManager.canUseAPI();
const state = youtubeQuotaManager.getState();
const message = youtubeQuotaManager.getUXMessage();
```

#### Après
```typescript
import { youtubeService } from '@/services/youtube-service';

const status = youtubeService.getSystemStatus();
// status.quotaState, status.canUseAPI, status.message
```

### 5. Opérations Batch

#### Avant
```typescript
import { youtubeBatchService } from '@/services/youtube-batch';

const videos = await youtubeBatchService.getVideosBatch(videoIds);
```

#### Après
```typescript
import { youtubeService } from '@/services/youtube-service';

const videos = await youtubeService.getVideosBatch(videoIds);
```

## 📝 Checklist de Migration

- [ ] Remplacer les imports de `useYouTubeSearch` par `youtubeService.searchVideos`
- [ ] Remplacer les imports de `youtubeProvider` par `youtubeService.getVideoMetadata`
- [ ] Remplacer les conversions manuelles par `youtubeService.searchResultToVideo/Track`
- [ ] Remplacer les vérifications de quota par `youtubeService.getSystemStatus`
- [ ] Remplacer les appels batch par `youtubeService.getVideosBatch`
- [ ] Tester chaque fonctionnalité migrée
- [ ] Vérifier que les fallbacks fonctionnent correctement

## ⚠️ Notes Importantes

1. **Compatibilité** : Les services existants continuent de fonctionner, la migration peut être progressive
2. **Hooks React** : Les hooks comme `useYouTubeSearch` peuvent toujours être utilisés pour la compatibilité React
3. **Cache** : Le cache est géré automatiquement par le service centralisé
4. **Fallback** : Les fallbacks sont activés par défaut pour garantir une UX continue

## 🧪 Tests

Après migration, exécutez les tests :

```bash
npm run test
```

Les tests couvrent :
- Service centralisé
- Gestionnaire de quota
- Système de cache
- Tests d'intégration complets

## 📚 Documentation

Pour plus d'informations, consultez :
- [Architecture YouTube](./YOUTUBE_ARCHITECTURE.md) - Documentation complète de l'architecture
- [Système YouTube Nexus](./NEXUS_YOUTUBE_SYSTEM.md) - Vue d'ensemble du système

