# Service Artist Image Provider

Service Nexus pour récupérer des images d'artistes de manière gratuite et légale, avec support multi-sources, cache intelligent et fallback automatique.

## 🎯 Fonctionnalités

- ✅ **Multi-sources** : Unsplash, Pexels, Pixabay, Wikimedia Commons
- ✅ **Cache intelligent** : localStorage avec TTL et gestion de quota
- ✅ **Fallback automatique** : Si une source échoue, passe à la suivante
- ✅ **Compatible Next.js + Electron** : Fonctionne côté client et serveur
- ✅ **UI Components** : Composants React prêts à l'emploi
- ✅ **React Query** : Cache et gestion d'état optimisés

## 📦 Installation

Le service est déjà intégré au projet. Il suffit de configurer les clés API dans votre fichier `.env.local`.

## 🔑 Configuration

### Variables d'environnement

#### Côté Client (NEXT_PUBLIC_*)

```env
# Unsplash (50 requêtes/h gratuites)
NEXT_PUBLIC_UNSPLASH_ACCESS_KEY=your-unsplash-access-key

# Pexels (200 requêtes/h gratuites)
NEXT_PUBLIC_PEXELS_API_KEY=your-pexels-api-key

# Pixabay (5000 requêtes/h gratuites)
NEXT_PUBLIC_PIXABAY_API_KEY=your-pixabay-api-key
```

**Note** : Wikimedia Commons fonctionne sans clé API.

#### Côté Serveur (pour la route API)

```env
UNSPLASH_ACCESS_KEY=your-unsplash-access-key
PEXELS_API_KEY=your-pexels-api-key
PIXABAY_API_KEY=your-pixabay-api-key
```

### Obtenir les clés API

1. **Unsplash** : https://unsplash.com/developers
   - Créez un compte développeur
   - Créez une application
   - Copiez l'Access Key

2. **Pexels** : https://www.pexels.com/api/
   - Créez un compte
   - Allez dans "API" → "Your API Key"
   - Copiez la clé

3. **Pixabay** : https://pixabay.com/api/docs/
   - Créez un compte
   - Allez dans "API" → "Get API Key"
   - Copiez la clé

## 🚀 Utilisation

### 1. Composant React (Recommandé)

```tsx
import { ArtistImage } from '@/components/ArtistImage';

function MyComponent() {
  return (
    <ArtistImage
      artistName="The Beatles"
      size="lg"
      className="shadow-lg"
    />
  );
}
```

### 2. Hook React

```tsx
import { useArtistImage, useArtistImages } from '@/hooks/useArtistImage';

function MyComponent() {
  // Une image aléatoire
  const { image, isLoading } = useArtistImage({
    query: "The Beatles",
  });

  // Plusieurs images
  const { images, isLoading } = useArtistImages({
    query: "The Beatles",
    limit: 5,
  });

  return (
    <div>
      {image && <img src={image.url} alt="Artist" />}
    </div>
  );
}
```

### 3. Service Direct (Côté Client)

```tsx
import { getArtistImageProvider } from '@/services/artist-image-provider';

const provider = getArtistImageProvider();

// Recherche
const result = await provider.search({
  query: "The Beatles",
  limit: 10,
});

// Image aléatoire
const image = await provider.getRandomImage("The Beatles");
```

### 4. API Route (Côté Serveur)

```tsx
// GET /api/artist-images?query=The+Beatles&limit=10
// GET /api/artist-images?query=The+Beatles&random=true

const response = await fetch('/api/artist-images?query=The+Beatles&random=true');
const { image } = await response.json();
```

## 📚 API Reference

### Composants

#### `<ArtistImage />`

Affiche une image d'artiste avec fallback automatique.

**Props :**
- `artistName: string` - Nom de l'artiste
- `size?: 'sm' | 'md' | 'lg' | 'xl'` - Taille (défaut: 'md')
- `className?: string` - Classes CSS supplémentaires
- `fallbackIcon?: React.ReactNode` - Icône de fallback personnalisée
- `showLoading?: boolean` - Afficher le loader (défaut: true)
- `onImageLoad?: (image: ArtistImage | null) => void` - Callback quand l'image est chargée

#### `<ArtistImageCarousel />`

Affiche plusieurs images dans un carrousel.

**Props :**
- `artistName: string` - Nom de l'artiste
- `limit?: number` - Nombre d'images (défaut: 5)
- `className?: string` - Classes CSS supplémentaires
- `onImageSelect?: (image: ArtistImage) => void` - Callback quand une image est sélectionnée

### Hooks

#### `useArtistImage(options)`

Récupère une image aléatoire d'un artiste.

