/**
 * Adaptateur Last.fm API
 * Documentation: https://www.last.fm/api
 * Note: Nécessite une clé API (gratuite)
 */

import type { ArtistMetadata, AlbumMetadata, MetadataSearchOptions, MetadataSearchResult } from '@/types/artist-metadata';

interface LastFmArtist {
  name: string;
  mbid?: string;
  url: string;
  image?: Array<{
    '#text': string;
    size: string;
  }>;
  streamable?: string;
  listeners?: string;
  playcount?: string;
  ontour?: string;
  stats?: {
    listeners: string;
    playcount: string;
  };
  similar?: {
    artist?: Array<{
      name: string;
      url: string;
    }>;
  };
  tags?: {
    tag?: Array<{
      name: string;
      url: string;
    }>;
  };
  bio?: {
    summary: string;
    content: string;
    published: string;
  };
}

interface LastFmAlbum {
  name: string;
  artist: string;
  mbid?: string;
  url: string;
  image?: Array<{
    '#text': string;
    size: string;
  }>;
  listeners?: string;
  playcount?: string;
  tracks?: {
    track?: Array<{
      name: string;
      duration?: string;
    }>;
  };
  tags?: {
    tag?: Array<{
      name: string;
      url: string;
    }>;
  };
  wiki?: {
    summary: string;
    content: string;
    published: string;
  };
}

interface LastFmResponse<T> {
  results?: {
    artistmatches?: {
      artist?: T[];
    };
    albummatches?: {
      album?: T[];
    };
    artist?: T;
    album?: T;
  };
}

export class LastFmAdapter {
  private apiKey: string;
  private baseUrl = 'https://ws.audioscrobbler.com/2.0';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Recherche un artiste sur Last.fm
   */
  async searchArtist(artistName: string): Promise<ArtistMetadata | null> {
    try {
      const params = new URLSearchParams({
        method: 'artist.getinfo',
        artist: artistName,
        api_key: this.apiKey,
        format: 'json',
        lang: 'fr',
      });

      const response = await fetch(`${this.baseUrl}?${params.toString()}`);

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Last.fm API: Clé API invalide');
        }
        return null;
      }

      const data: LastFmResponse<LastFmArtist> = await response.json();
      const artist = data.results?.artist;

      if (!artist) {
        return null;
      }

      // Extraire l'image la plus grande
      const images = artist.image || [];
      const largeImage = images.find(img => img.size === 'large') || images[images.length - 1];
      const imageUrl = largeImage?.['#text'] || undefined;

      // Extraire les genres depuis les tags
      const genres = (artist.tags?.tag || [])
        .map(tag => tag.name)
        .slice(0, 5);

      // Extraire les artistes similaires
      const similarArtists = (artist.similar?.artist || [])
        .map(art => art.name)
        .slice(0, 10);

      // Nettoyer la biographie (enlever les liens HTML)
      const bio = artist.bio?.summary || artist.bio?.content || '';
      const cleanBio = bio
        .replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1')
        .replace(/<[^>]*>/g, '')
        .trim();

      const metadata: ArtistMetadata = {
        id: artist.mbid,
        name: artist.name,
        biography: cleanBio,
        biographyShort: cleanBio.substring(0, 200),
        biographyUrl: artist.url,
        genres: genres.length > 0 ? genres : undefined,
        imageUrl: imageUrl,
        thumbnailUrl: imageUrl,
        similarArtists: similarArtists.length > 0 ? similarArtists : undefined,
        socialLinks: {
          official: artist.url,
        },
        source: 'lastfm',
      };

      return metadata;
    } catch (error) {
      console.error('[LastFmAdapter] Error:', error);
      return null;
    }
  }

  /**
   * Recherche un album sur Last.fm
   */
  async searchAlbum(albumName: string, artistName: string): Promise<AlbumMetadata | null> {
    try {
      const params = new URLSearchParams({
        method: 'album.getinfo',
        album: albumName,
        artist: artistName,
        api_key: this.apiKey,
        format: 'json',
        lang: 'fr',
      });

      const response = await fetch(`${this.baseUrl}?${params.toString()}`);

      if (!response.ok) {
        return null;
      }

      const data: LastFmResponse<LastFmAlbum> = await response.json();
      const album = data.results?.album;

      if (!album) {
        return null;
      }

      // Extraire l'image la plus grande
      const images = album.image || [];
      const largeImage = images.find(img => img.size === 'large') || images[images.length - 1];
      const coverUrl = largeImage?.['#text'] || undefined;

      // Extraire les genres depuis les tags
      const genres = (album.tags?.tag || [])
        .map(tag => tag.name)
        .slice(0, 3);

      // Nettoyer la description
      const description = album.wiki?.summary || album.wiki?.content || '';
      const cleanDescription = description
        .replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1')
        .replace(/<[^>]*>/g, '')
        .trim();

      // Compter les pistes
      const trackCount = album.tracks?.track?.length || undefined;

      // Calculer la durée totale
      const duration = album.tracks?.track?.reduce((total, track) => {
        const trackDuration = parseInt(track.duration || '0', 10);
        return total + trackDuration;
      }, 0);

      const metadata: AlbumMetadata = {
        id: album.mbid,
        name: album.name,
        artist: album.artist,
        genre: genres[0],
        genres: genres.length > 0 ? genres : undefined,
        description: cleanDescription,
        descriptionUrl: album.url,
        coverUrl: coverUrl,
        thumbnailUrl: coverUrl,
        trackCount: trackCount,
        duration: duration ? Math.round(duration / 1000) : undefined, // Convertir en secondes
        source: 'lastfm',
      };

      return metadata;
    } catch (error) {
      console.error('[LastFmAdapter] Error:', error);
      return null;
    }
  }

  /**
   * Recherche générique
   */
  async search(options: MetadataSearchOptions): Promise<MetadataSearchResult<ArtistMetadata | AlbumMetadata>> {
    if (options.type === 'artist') {
      const artist = await this.searchArtist(options.query);
      return {
        items: artist ? [artist] : [],
        total: artist ? 1 : 0,
        source: 'lastfm',
        query: options.query,
        cached: false,
      };
    } else if (options.type === 'album') {
      // Last.fm nécessite le nom de l'artiste pour les albums
      // On va essayer de l'extraire de la query ou utiliser une recherche
      const parts = options.query.split(' - ');
      const albumName = parts[0].trim();
      const artistName = parts[1]?.trim() || '';

      const album = await this.searchAlbum(albumName, artistName);
      return {
        items: album ? [album] : [],
        total: album ? 1 : 0,
        source: 'lastfm',
        query: options.query,
        cached: false,
      };
    }

    return {
      items: [],
      total: 0,
      source: 'lastfm',
      query: options.query,
      cached: false,
    };
  }
}

