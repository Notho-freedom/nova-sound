# 🎨 Vector UI Integration - Complete Guide

## ✅ Intégrations Complètes

### 1. Recherche Sémantique (SearchView)

**Fichier**: `src/components/views/SearchView.tsx`

**Fonctionnalités**:
- ✅ Toggle IA pour activer/désactiver la recherche sémantique
- ✅ Badge "Beta" pour identifier le mode IA
- ✅ Résultats sémantiques affichés en priorité
- ✅ Animation de pulse sur l'icône Sparkles
- ✅ Section dédiée avec gradient visuel
- ✅ Fallback sur recherche classique si Vector non disponible

**Utilisation**:
```tsx
// Le toggle apparaît automatiquement si Vector est disponible
// Les utilisateurs peuvent basculer entre:
// - Recherche classique (texte exact)
// - Recherche sémantique (IA, compréhension du contexte)

// Exemple de recherche:
// Texte: "bohemian rhapsody" → trouve "Bohemian Rhapsody"
// IA: "epic opera rock song" → trouve "Bohemian Rhapsody", "Stairway to Heaven", etc.
```

**Captures d'écran clés**:
- Toggle IA en haut à droite de la barre de recherche
- Section "Résultats IA" avec badge "Sémantique"
- Gradient bleu/violet pour les résultats IA

---

### 2. Recommandations Similaires (SimilarTracks)

**Fichier**: `src/components/SimilarTracks.tsx`

**Fonctionnalités**:
- ✅ Affiche jusqu'à 5 titres similaires
- ✅ Basé sur le titre en cours de lecture
- ✅ Bouton Play au survol de chaque titre
- ✅ Action "Ajouter à la file" rapide
- ✅ Animation de fondu enchaîné
- ✅ Icône Sparkles avec pulse

**Utilisation**:
```tsx
import { SimilarTracks } from "@/components/SimilarTracks";

<SimilarTracks
  currentTrack={currentTrack}
  onPlayTrack={handlePlayTrack}
  onAddToQueue={handleAddToQueue}
  limit={5}
/>
```

**Intégration recommandée**:
- Dans le panneau latéral droit du lecteur
- Dans la vue "Now Playing"
- En bas de la page de détails d'un titre

---

### 3. Assistant SkyOS (SkyOSAssistant)

**Fichier**: `src/components/SkyOSAssistant.tsx`

**Fonctionnalités**:
- ✅ Interface de chat conversationnelle
- ✅ RAG (Retrieval Augmented Generation)
- ✅ Recherche sémantique dans la documentation
- ✅ Affichage des sources de contexte
- ✅ Questions suggérées au démarrage
- ✅ Historique des messages
- ✅ Animation des bulles de chat
- ✅ Support Enter pour envoyer

**Utilisation**:
```tsx
import { SkyOSAssistant } from "@/components/SkyOSAssistant";

<SkyOSAssistant onClose={() => setIsOpen(false)} />
```

**Questions suggérées**:
- Comment ajouter des titres ?
- Comment créer une playlist ?
- Comment synchroniser avec YouTube ?
- Quelles sont les fonctionnalités Pro ?
- Comment utiliser les paroles ?

**Architecture RAG**:
1. User pose une question
2. Vector search trouve le contexte pertinent
3. Contexte affiché à l'utilisateur
4. (Futur) Envoi à LLM pour générer réponse

---

### 4. Bouton Flottant (SkyOSFAB)

**Fichier**: `src/components/SkyOSFAB.tsx`

**Fonctionnalités**:
- ✅ Bouton flottant en bas à droite
- ✅ Animation de pulse au chargement
- ✅ Tooltip au survol
- ✅ Icône Bot avec Sparkles animés
- ✅ Ouvre une modale plein écran avec l'assistant
- ✅ Gradient from-primary to-secondary

**Utilisation**:
```tsx
import { SkyOSFAB } from "@/components/SkyOSFAB";

// Dans DesktopApp.tsx ou App.tsx
<SkyOSFAB />
```

**Position**: Fixed bottom-24 right-6 (au-dessus du player)

---

### 5. Service Vector Search

**Fichier**: `src/services/vector-search.ts`

