# Service Artist Metadata Provider

Service Nexus pour récupérer des métadonnées enrichies sur les artistes, albums et pistes de manière gratuite et légale, avec support multi-sources, cache intelligent et fallback automatique.

## 🎯 Fonctionnalités

- ✅ **Multi-sources** : Wikipedia, Wikidata, MusicBrainz, Last.fm
- ✅ **Cache intelligent** : localStorage avec TTL de 30 jours
- ✅ **Fallback automatique** : Si une source échoue, passe à la suivante
- ✅ **Mode combiné** : Combine les métadonnées de toutes les sources pour un résultat optimal
- ✅ **Compatible Next.js + Electron** : Fonctionne côté client et serveur
- ✅ **React Query** : Cache et gestion d'état optimisés
- ✅ **Composants UI** : Composants React prêts à l'emploi

## 📦 Sources Disponibles

### 1. **Wikipedia** (Toujours disponible)
- Biographies détaillées
- Descriptions d'albums
- Images
- Langue configurable (fr, en, etc.)

### 2. **Wikidata** (Toujours disponible)
- Données structurées enrichies
- Dates de naissance/décès
- Pays d'origine
- Genres musicaux
- Liens vers autres bases de données

### 3. **MusicBrainz** (Toujours disponible)
- Base de données musicale open source
- Données très structurées
- Relations entre artistes
- Labels, dates de sortie précises
- Nécessite un User-Agent avec email (recommandé)

### 4. **Last.fm** (Nécessite clé API gratuite)
- Biographies de qualité
- Artistes similaires
- Tags/genres
- Images haute qualité
- Descriptions d'albums

## 🔑 Configuration

### Variables d'environnement

#### Côté Serveur (Recommandé)

```env
# Last.fm (gratuit, clé API requise)
# Obtenez votre clé: https://www.last.fm/api/account/create
LASTFM_API_KEY=your-lastfm-api-key

# MusicBrainz (gratuit, pas de clé requise)
# Recommandé: Ajoutez votre email pour un meilleur support
MUSICBRAINZ_EMAIL=your-email@example.com
```

**Note** : Wikipedia et Wikidata fonctionnent sans clé API.

### Obtenir les clés API

1. **Last.fm** : https://www.last.fm/api/account/create
   - Créez un compte Last.fm
   - Allez dans "API" → "Create API Account"
   - Copiez la clé API

2. **MusicBrainz** : Pas de clé requise
   - Ajoutez simplement votre email dans `MUSICBRAINZ_EMAIL`
   - Cela améliore le support et respecte les guidelines

## 🚀 Utilisation

### 1. Composant React (Recommandé)

#### Métadonnées d'artiste

```tsx
import { ArtistMetadata } from '@/components/ArtistMetadata';

function MyComponent() {
  return (
    <ArtistMetadata
      artistName="The Beatles"
      combined={true} // Combine toutes les sources
      showFullBiography={false}
    />
  );
}
```

#### Métadonnées d'album

```tsx
import { AlbumMetadata } from '@/components/AlbumMetadata';

function MyComponent() {
  return (
    <AlbumMetadata
      albumName="Abbey Road"
      artistName="The Beatles"
    />
  );
}
```

### 2. Hook React

```tsx
import { useArtistMetadata, useAlbumMetadata } from '@/hooks/useArtistMetadata';

function MyComponent() {
  // Métadonnées d'artiste
  const { metadata, isLoading } = useArtistMetadata({
    artistName: "The Beatles",
    combined: true, // Mode combiné
  });

  // Métadonnées d'album
  const { metadata: albumMetadata } = useAlbumMetadata({
    albumName: "Abbey Road",
    artistName: "The Beatles",
  });

  return (
    <div>
      {metadata && (
        <div>
          <h2>{metadata.name}</h2>
          <p>{metadata.biographyShort}</p>
        </div>
      )}
    </div>
  );
}
```

### 3. Service Direct (Côté Serveur)