**Options :**
- `query: string` - Nom de l'artiste
- `enabled?: boolean` - Activer la requête (défaut: true)
- `random?: boolean` - Mode aléatoire (défaut: true)

**Retour :**
- `image: ArtistImage | null` - Image trouvée
- `images: ArtistImage[]` - Tableau avec l'image
- `isLoading: boolean` - État de chargement
- `isError: boolean` - Erreur
- `error: Error | null` - Objet d'erreur
- `refetch: () => void` - Fonction pour relancer la requête

#### `useArtistImages(options)`

Récupère plusieurs images d'un artiste.

**Options :**
- `query: string` - Nom de l'artiste
- `limit?: number` - Nombre d'images (défaut: 10)
- `enabled?: boolean` - Activer la requête (défaut: true)

**Retour :**
- `images: ArtistImage[]` - Images trouvées
- `result: ImageSearchResult | null` - Résultat complet
- `isLoading: boolean` - État de chargement
- `isError: boolean` - Erreur
- `error: Error | null` - Objet d'erreur
- `refetch: () => void` - Fonction pour relancer la requête

### Service

#### `ArtistImageProvider`

Classe principale du service.

**Méthodes :**
- `search(options: ImageSearchOptions): Promise<ImageSearchResult>` - Recherche d'images
- `getRandomImage(query: string): Promise<ArtistImage | null>` - Image aléatoire
- `getImages(query: string, limit?: number): Promise<ArtistImage[]>` - Plusieurs images
- `clearCache(): void` - Vide le cache
- `isSourceAvailable(source): boolean` - Vérifie si une source est disponible

## 🔄 Ordre de Fallback

Le service essaie les sources dans cet ordre :

1. **Unsplash** - Qualité élevée, 50 req/h
2. **Pexels** - Bonne qualité, 200 req/h
3. **Pixabay** - Grande base, 5000 req/h
4. **Wikimedia Commons** - Toujours disponible, images libres

Si une source échoue (quota, erreur réseau, etc.), le service passe automatiquement à la suivante.

## 💾 Cache

Le service utilise localStorage pour mettre en cache les résultats :

- **TTL par défaut** : 7 jours
- **Taille max** : 50 MB
- **Nettoyage automatique** : Entrées expirées et plus anciennes

Le cache est partagé entre toutes les sources et réduit significativement les requêtes API.

## 🎨 Exemples d'Intégration

### Dans ArtistCard

```tsx
import { ArtistImage } from '@/components/ArtistImage';

<ArtistCard
  name="The Beatles"
  imageUrl={<ArtistImage artistName="The Beatles" size="md" />}
  // ...
/>
```

### Dans LibraryView

```tsx
import { ArtistImage } from '@/components/ArtistImage';

<div className="w-48 h-48 rounded-full">
  <ArtistImage
    artistName={artist.name}
    size="xl"
    className="shadow-2xl"
  />
</div>
```

### Carrousel d'images

```tsx
import { ArtistImageCarousel } from '@/components/ArtistImage';

<ArtistImageCarousel
  artistName="The Beatles"
  limit={5}
  onImageSelect={(image) => {
    console.log('Image sélectionnée:', image.url);
  }}
/>
```

## ⚠️ Limitations

- **Unsplash** : 50 requêtes/heure (gratuit)
- **Pexels** : 200 requêtes/heure (gratuit)
- **Pixabay** : 5000 requêtes/heure (gratuit)
- **Wikimedia** : Aucune limite (mais peut être plus lent)

Le cache réduit considérablement l'utilisation des quotas.

## 🔒 Licences

Toutes les images retournées sont libres de droits pour usage commercial :

- **Unsplash** : Unsplash License (libre d'usage)
- **Pexels** : Pexels License (libre d'usage)
- **Pixabay** : Pixabay License (libre d'usage)
- **Wikimedia** : Public Domain / Creative Commons

## 🐛 Dépannage

### Aucune image ne s'affiche

1. Vérifiez que les clés API sont configurées dans `.env.local`
2. Vérifiez la console pour les erreurs
3. Vérifiez que le nom de l'artiste est correct
4. Le service utilise Wikimedia en dernier recours (toujours disponible)

### Erreur de quota

- Le cache réduit les requêtes
- Vérifiez vos quotas sur les sites des APIs
- Le service passe automatiquement à la source suivante

### Images de mauvaise qualité

- Essayez différentes sources (Unsplash généralement meilleure)
- Ajustez les paramètres `width` et `height` dans les options

## 📝 Notes

- Le service fonctionne sans aucune clé API (utilise uniquement Wikimedia)
- Les clés API améliorent la qualité et la quantité des résultats
- Le cache est automatiquement nettoyé pour éviter de saturer localStorage
- Compatible avec Electron (utilise localStorage du navigateur)