**Fonctions disponibles**:
```typescript
// Recherche sémantique de titres
await searchTracksSemanticSearch(query, limit);

// Trouver des titres similaires
await findSimilarTracks(trackId, limit);

// Obtenir le contexte RAG
await getRAGContext(userQuestion);

// Vérifier disponibilité
await isVectorSearchAvailable();

// Indexer des titres
await indexTracksToVector(tracks);
```

**Types**:
```typescript
interface VectorSearchResult {
  track: Track;
  score: number;
  reason?: string;
}

interface RAGResponse {
  context: string;
  sources: Array<{
    title: string;
    url?: string;
    excerpt: string;
  }>;
  suggestedPrompt?: string;
}
```

---

### 6. Hook React (useVectorSearch)

**Fichier**: `src/hooks/useVectorSearch.ts`

**API**:
```typescript
const {
  results,           // VectorSearchResult[]
  loading,           // boolean
  error,             // string | null
  search,            // (query: string) => Promise<void>
  isAvailable,       // boolean
  checkingAvailability, // boolean
} = useVectorSearch();
```

**Exemple d'utilisation**:
```tsx
function MySearchComponent() {
  const vectorSearch = useVectorSearch();

  useEffect(() => {
    if (query && vectorSearch.isAvailable) {
      vectorSearch.search(query);
    }
  }, [query]);

  if (vectorSearch.loading) return <Loader />;
  if (vectorSearch.error) return <Error message={vectorSearch.error} />;

  return (
    <div>
      {vectorSearch.results.map(result => (
        <TrackCard key={result.track.id} track={result.track} score={result.score} />
      ))}
    </div>
  );
}
```

---

## 🚀 Guide d'Intégration Complète

### Étape 1: Ajouter SearchView avec recherche IA

**Fichier**: `src/components/views/SearchView.tsx`

Déjà intégré ✅

**Ce qui a été fait**:
- Import du hook `useVectorSearch`
- Ajout de l'état `useSemanticSearch`
- Toggle IA dans l'UI
- Section résultats sémantiques
- Effet pour déclencher la recherche

### Étape 2: Ajouter SimilarTracks au Player

**Option A: Dans Now Playing View**

```tsx
// src/components/views/NowPlayingView.tsx
import { SimilarTracks } from "@/components/SimilarTracks";

// Dans le render:
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div className="lg:col-span-2">
    {/* Player principal */}
  </div>
  <div>
    {/* Sidebar droite */}
    <SimilarTracks
      currentTrack={currentTrack}
      onPlayTrack={onPlayTrack}
      onAddToQueue={onAddToQueue}
      limit={5}
    />
  </div>
</div>
```

**Option B: Dans DesktopApp (panneau latéral)**

```tsx
// src/components/DesktopApp.tsx
import { SimilarTracks } from "@/components/SimilarTracks";

// Ajouter dans le panneau latéral ou au-dessus de la queue
{currentTrack && (
  <SimilarTracks
    currentTrack={currentTrack}
    onPlayTrack={(track) => {
      const index = tracks.findIndex(t => t.id === track.id);
      if (index >= 0) setCurrentTrackIndex(index);
    }}
    onAddToQueue={handleAddToQueue}
    limit={5}
  />
)}
```

### Étape 3: Ajouter SkyOS FAB

**Fichier**: `src/components/DesktopApp.tsx` ou `app/page.tsx`

```tsx
import { SkyOSFAB } from "@/components/SkyOSFAB";

// À la fin du render, juste avant </div> final:
return (
  <div className="app-container">
    {/* Contenu principal */}
    
    {/* SkyOS Assistant FAB */}
    <SkyOSFAB />
  </div>
);
```

### Étape 4: Indexer la bibliothèque

**Option A: Au chargement initial**

```tsx
// src/components/DesktopApp.tsx
import { indexTracksToVector } from "@/services/vector-search";

useEffect(() => {
  const indexLibrary = async () => {
    if (tracks.length > 0) {
      console.log(`[Vector] Indexing ${tracks.length} tracks...`);
      const success = await indexTracksToVector(tracks);
      if (success) {
        console.log("[Vector] Library indexed successfully");
      }
    }
  };

  // Indexer après un délai pour ne pas bloquer l'UI
  const timer = setTimeout(indexLibrary, 5000);
  return () => clearTimeout(timer);
}, [tracks]);
```

