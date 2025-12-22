/**
 * Hook React pour récupérer des métadonnées d'artistes/albums
 * Utilise React Query pour le cache et la gestion d'état
 */

import { useQuery } from '@tanstack/react-query';
import type { ArtistMetadata, AlbumMetadata } from '@/types/artist-metadata';

interface UseArtistMetadataOptions {
  artistName: string;
  enabled?: boolean;
  combined?: boolean; // Utiliser le mode combiné (toutes les sources)
}

interface UseArtistMetadataResult {
  metadata: ArtistMetadata | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook pour récupérer les métadonnées d'un artiste
 */
export function useArtistMetadata(
  options: UseArtistMetadataOptions
): UseArtistMetadataResult {
  const { artistName, enabled = true, combined = false } = options;

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<{ metadata: ArtistMetadata }>({
    queryKey: ['artist-metadata', artistName, combined ? 'combined' : 'single'],
    queryFn: async () => {
      const params = new URLSearchParams({
        type: 'artist',
        query: artistName,
      });

      if (combined) {
        params.append('combined', 'true');
      }

      const response = await fetch(`/api/artist-metadata?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch artist metadata: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: enabled && !!artistName,
    staleTime: 30 * 24 * 60 * 60 * 1000, // 30 jours
    gcTime: 60 * 24 * 60 * 60 * 1000, // 60 jours
  });

  return {
    metadata: data?.metadata || null,
    isLoading,
    isError,
    error: error as Error | null,
    refetch: () => refetch(),
  };
}

interface UseAlbumMetadataOptions {
  albumName: string;
  artistName: string;
  enabled?: boolean;
}

interface UseAlbumMetadataResult {
  metadata: AlbumMetadata | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook pour récupérer les métadonnées d'un album
 */
export function useAlbumMetadata(
  options: UseAlbumMetadataOptions
): UseAlbumMetadataResult {
  const { albumName, artistName, enabled = true } = options;

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<{ metadata: AlbumMetadata }>({
    queryKey: ['album-metadata', albumName, artistName],
    queryFn: async () => {
      const params = new URLSearchParams({
        type: 'album',
        query: albumName,
        artist: artistName,
      });

      const response = await fetch(`/api/artist-metadata?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch album metadata: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: enabled && !!albumName && !!artistName,
    staleTime: 30 * 24 * 60 * 60 * 1000, // 30 jours
    gcTime: 60 * 24 * 60 * 60 * 1000, // 60 jours
  });

  return {
    metadata: data?.metadata || null,
    isLoading,
    isError,
    error: error as Error | null,
    refetch: () => refetch(),
  };
}

