/**
 * Composant UI pour afficher les métadonnées d'un album
 */

"use client";

import { Calendar, Music, Disc, Clock, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useAlbumMetadata } from '@/hooks/useArtistMetadata';
import type { AlbumMetadata } from '@/types/artist-metadata';

interface AlbumMetadataProps {
  albumName: string;
  artistName: string;
  className?: string;
}

export function AlbumMetadata({
  albumName,
  artistName,
  className,
}: AlbumMetadataProps) {
  const { metadata, isLoading, isError } = useAlbumMetadata({
    albumName,
    artistName,
    enabled: !!albumName && !!artistName,
  });

  if (isLoading) {
    return (
      <div className={cn('space-y-4 p-8', className)}>
        <div className="flex items-center gap-4">
          <Skeleton className="w-24 h-24 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (isError || !metadata) {
    return null; // Ne rien afficher en cas d'erreur
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Image et nom */}
      {metadata.coverUrl && (
        <div className="flex items-start gap-4">
          <img
            src={metadata.coverUrl}
            alt={`${metadata.name} - ${metadata.artist}`}
            className="w-32 h-32 rounded-lg object-cover"
          />
          <div className="flex-1">
            <h3 className="text-2xl font-bold">{metadata.name}</h3>
            <p className="text-muted-foreground">{metadata.artist}</p>
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

      {/* Description */}
      {metadata.description && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Disc className="w-4 h-4 text-muted-foreground" />
            <h4 className="font-semibold">Description</h4>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {metadata.description}
          </p>
          {metadata.descriptionUrl && (
            <a
              href={metadata.descriptionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              En savoir plus
            </a>
          )}
        </div>
      )}

      {/* Informations détaillées */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Date de sortie */}
        {metadata.releaseDate && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Sortie</span>
            </div>
            <p className="text-sm text-muted-foreground ml-6">
              {metadata.year || new Date(metadata.releaseDate).getFullYear()}
            </p>
          </div>
        )}

        {/* Nombre de pistes */}
        {metadata.trackCount && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <Music className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Pistes</span>
            </div>
            <p className="text-sm text-muted-foreground ml-6">
              {metadata.trackCount}
            </p>
          </div>
        )}

        {/* Durée */}
        {metadata.duration && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Durée</span>
            </div>
            <p className="text-sm text-muted-foreground ml-6">
              {formatDuration(metadata.duration)}
            </p>
          </div>
        )}

        {/* Label */}
        {metadata.label && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <Disc className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Label</span>
            </div>
            <p className="text-sm text-muted-foreground ml-6">
              {metadata.label}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