**Option B: Via un bouton dans Settings**

```tsx
// src/components/views/SettingsView.tsx
import { indexTracksToVector, isVectorSearchAvailable } from "@/services/vector-search";

const [isIndexing, setIsIndexing] = useState(false);
const [vectorStats, setVectorStats] = useState({ count: 0, available: false });

const handleIndexLibrary = async () => {
  setIsIndexing(true);
  try {
    const success = await indexTracksToVector(tracks);
    if (success) {
      toast.success(`${tracks.length} titres indexés avec succès`);
      // Refresh stats
      const available = await isVectorSearchAvailable();
      setVectorStats({ count: tracks.length, available });
    }
  } catch (error) {
    toast.error("Erreur lors de l'indexation");
  } finally {
    setIsIndexing(false);
  }
};

// Dans le render:
<SettingRow
  icon={Sparkles}
  label="Recherche Sémantique IA"
  description="Indexer votre bibliothèque pour la recherche IA"
>
  <Button
    onClick={handleIndexLibrary}
    disabled={isIndexing || tracks.length === 0}
  >
    {isIndexing ? (
      <>
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Indexation...
      </>
    ) : (
      <>
        <Sparkles className="w-4 h-4 mr-2" />
        Indexer {tracks.length} titres
      </>
    )}
  </Button>
</SettingRow>

{vectorStats.available && (
  <div className="text-xs text-muted-foreground mt-2">
    ✅ {vectorStats.count} titres indexés
  </div>
)}
```

---

## 🎨 Guide Visuel

### Recherche Sémantique

```
┌────────────────────────────────────────────┐
│  🔍 Rechercher                              │
│  ┌──────────────────────────────────────┐  │
│  │ epic opera rock song              [✨] │  ← Toggle IA
│  └──────────────────────────────────────┘  │
│                                             │
│  ✨ Résultats IA (3) [Sémantique]          │
│  ┌──────────────────────────────────────┐  │
│  │ 🎵 Bohemian Rhapsody - Queen      ▶️ │  │
│  │ 🎵 Stairway to Heaven - Led Zep  ▶️ │  │
│  │ 🎵 November Rain - Guns N' Roses  ▶️ │  │
│  └──────────────────────────────────────┘  │
│  ✨ Résultats trouvés par similarité       │
│                                             │
│  🎵 Titres (127)                            │
│  ... résultats classiques ...              │
└────────────────────────────────────────────┘
```

### Titres Similaires

```
┌────────────────────────────────────┐
│ ✨ Similaire à ce titre            │
│ ┌──────────────────────────────┐  │
│ │ [🎵] Rock You - Queen     [+] │  │
│ │ [🎵] Killer Queen         [+] │  │
│ │ [🎵] Somebody to Love     [+] │  │
│ │ [🎵] Under Pressure       [+] │  │
│ │ [🎵] We Are the Champions [+] │  │
│ └──────────────────────────────┘  │
└────────────────────────────────────┘
```

### Assistant SkyOS

```
┌──────────────────────────────────────┐
│ 🤖 SkyOS Assistant                 ✕ │
│ Propulsé par l'IA sémantique        │
├──────────────────────────────────────┤
│                                      │
│ [SkyOS] 👋 Bonjour ! Je suis SkyOS  │
│                                      │
│     Comment créer une playlist ? [U] │
│                                      │
│ [SkyOS] Voici ce que j'ai trouvé:   │
│ Pour créer une playlist...           │
│ 📚 Sources: Guide des playlists     │
│                                      │
├──────────────────────────────────────┤
│ Posez votre question... [Envoyer →] │
│ SkyOS utilise l'IA sémantique       │
└──────────────────────────────────────┘
```

### FAB (Bouton Flottant)

```
                                    ┌────────────────────┐
                                    │ Assistant SkyOS    │
                                    │ Posez-moi vos      │
                                    │ questions          │
                                    └─────────┬──────────┘
                                              │
                                         [ 🤖 ✨ ]
                                         ╱     ╲
                                        ╱pulse  ╲
```

---

## 🧪 Tests d'Intégration

### Test 1: Recherche Sémantique

