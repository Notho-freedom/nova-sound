/**
 * Types pour le service Artist Image Provider
 */

export type ImageSource = 'unsplash' | 'pexels' | 'pixabay' | 'wikimedia' | 'cache';

export interface ArtistImage {
  url: string;
  thumbnailUrl?: string;
  source: ImageSource;
  width?: number;
  height?: number;
  author?: string;
  authorUrl?: string;
  license?: string;
  cachedAt?: string;
}

export interface ImageSearchOptions {
  query: string;
  limit?: number;
  width?: number;
  height?: number;
  orientation?: 'landscape' | 'portrait' | 'squarish';
}

export interface ImageSearchResult {
  images: ArtistImage[];
  total: number;
  source: ImageSource;
  query: string;
  cached: boolean;
}

export interface ImageProviderConfig {
  unsplash?: {
    accessKey?: string;
    enabled: boolean;
  };
  pexels?: {
    apiKey?: string;
    enabled: boolean;
  };
  pixabay?: {
    apiKey?: string;
    enabled: boolean;
  };
  wikimedia?: {
    enabled: boolean;
  };
  cache?: {
    enabled: boolean;
    ttl?: number; // Time to live en millisecondes (défaut: 7 jours)
    maxSize?: number; // Taille max du cache en MB
  };
}

export interface CacheEntry {
  query: string;
  images: ArtistImage[];
  source: ImageSource;
  cachedAt: string;
  expiresAt: string;
}

