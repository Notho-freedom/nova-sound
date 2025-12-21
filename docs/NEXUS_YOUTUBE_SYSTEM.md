# 🧠 Nexus YouTube System - Architecture Hybride QUOTA/NO-QUOTA

## 🎯 Objectif

Système intelligent qui garantit :
- ✅ **Lecture YouTube fonctionne TOUJOURS** (même sans quota)
- ✅ **Réduction maximale** de consommation quota API
- ✅ **UX continue** (zéro écran d'erreur)
- ✅ **100% légal** en production

---

## 🧩 Principe Clé

**La lecture YouTube ne consomme PAS de quota**  
**Seules les APIs data consomment du quota**

Séparation claire :
- 🟢 **DATA (quota)** : Métadonnées, recherches, statistiques
- 🟢 **PLAYBACK (no-quota)** : Lecture via YouTube IFrame API

---

## 🔁 Architecture Nexus - Dual Mode

```
┌─────────────────────┐
│  Nexus Player UI    │
└─────────┬───────────┘
          ↓
┌──────────────────────────┐
│  YouTubeProvider          │
│  (Routing Intelligent)    │
└─────────┬────────────────┘
          ↓
┌────────────────────────────────────────┐
│ ROUTING INTELLIGENT                     │
│                                        │
│ 1️⃣ Cache local/DB (no quota)          │
│ 2️⃣ oEmbed YouTube (no quota)          │
│ 3️⃣ YouTube Data API (quota)           │
│ 4️⃣ Fallback embed only (no quota)     │
└────────────────────────────────────────┘
```

---

## 🟢 MODE A — Quota disponible

**Utilisé une seule fois par contenu**

### Pipeline

1. Appel YouTube API
2. Récupération :
   - titre
   - durée
   - thumbnail HD
   - channel
3. Stockage DB / cache long TTL (adaptatif selon popularité)
4. Lecture via iframe (no quota)

📦 **Coût** : **1 requête / vidéo / 24–72h**

---

## 🟠 MODE B — Quota expiré

**Aucun appel API**

### Pipeline

1. Lookup cache DB
2. Sinon : oEmbed YouTube (no quota)
3. Sinon : lecture iframe directe
4. UI dégradée légère (mais lecture OK)

🔥 **La lecture fonctionne toujours**

---

## 🔑 Composants Techniques

### 1. QuotaManager (`youtube-quota-manager.ts`)

**Circuit breaker avec états** :
- `OK` : Quota disponible (< 80% utilisé)
- `LOW` : Quota limité (80-95% utilisé)
- `EXHAUSTED` : Quota épuisé (> 95% ou circuit breaker ouvert)

**Fonctionnalités** :
- Watchdog journalier (reset automatique)
- Backoff exponentiel (circuit breaker)
- Enregistrement succès/échecs
- Reset automatique après 5 minutes

### 2. oEmbed Service (`youtube-oembed.ts`)

**Métadonnées sans quota** :
- Endpoint : `https://www.youtube.com/oembed?url=VIDEO_URL&format=json`
- Cache 24h
- Données limitées (pas de duration/viewCount)

### 3. YouTubeProvider (`youtube-provider.ts`)

**Routing intelligent** :

1. **Cache (L1/L2)** - NO QUOTA
   - L1 : Mémoire (12h TTL)
   - L2 : Firestore (TTL adaptatif selon popularité)

2. **oEmbed** - NO QUOTA
   - Fallback si cache vide
   - Métadonnées basiques

3. **YouTube Data API** - QUOTA
   - Uniquement si quota disponible
   - Métadonnées complètes

4. **Fallback minimal** - NO QUOTA
   - Métadonnées minimales pour permettre lecture

**Déduplication** : Même vidéo = 1 seul appel

### 4. Cache Service (`youtube-cache.ts`)

**TTL adaptatif** :
- Vidéos très populaires (>10M vues) : 7 jours
- Vidéos populaires (>1M vues) : 3 jours
- Vidéos normales : 12h

**Compression** :
- Descriptions tronquées (500 caractères)
- Tags limités (10 max)
- Résultats recherche limités (50 max)

---

## 📊 Quota Manager - États

```typescript
enum QuotaState {
  OK,        // < 80% utilisé
  LOW,       // 80-95% utilisé
  EXHAUSTED  // > 95% ou circuit breaker ouvert
}
```

### Circuit Breaker

- **Seuil** : 3 échecs consécutifs
- **Reset** : 5 minutes après dernier échec
- **Protection** : Empêche appels API inutiles

---

## 🔥 UX en cas de quota KO

| Fonction      | Status |
| ------------- | ------ |
| Lecture       | ✅      |
| Play / pause  | ✅      |
| Audio only    | ✅      |
| Recherche     | ❌      |
| Stats         | ❌      |
| Miniatures HD | ⚠️     |

👉 **L'utilisateur ne voit rien casser**

---

## 🧠 Optimisations Hardcore

### Déduplication
- Même vidéo → 1 appel global
- RequestDeduplicator dans YouTubeProvider

### Batch API
- Playlists → 1 call au lieu de N
- Max 50 IDs par call

### TTL Adaptatif
- Vidéos populaires → TTL long (7 jours)
- Vidéos rares → TTL court (12h)

### Warm Cache
- Préchargement nocturne (via `youtube-prefetch.ts`)

---

## 📦 Utilisation

### Récupérer métadonnées

```typescript
import { youtubeProvider } from '@/services/youtube-provider';

const result = await youtubeProvider.getVideoMetadata(videoId);

if (result.success) {
  console.log('Source:', result.source); // 'cache' | 'oembed' | 'api' | 'fallback'
  console.log('Metadata:', result.metadata);
}
```

### Vérifier état système

```typescript
const status = youtubeProvider.getSystemStatus();

console.log('Quota State:', status.quotaState); // OK | LOW | EXHAUSTED
console.log('Can Use API:', status.canUseAPI);
console.log('Can Play:', status.canPlay); // Toujours true
console.log('Message:', status.message);
```

### Lecture (toujours disponible)

```typescript
// La lecture via YouTube IFrame API fonctionne TOUJOURS
// Elle ne consomme PAS de quota
const canPlay = youtubeProvider.canPlay(videoId); // true
```

---

## 🧨 Ce que le système NE fait PAS

❌ Rotation de clés  
❌ Scraping public  
❌ Flux audio brut  
❌ Téléchargement  

---

## 📈 Résultats Attendus

- **Réduction quota** : -80-90% (cache + oEmbed)
- **Lecture garantie** : 100% (même sans quota)
- **UX continue** : 0 écran d'erreur
- **Performance** : +50% (cache + déduplication)

---

## 🔄 Migration

Les services existants utilisent automatiquement le nouveau système :

- `fetchYouTubeVideoMetadata()` → Utilise `youtubeProvider` en interne
- `youtubeBatchService` → Utilise `youtubeProvider` pour routing
- `useYouTubeSearch` → Continue d'utiliser cache + quota manager

**Aucun changement requis dans le code existant** ✅

---

## 🚀 Prochaines Étapes Possibles

- 🔧 Mode offline complet
- 🎧 Player audio-only premium
- 📊 Analytics quota détaillées
- 🔄 Warm cache intelligent
