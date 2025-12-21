/**
 * Exemples d'utilisation du service Artist Image Provider
 * 
 * Ce fichier montre différentes façons d'utiliser le service
 * pour récupérer et afficher des images d'artistes.
 */

import { ArtistImage, ArtistImageCarousel } from '@/components/ArtistImage';
import { useArtistImage, useArtistImages } from '@/hooks/useArtistImage';
import { ArtistCardWithImage } from '@/components/ArtistCardWithImage';

// ============================================
// Exemple 1: Utilisation simple du composant
// ============================================
export function SimpleExample() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Image simple</h2>
      <ArtistImage artistName="The Beatles" size="lg" />
    </div>
  );
}

// ============================================
// Exemple 2: Avec différentes tailles
// ============================================
export function SizeExamples() {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Différentes tailles</h2>
      <div className="flex gap-4 items-center">
        <div>
          <p className="text-sm mb-2">Small</p>
          <ArtistImage artistName="The Beatles" size="sm" />
        </div>
        <div>
          <p className="text-sm mb-2">Medium</p>
          <ArtistImage artistName="The Beatles" size="md" />
        </div>
        <div>
          <p className="text-sm mb-2">Large</p>
          <ArtistImage artistName="The Beatles" size="lg" />
        </div>
        <div>
          <p className="text-sm mb-2">Extra Large</p>
          <ArtistImage artistName="The Beatles" size="xl" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Exemple 3: Utilisation du hook
// ============================================
export function HookExample() {
  const { image, isLoading, isError } = useArtistImage({
    query: "The Beatles",
  });

  if (isLoading) {
    return <div>Chargement...</div>;
  }

  if (isError) {
    return <div>Erreur lors du chargement</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Avec hook</h2>
      {image && (
        <div>
          <img src={image.url} alt="The Beatles" className="w-48 h-48 rounded-lg" />
          <p className="mt-2 text-sm text-muted-foreground">
            Source: {image.source} | Auteur: {image.author}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================
// Exemple 4: Carrousel d'images
// ============================================
export function CarouselExample() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Carrousel d'images</h2>
      <ArtistImageCarousel
        artistName="The Beatles"
        limit={5}
        onImageSelect={(image) => {
          console.log('Image sélectionnée:', image);
        }}
      />
    </div>
  );
}

// ============================================
// Exemple 5: Plusieurs images avec hook
// ============================================
export function MultipleImagesExample() {
  const { images, isLoading } = useArtistImages({
    query: "The Beatles",
    limit: 6,
  });

  if (isLoading) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Plusieurs images</h2>
      <div className="grid grid-cols-3 gap-4">
        {images.map((image, index) => (
          <div key={index} className="relative">
            <img
              src={image.thumbnailUrl || image.url}
              alt={`The Beatles - ${index + 1}`}
              className="w-full h-32 object-cover rounded-lg"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {image.source} - {image.author}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Exemple 6: ArtistCard avec image automatique
// ============================================
export function ArtistCardExample() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Artist Card</h2>
      <div className="grid grid-cols-4 gap-4">
        <ArtistCardWithImage
          name="The Beatles"
          trackCount={50}
          playCount={1200}
          onClick={() => console.log('Clicked')}
        />
        <ArtistCardWithImage
          name="Pink Floyd"
          trackCount={30}
          playCount={800}
          onClick={() => console.log('Clicked')}
        />
        <ArtistCardWithImage
          name="Led Zeppelin"
          trackCount={40}
          playCount={950}
          onClick={() => console.log('Clicked')}
        />
        <ArtistCardWithImage
          name="The Rolling Stones"
          trackCount={60}
          playCount={1500}
          onClick={() => console.log('Clicked')}
        />
      </div>
    </div>
  );
}

// ============================================
// Exemple 7: Avec callback
// ============================================
export function CallbackExample() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Avec callback</h2>
      <ArtistImage
        artistName="The Beatles"
        size="lg"
        onImageLoad={(image) => {
          if (image) {
            console.log('Image chargée:', {
              url: image.url,
              source: image.source,
              author: image.author,
            });
          } else {
            console.log('Aucune image trouvée');
          }
        }}
      />
    </div>
  );
}

// ============================================
// Exemple 8: Gestion d'erreur personnalisée
// ============================================
export function ErrorHandlingExample() {
  const { image, isLoading, isError, error, refetch } = useArtistImage({
    query: "Artiste Inconnu",
  });

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Gestion d'erreur</h2>
      
      {isLoading && <div>Chargement...</div>}
      
      {isError && (
        <div className="p-4 bg-destructive/10 rounded-lg">
          <p className="text-destructive font-medium">Erreur</p>
          <p className="text-sm text-muted-foreground mt-1">
            {error?.message || 'Erreur inconnue'}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded"
          >
            Réessayer
          </button>
        </div>
      )}
      
      {image && (
        <img src={image.url} alt="Artist" className="w-48 h-48 rounded-lg" />
      )}
    </div>
  );
}

