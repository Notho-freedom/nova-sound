/**
 * Hook React pour récupérer des images d'artistes
 * Utilise React Query pour le cache et la gestion d'état
 */

import { useQuery } from '@tanstack/react-query';
import type { ArtistImage, ImageSearchResult } from '@/types/artist-image';

interface UseArtistImageOptions {
  query: string;
  limit?: number;
  enabled?: boolean;
  random?: boolean;
}

interface UseArtistImageResult {
  image: ArtistImage | null;
  images: ArtistImage[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook pour récupérer une image aléatoire d'un artiste
 */
export function useArtistImage(
  options: UseArtistImageOptions
): UseArtistImageResult {
  const { query, enabled = true, random = true } = options;

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<{ image: ArtistImage }>({
    queryKey: ['artist-image', query, 'random'],
    queryFn: async () => {
      const params = new URLSearchParams({
        query,
        random: 'true',
      });

      const response = await fetch(`/api/artist-images?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch artist image: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: enabled && !!query,
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 jours
    gcTime: 30 * 24 * 60 * 60 * 1000, // 30 jours (anciennement cacheTime)
  });

  return {
    image: data?.image || null,
    images: data?.image ? [data.image] : [],
    isLoading,
    isError,
    error: error as Error | null,
    refetch: () => refetch(),
  };
}

/**
 * Hook pour récupérer plusieurs images d'un artiste
 */
export function useArtistImages(
  options: UseArtistImageOptions
): Omit<UseArtistImageResult, 'image'> & { result: ImageSearchResult | null } {
  const { query, limit = 10, enabled = true } = options;

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ImageSearchResult>({
    queryKey: ['artist-images', query, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        query,
        limit: limit.toString(),
      });

      const response = await fetch(`/api/artist-images?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch artist images: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: enabled && !!query,
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 jours
    gcTime: 30 * 24 * 60 * 60 * 1000, // 30 jours
  });

  return {
    images: data?.images || [],
    result: data || null,
    isLoading,
    isError,
    error: error as Error | null,
    refetch: () => refetch(),
  };
}

