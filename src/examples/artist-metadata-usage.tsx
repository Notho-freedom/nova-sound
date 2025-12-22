/**
 * Exemples d'utilisation du service Artist Metadata Provider
 * 
 * Ce fichier montre différentes façons d'utiliser le service
 * pour récupérer et afficher des métadonnées d'artistes et d'albums.
 */

import { ArtistMetadata } from '@/components/ArtistMetadata';
import { AlbumMetadata } from '@/components/AlbumMetadata';
import { useArtistMetadata, useAlbumMetadata } from '@/hooks/useArtistMetadata';

// ============================================
// Exemple 1: Utilisation simple du composant
// ============================================
export function SimpleExample() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Métadonnées d'artiste</h2>
      <ArtistMetadata artistName="The Beatles" />
    </div>
  );
}

// ============================================
// Exemple 2: Mode combiné (toutes les sources)
// ============================================
export function CombinedExample() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Métadonnées combinées</h2>
      <ArtistMetadata
        artistName="The Beatles"
        combined={true}
        showFullBiography={true}
      />
    </div>
  );
}

// ============================================
// Exemple 3: Métadonnées d'album
// ============================================
export function AlbumExample() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Métadonnées d'album</h2>
      <AlbumMetadata
        albumName="Abbey Road"
        artistName="The Beatles"
      />
    </div>
  );
}

// ============================================
// Exemple 4: Utilisation du hook
// ============================================
export function HookExample() {
  const { metadata, isLoading, isError } = useArtistMetadata({
    artistName: "The Beatles",
    combined: true,
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
      {metadata && (
        <div>
          <h3 className="text-lg font-semibold">{metadata.name}</h3>
          {metadata.biographyShort && (
            <p className="text-muted-foreground mt-2">{metadata.biographyShort}</p>
          )}
          {metadata.genres && (
            <div className="flex gap-2 mt-2">
              {metadata.genres.map((genre, index) => (
                <span key={index} className="px-2 py-1 text-xs bg-primary/10 rounded">
                  {genre}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Exemple 5: Affichage personnalisé
// ============================================
export function CustomDisplayExample() {
  const { metadata } = useArtistMetadata({
    artistName: "The Beatles",
    combined: true,
  });

  if (!metadata) return null;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-4">
        {metadata.imageUrl && (
          <img
            src={metadata.imageUrl}
            alt={metadata.name}
            className="w-24 h-24 rounded-full object-cover"
          />
        )}
        <div>
          <h2 className="text-2xl font-bold">{metadata.name}</h2>
          {metadata.origin && (
            <p className="text-sm text-muted-foreground">{metadata.origin}</p>
          )}
        </div>
      </div>

      {metadata.biographyShort && (
        <p className="text-sm leading-relaxed">{metadata.biographyShort}</p>
      )}

      {metadata.socialLinks && (
        <div className="flex gap-2">
          {metadata.socialLinks.wikipedia && (
            <a
              href={metadata.socialLinks.wikipedia}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              Wikipedia
            </a>
          )}
          {metadata.socialLinks.official && (
            <a
              href={metadata.socialLinks.official}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              Site officiel
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Exemple 6: Vue d'artiste complète
// ============================================
export function ArtistViewExample({ artistName }: { artistName: string }) {
  const { metadata, isLoading } = useArtistMetadata({
    artistName,
    combined: true,
  });

  if (isLoading) {
    return <div className="p-4">Chargement des métadonnées...</div>;
  }

  if (!metadata) {
    return <div className="p-4">Aucune métadonnée disponible</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-start gap-6">
        {metadata.imageUrl && (
          <img
            src={metadata.imageUrl}
            alt={metadata.name}
            className="w-48 h-48 rounded-lg object-cover shadow-lg"
          />
        )}
        <div className="flex-1">
          <h1 className="text-4xl font-bold">{metadata.name}</h1>
          {metadata.genres && (
            <div className="flex flex-wrap gap-2 mt-3">
              {metadata.genres.map((genre, index) => (
                <span
                  key={index}
                  className="px-3 py-1 text-sm bg-primary/10 text-primary rounded-full"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Biographie */}
      {metadata.biography && (
        <div className="prose max-w-none">
          <h2 className="text-2xl font-bold mb-3">Biographie</h2>
          <p className="text-muted-foreground leading-relaxed">
            {metadata.biography}
          </p>
        </div>
      )}

      {/* Informations */}
      <div className="grid grid-cols-2 gap-4">
        {metadata.origin && (
          <div>
            <h3 className="font-semibold mb-1">Origine</h3>
            <p className="text-sm text-muted-foreground">{metadata.origin}</p>
          </div>
        )}
        {metadata.birthDate && (
          <div>
            <h3 className="font-semibold mb-1">Période</h3>
            <p className="text-sm text-muted-foreground">
              {new Date(metadata.birthDate).getFullYear()}
              {metadata.deathDate && ` - ${new Date(metadata.deathDate).getFullYear()}`}
            </p>
          </div>
        )}
      </div>

      {/* Artistes similaires */}
      {metadata.similarArtists && metadata.similarArtists.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-3">Artistes similaires</h2>
          <div className="flex flex-wrap gap-2">
            {metadata.similarArtists.map((artist, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-muted rounded-md text-sm"
              >
                {artist}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