```tsx
import { getArtistMetadataProvider } from '@/services/artist-metadata-provider';

const provider = getArtistMetadataProvider();

// Métadonnées d'artiste
const artistMetadata = await provider.getArtistMetadata("The Beatles");

// Métadonnées combinées (toutes les sources)
const combinedMetadata = await provider.getCombinedArtistMetadata("The Beatles");

// Métadonnées d'album
const albumMetadata = await provider.getAlbumMetadata("Abbey Road", "The Beatles");
```

### 4. API Route (Côté Serveur)

```tsx
// GET /api/artist-metadata?type=artist&query=The+Beatles
// GET /api/artist-metadata?type=artist&query=The+Beatles&combined=true
// GET /api/artist-metadata?type=album&query=Abbey+Road&artist=The+Beatles

const response = await fetch('/api/artist-metadata?type=artist&query=The+Beatles&combined=true');
const { metadata } = await response.json();
```

## 📚 API Reference

### Composants

#### `<ArtistMetadata />`

Affiche les métadonnées complètes d'un artiste.

**Props :**
- `artistName: string` - Nom de l'artiste
- `className?: string` - Classes CSS supplémentaires
- `showFullBiography?: boolean` - Afficher la biographie complète (défaut: false)
- `combined?: boolean` - Utiliser le mode combiné (défaut: true)

**Affiche :**
- Image de l'artiste
- Biographie (avec option "Voir plus/moins")
- Genres musicaux
- Dates de naissance/décès
- Origine/Pays
- Site web officiel
- Liens sociaux (Wikipedia, Facebook, Twitter, Instagram, YouTube)
- Artistes similaires

#### `<AlbumMetadata />`

Affiche les métadonnées complètes d'un album.

**Props :**
- `albumName: string` - Nom de l'album
- `artistName: string` - Nom de l'artiste
- `className?: string` - Classes CSS supplémentaires

**Affiche :**
- Image de couverture
- Description
- Date de sortie
- Nombre de pistes
- Durée totale
- Label
- Genres

### Hooks

#### `useArtistMetadata(options)`

Récupère les métadonnées d'un artiste.

**Options :**
- `artistName: string` - Nom de l'artiste
- `enabled?: boolean` - Activer la requête (défaut: true)
- `combined?: boolean` - Mode combiné (défaut: false)

**Retour :**
- `metadata: ArtistMetadata | null` - Métadonnées trouvées
- `isLoading: boolean` - État de chargement
- `isError: boolean` - Erreur
- `error: Error | null` - Objet d'erreur
- `refetch: () => void` - Fonction pour relancer la requête

#### `useAlbumMetadata(options)`

Récupère les métadonnées d'un album.

**Options :**
- `albumName: string` - Nom de l'album
- `artistName: string` - Nom de l'artiste
- `enabled?: boolean` - Activer la requête (défaut: true)

**Retour :**
- `metadata: AlbumMetadata | null` - Métadonnées trouvées
- `isLoading: boolean` - État de chargement
- `isError: boolean` - Erreur
- `error: Error | null` - Objet d'erreur
- `refetch: () => void` - Fonction pour relancer la requête

### Service

#### `ArtistMetadataProvider`

Classe principale du service.

**Méthodes :**
- `getArtistMetadata(artistName: string): Promise<ArtistMetadata | null>` - Métadonnées d'artiste (une source)
- `getCombinedArtistMetadata(artistName: string): Promise<ArtistMetadata | null>` - Métadonnées combinées (toutes sources)
- `getAlbumMetadata(albumName: string, artistName: string): Promise<AlbumMetadata | null>` - Métadonnées d'album
- `search(options: MetadataSearchOptions): Promise<MetadataSearchResult>` - Recherche générique
- `clearCache(): void` - Vide le cache
- `isSourceAvailable(source): boolean` - Vérifie si une source est disponible

## 🔄 Ordre de Fallback

