/**
 * Composant UI pour afficher les métadonnées d'un artiste
 */

"use client";

import { useState } from 'react';
import { 
  User, 
  Calendar, 
  MapPin, 
  Globe, 
  Music, 
  ExternalLink, 
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useArtistMetadata } from '@/hooks/useArtistMetadata';
import type { ArtistMetadata } from '@/types/artist-metadata';

interface ArtistMetadataProps {
  artistName: string;
  className?: string;
  showFullBiography?: boolean;
  combined?: boolean; // Utiliser le mode combiné
}

export function ArtistMetadata({
  artistName,
  className,
  showFullBiography = false,
  combined = true,
}: ArtistMetadataProps) {
  const { metadata, isLoading, isError } = useArtistMetadata({
    artistName,
    enabled: !!artistName,
    combined,
  });

  const [showFullBio, setShowFullBio] = useState(showFullBiography);

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <span className="ml-2 text-sm text-muted-foreground">Chargement des métadonnées...</span>
      </div>
    );
  }

  if (isError || !metadata) {
    return null; // Ne rien afficher en cas d'erreur
  }

  const biography = showFullBio ? metadata.biography : metadata.biographyShort;
  const hasMoreBio = metadata.biography && metadata.biography.length > (metadata.biographyShort?.length || 0);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Image et nom */}
      {metadata.imageUrl && (
        <div className="flex items-start gap-4">
          <img
            src={metadata.imageUrl}
            alt={metadata.name}
            className="w-32 h-32 rounded-lg object-cover"
          />
          <div className="flex-1">
            <h3 className="text-2xl font-bold">{metadata.name}</h3>
            {metadata.genres && metadata.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {metadata.genres.map((genre, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Biographie */}
      {biography && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <h4 className="font-semibold">Biographie</h4>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {biography}
          </p>
          {hasMoreBio && (
            <button
              onClick={() => setShowFullBio(!showFullBio)}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              {showFullBio ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  Voir moins
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  Voir plus
                </>
              )}
            </button>
          )}
          {metadata.biographyUrl && (
            <a
              href={metadata.biographyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              Lire la suite sur {metadata.source === 'wikipedia' ? 'Wikipedia' : metadata.source}
            </a>
          )}
        </div>
      )}

      {/* Informations détaillées */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dates */}
        {(metadata.birthDate || metadata.deathDate) && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Période</span>
            </div>
            <p className="text-sm text-muted-foreground ml-6">
              {metadata.birthDate && (
                <span>Né: {new Date(metadata.birthDate).getFullYear()}</span>
              )}
              {metadata.birthDate && metadata.deathDate && ' • '}
              {metadata.deathDate && (
                <span>Décédé: {new Date(metadata.deathDate).getFullYear()}</span>
              )}
            </p>
          </div>
        )}

        {/* Origine */}
        {(metadata.origin || metadata.country) && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Origine</span>
            </div>
            <p className="text-sm text-muted-foreground ml-6">
              {metadata.origin || metadata.country}
            </p>
          </div>
        )}

        {/* Site web */}
        {metadata.website && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Site web</span>
            </div>
            <a
              href={metadata.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline ml-6 flex items-center gap-1"
            >
              {metadata.website.replace(/^https?:\/\//, '')}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* Liens sociaux */}
      {metadata.socialLinks && Object.keys(metadata.socialLinks).length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-muted-foreground" />
            <h4 className="font-semibold text-sm">Réseaux sociaux</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {metadata.socialLinks.wikipedia && (
              <a
                href={metadata.socialLinks.wikipedia}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 text-xs bg-muted hover:bg-muted/80 rounded-md transition-colors"
              >
                Wikipedia
              </a>
            )}
            {metadata.socialLinks.official && (
              <a
                href={metadata.socialLinks.official}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 text-xs bg-muted hover:bg-muted/80 rounded-md transition-colors"
              >
                Site officiel
              </a>
            )}
            {metadata.socialLinks.facebook && (
              <a
                href={metadata.socialLinks.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 text-xs bg-muted hover:bg-muted/80 rounded-md transition-colors"
              >
                Facebook
              </a>
            )}
            {metadata.socialLinks.twitter && (
              <a
                href={metadata.socialLinks.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 text-xs bg-muted hover:bg-muted/80 rounded-md transition-colors"
              >
                Twitter
              </a>
            )}
            {metadata.socialLinks.instagram && (
              <a
                href={metadata.socialLinks.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 text-xs bg-muted hover:bg-muted/80 rounded-md transition-colors"
              >
                Instagram
              </a>
            )}
            {metadata.socialLinks.youtube && (
              <a
                href={metadata.socialLinks.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 text-xs bg-muted hover:bg-muted/80 rounded-md transition-colors"
              >
                YouTube
              </a>
            )}
          </div>
        </div>
      )}

      {/* Artistes similaires */}
      {metadata.similarArtists && metadata.similarArtists.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Artistes similaires</h4>
          <div className="flex flex-wrap gap-2">
            {metadata.similarArtists.map((artist, index) => (
              <span
                key={index}
                className="px-2 py-1 text-xs bg-muted rounded-md"
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

