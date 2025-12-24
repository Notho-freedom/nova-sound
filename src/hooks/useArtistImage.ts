/**
 * Hook React pour récupérer des images d'artistes
 * Utilise React Query pour le cache et la gestion d'état
 * Avec fallback sur ArtistImageProvider si l'API n'est pas disponible
 */

import { useQuery } from '@tanstack/react-query';
import type { ArtistImage, ImageSearchResult } from '@/types/artist-image';
import { getArtistImageProvider } from '@/services/artist-image-provider';

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
 * Améliore la requête avec le contexte musical pour des résultats plus pertinents
 * Évite les résultats génériques (ex: "Royal" → rue royale au lieu de l'artiste)
 */
function enhanceQueryForArtist(query: string): string {
  // Si la requête contient déjà des mots-clés pertinents, ne pas modifier
  const lowerQuery = query.toLowerCase();
  if (lowerQuery.includes('artist') || 
      lowerQuery.includes('musician') || 
      lowerQuery.includes('singer') ||
      lowerQuery.includes('band') ||
      lowerQuery.includes('performer')) {
    return query;
  }
  // Ajouter le contexte musical pour de meilleurs résultats
  return `${query} musician artist singer portrait`;
}

/**
 * Fetches artist image from API with fallback to direct provider
 * Utilise requestIdleCallback pour ne pas bloquer l'UI
 */
async function fetchArtistImageWithFallback(query: string, random: boolean = true): Promise<{ image: ArtistImage | null }> {
  // Attendre un moment d'inactivité pour ne pas bloquer l'UI
  await new Promise<void>((resolve) => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => resolve(), { timeout: 1000 });
    } else {
      // Fallback pour les environnements sans requestIdleCallback
      queueMicrotask(resolve);
    }
  });

  const enhancedQuery = enhanceQueryForArtist(query);
  
  try {
    // Try API first
    const params = new URLSearchParams({
      query: enhancedQuery,
      random: random ? 'true' : 'false',
    });

    const response = await fetch(`/api/artist-images?${params.toString()}`);
    
    // Check if API is available
    if (response.ok) {
      return response.json();
    }
    
    // If API returns 503 (server not available) or 404, use fallback
    if (response.status === 503 || response.status === 404) {
      console.info('[useArtistImage] API not available, using direct provider fallback');
      const provider = getArtistImageProvider();
      const image = await provider.getRandomImage(enhancedQuery);
      return { image };
    }
    
    throw new Error(`Failed to fetch artist image: ${response.statusText}`);
  } catch (error) {
    // Network error - API server not running, use fallback
    console.info('[useArtistImage] Network error, using direct provider fallback:', error);
    try {
      const provider = getArtistImageProvider();
      const image = await provider.getRandomImage(enhancedQuery);
      return { image };
    } catch (fallbackError) {
      console.warn('[useArtistImage] Fallback also failed:', fallbackError);
      return { image: null };
    }
  }
}

/**
 * Fetches multiple artist images from API with fallback to direct provider
 * Utilise requestIdleCallback pour ne pas bloquer l'UI
 */
async function fetchArtistImagesWithFallback(query: string, limit: number = 10): Promise<ImageSearchResult> {
  // Attendre un moment d'inactivité pour ne pas bloquer l'UI
  await new Promise<void>((resolve) => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => resolve(), { timeout: 1000 });
    } else {
      queueMicrotask(resolve);
    }
  });

  const enhancedQuery = enhanceQueryForArtist(query);
  
  try {
    // Try API first
    const params = new URLSearchParams({
      query: enhancedQuery,
      limit: limit.toString(),
    });

    const response = await fetch(`/api/artist-images?${params.toString()}`);
    
    // Check if API is available
    if (response.ok) {
      return response.json();
    }
    
    // If API returns 503 (server not available) or 404, use fallback
    if (response.status === 503 || response.status === 404) {
      console.info('[useArtistImages] API not available, using direct provider fallback');
      const provider = getArtistImageProvider();
      const result = await provider.search({ query: enhancedQuery, limit });
      return result;
    }
    
    throw new Error(`Failed to fetch artist images: ${response.statusText}`);
  } catch (error) {
    // Network error - API server not running, use fallback
    console.info('[useArtistImages] Network error, using direct provider fallback:', error);
    try {
      const provider = getArtistImageProvider();
      const result = await provider.search({ query: enhancedQuery, limit });
      return result;
    } catch (fallbackError) {
      console.warn('[useArtistImages] Fallback also failed:', fallbackError);
      return { images: [], total: 0, source: 'wikimedia', query, cached: false };
    }
  }
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
  } = useQuery<{ image: ArtistImage | null }>({
    queryKey: ['artist-image', query, 'random'],
    queryFn: () => fetchArtistImageWithFallback(query, random),
    enabled: enabled && !!query,
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 jours
    gcTime: 30 * 24 * 60 * 60 * 1000, // 30 jours (anciennement cacheTime)
    retry: 1, // Only retry once since we have fallback logic
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
    queryFn: () => fetchArtistImagesWithFallback(query, limit),
    enabled: enabled && !!query,
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 jours
    gcTime: 30 * 24 * 60 * 60 * 1000, // 30 jours
    retry: 1, // Only retry once since we have fallback logic
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