Le service essaie les sources dans cet ordre :

### Pour les Artistes :
1. **Last.fm** - Meilleures biographies et artistes similaires
2. **MusicBrainz** - Données structurées précises
3. **Wikidata** - Données enrichies (dates, pays, etc.)
4. **Wikipedia** - Descriptions générales

### Pour les Albums :
1. **Last.fm** - Descriptions et images
2. **MusicBrainz** - Données précises (dates, labels)
3. **Wikipedia** - Descriptions générales

Si une source échoue (quota, erreur réseau, etc.), le service passe automatiquement à la suivante.

## 💾 Cache

Le service utilise localStorage pour mettre en cache les résultats :

- **TTL par défaut** : 30 jours
- **Taille max** : 100 MB
- **Nettoyage automatique** : Entrées expirées et plus anciennes

Le cache est partagé entre toutes les sources et réduit significativement les requêtes API.

## 🎨 Exemples d'Intégration

### Dans une vue d'artiste

```tsx
import { ArtistMetadata } from '@/components/ArtistMetadata';

<div className="artist-detail-view">
  <ArtistMetadata
    artistName={artist.name}
    combined={true}
    className="p-6"
  />
</div>
```

### Dans une vue d'album

```tsx
import { AlbumMetadata } from '@/components/AlbumMetadata';

<div className="album-detail-view">
  <AlbumMetadata
    albumName={album.name}
    artistName={album.artist}
    className="p-6"
  />
</div>
```

### Avec hook personnalisé

```tsx
import { useArtistMetadata } from '@/hooks/useArtistMetadata';

function ArtistBio({ artistName }: { artistName: string }) {
  const { metadata, isLoading } = useArtistMetadata({
    artistName,
    combined: true,
  });

  if (isLoading) return <div>Chargement...</div>;
  if (!metadata) return null;

  return (
    <div>
      <h2>{metadata.name}</h2>
      {metadata.biography && (
        <p className="text-muted-foreground">{metadata.biographyShort}</p>
      )}
      {metadata.genres && (
        <div className="flex gap-2">
          {metadata.genres.map(genre => (
            <span key={genre} className="badge">{genre}</span>
          ))}
        </div>
      )}
    </div>
  );
}
```

## ⚠️ Limitations

- **Last.fm** : Limite de requêtes (généralement très élevée)
- **MusicBrainz** : Nécessite un User-Agent avec email (recommandé)
- **Wikipedia/Wikidata** : Aucune limite (mais peut être plus lent)

Le cache réduit considérablement l'utilisation des quotas.

## 🔒 Licences

Toutes les données retournées sont libres d'usage :

- **Wikipedia** : CC BY-SA 3.0
- **Wikidata** : CC0 (domaine public)
- **MusicBrainz** : CC0 (domaine public)
- **Last.fm** : Données publiques (respecter les conditions d'utilisation)

## 🐛 Dépannage

### Aucune métadonnée ne s'affiche

1. Vérifiez que les clés API sont configurées dans `.env.local` (si nécessaire)
2. Vérifiez la console pour les erreurs
3. Vérifiez que le nom de l'artiste/album est correct
4. Le service utilise Wikipedia en dernier recours (toujours disponible)

### Erreur de quota

- Le cache réduit les requêtes
- Vérifiez vos quotas sur les sites des APIs
- Le service passe automatiquement à la source suivante

### Données incomplètes

- Utilisez le mode `combined={true}` pour combiner toutes les sources
- Certaines sources ont plus d'informations que d'autres selon le type de contenu

## 📝 Notes

- Le service fonctionne sans aucune clé API (utilise uniquement Wikipedia/Wikidata/MusicBrainz)
- Les clés API améliorent la qualité et la quantité des résultats
- Le mode combiné est recommandé pour les meilleurs résultats
- Le cache est automatiquement nettoyé pour éviter de saturer localStorage
- Compatible avec Electron (utilise localStorage du navigateur)