1. Ouvrir SearchView
2. Vérifier que le toggle IA apparaît (si Vector configuré)
3. Activer le toggle IA
4. Rechercher "energetic rock song"
5. Vérifier que la section "Résultats IA" apparaît
6. Vérifier que les résultats sont pertinents

**Expected**: Bohemian Rhapsody, Stairway to Heaven, etc.

### Test 2: Titres Similaires

1. Jouer un titre (ex: Bohemian Rhapsody)
2. Vérifier que le composant SimilarTracks apparaît
3. Vérifier qu'il affiche 5 titres maximum
4. Cliquer sur un titre similaire
5. Vérifier qu'il se lance correctement

**Expected**: Titres de Queen, rock progressif, etc.

### Test 3: Assistant SkyOS

1. Cliquer sur le FAB (bouton flottant)
2. Vérifier que la modale s'ouvre
3. Cliquer sur une question suggérée
4. Vérifier que la réponse avec contexte apparaît
5. Poser une question personnalisée
6. Vérifier que les sources sont affichées

**Expected**: Contexte pertinent de la documentation

### Test 4: Indexation

1. Ouvrir Settings
2. Trouver la section "Recherche Sémantique IA"
3. Cliquer sur "Indexer X titres"
4. Attendre la fin (toast de succès)
5. Vérifier que le compteur s'incrémente

**Expected**: Tous les titres indexés, recherche disponible

---

## 🐛 Troubleshooting

### Vector non disponible

**Symptômes**: Toggle IA n'apparaît pas

**Causes possibles**:
- Variables d'environnement manquantes
- Index Vector vide
- Erreur réseau

**Solution**:
```bash
# Vérifier les variables
curl https://yourdomain.com/api/vector/stats

# Indexer des données
curl -X POST https://yourdomain.com/api/vector/index \
  -H "Content-Type: application/json" \
  -d '{"type":"track","data":[...]}'
```

### Recherche lente

**Symptômes**: Délai > 2 secondes

**Solution**:
- Activer le cache Redis
- Réduire le topK (moins de résultats)
- Vérifier la latence Upstash

### Pas de résultats

**Symptômes**: "Aucun résultat sémantique trouvé"

**Causes**:
- Bibliothèque non indexée
- Requête trop vague
- Mauvais namespace

**Solution**:
```typescript
// Vérifier l'indexation
const stats = await fetch("/api/vector/stats");
console.log(await stats.json());

// Essayer avec des termes plus précis
// Au lieu de: "music"
// Essayer: "energetic rock song with guitar"
```

---

## 📚 Documentation Complète

**Guides disponibles**:
- [VECTOR_INTEGRATION.md](./VECTOR_INTEGRATION.md) - Setup complet
- [VECTOR_SUMMARY.md](./VECTOR_SUMMARY.md) - Résumé rapide
- [UPSTASH_COMPLETE.md](./UPSTASH_COMPLETE.md) - Écosystème complet
- [UPSTASH_DEPLOYMENT.md](./UPSTASH_DEPLOYMENT.md) - Déploiement en 30 min

**Exemples de code**:
- [src/lib/vector-examples.ts](../src/lib/vector-examples.ts)
- [src/lib/vector-helpers.ts](../src/lib/vector-helpers.ts)

---

## ✅ Checklist Finale

### Intégration UI
- [x] Recherche sémantique dans SearchView
- [x] Toggle IA avec badge Beta
- [x] Composant SimilarTracks
- [x] Assistant SkyOS avec RAG
- [x] FAB (bouton flottant)
- [x] Service vector-search.ts
- [x] Hook useVectorSearch
- [ ] Intégration dans DesktopApp *(À faire)*
- [ ] Bouton d'indexation dans Settings *(À faire)*

### Tests
- [ ] Test recherche sémantique
- [ ] Test titres similaires
- [ ] Test assistant SkyOS
- [ ] Test indexation
- [ ] Test performance

### Production
- [ ] Variables d'environnement configurées
- [ ] Bibliothèque indexée
- [ ] Cache activé
- [ ] Monitoring en place
- [ ] Documentation utilisateur

---

**L'intégration UI est prête! Il ne reste plus qu'à:**
1. Ajouter SkyOSFAB dans DesktopApp
2. Ajouter SimilarTracks dans le player
3. Ajouter le bouton d'indexation dans Settings
4. Tester en production

**Bonne intégration!** 🚀
