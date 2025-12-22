/**
 * Types pour le service Artist Metadata Provider
 */

export type MetadataSource = 'wikipedia' | 'wikidata' | 'musicbrainz' | 'lastfm' | 'cache';

export interface ArtistMetadata {
  id?: string;
  name: string;
  biography?: string;
  biographyShort?: string;
  biographyUrl?: string;
  birthDate?: string;
  deathDate?: string;
  origin?: string;
  country?: string;
  genres?: string[];
  yearsActive?: string;
  website?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  socialLinks?: {
    wikipedia?: string;
    official?: string;
    facebook?: string;
    twitter?: string;
    instagram?: string;
    youtube?: string;
  };
  albums?: AlbumMetadata[];
  similarArtists?: string[];
  source: MetadataSource;
  cachedAt?: string;
}

export interface AlbumMetadata {
  id?: string;
  name: string;
  artist: string;
  releaseDate?: string;
  year?: number;
  genre?: string;
  genres?: string[];
  description?: string;
  descriptionUrl?: string;
  coverUrl?: string;
  thumbnailUrl?: string;
  trackCount?: number;
  duration?: number;
  label?: string;
  format?: string;
  source: MetadataSource;
  cachedAt?: string;
}

export interface TrackMetadata {
  id?: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  releaseDate?: string;
  genre?: string;
  lyrics?: string;
  description?: string;
  source: MetadataSource;
  cachedAt?: string;
}

export interface MetadataSearchOptions {
  query: string;
  type: 'artist' | 'album' | 'track';
  limit?: number;
}

export interface MetadataSearchResult<T> {
  items: T[];
  total: number;
  source: MetadataSource;
  query: string;
  cached: boolean;
}

export interface MetadataProviderConfig {
  wikipedia?: {
    enabled: boolean;
    language?: string; // 'fr', 'en', etc.
  };
  wikidata?: {
    enabled: boolean;
  };
  musicbrainz?: {
    enabled: boolean;
    userAgent?: string; // Requis par MusicBrainz
    email?: string; // Recommandé
  };
  lastfm?: {
    enabled: boolean;
    apiKey?: string;
  };
  cache?: {
    enabled: boolean;
    ttl?: number; // Time to live en millisecondes (défaut: 30 jours)
    maxSize?: number; // Taille max du cache en MB
  };
}

export interface CacheEntry {
  query: string;
  type: 'artist' | 'album' | 'track';
  data: ArtistMetadata | AlbumMetadata | TrackMetadata | (ArtistMetadata | AlbumMetadata | TrackMetadata)[];
  source: MetadataSource;
  cachedAt: string;
  expiresAt: string;
}

