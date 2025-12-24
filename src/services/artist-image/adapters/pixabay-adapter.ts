/**
 * Adaptateur Pixabay API
 * Documentation: https://pixabay.com/api/docs/
 */

import type { ArtistImage, ImageSearchOptions, ImageSearchResult } from '@/types/artist-image';

interface PixabayHit {
  id: number;
  pageURL: string;
  type: string;
  tags: string;
  previewURL: string;
  previewWidth: number;
  previewHeight: number;
  webformatURL: string;
  webformatWidth: number;
  webformatHeight: number;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
  imageSize: number;
  views: number;
  downloads: number;
  collections: number;
  likes: number;
  comments: number;
  user_id: number;
  user: string;
  userImageURL: string;
}

interface PixabaySearchResponse {
  total: number;
  totalHits: number;
  hits: PixabayHit[];
}

export class PixabayAdapter {
  private apiKey: string;
  private baseUrl = 'https://pixabay.com/api';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(options: ImageSearchOptions): Promise<ImageSearchResult> {
    try {
      const { query, limit = 10, orientation } = options;
      
      // Améliorer la requête avec le contexte musical pour des résultats plus pertinents
      const enhancedQuery = query.toLowerCase().includes('artist') || query.toLowerCase().includes('musician')
        ? query
        : `${query} musician artist portrait`;
      
      const params = new URLSearchParams({
        key: this.apiKey,
        q: enhancedQuery,
        image_type: 'photo',
        per_page: Math.min(limit, 200).toString(),
        safesearch: 'true',
      });

      if (orientation) {
        params.append('orientation', orientation);
      }

      const response = await fetch(
        `${this.baseUrl}/?${params.toString()}`
      );

      if (!response.ok) {
        if (response.status === 400) {
          throw new Error('Pixabay API: Requête invalide');
        }
        throw new Error(`Pixabay API: ${response.status} ${response.statusText}`);
      }

      const data: PixabaySearchResponse = await response.json();

      const images: ArtistImage[] = data.hits.map((hit) => ({
        url: hit.largeImageURL,
        thumbnailUrl: hit.webformatURL,
        source: 'pixabay',
        width: hit.imageWidth,
        height: hit.imageHeight,
        author: hit.user,
        license: 'Pixabay License',
      }));

      return {
        images,
        total: data.totalHits,
        source: 'pixabay',
        query,
        cached: false,
      };
    } catch (error) {
      console.error('[PixabayAdapter] Error:', error);
      throw error;
    }
  }

  async getRandom(query: string): Promise<ArtistImage | null> {
    try {
      const params = new URLSearchParams({
        key: this.apiKey,
        q: query,
        image_type: 'photo',
        per_page: '1',
        safesearch: 'true',
      });

      const response = await fetch(
        `${this.baseUrl}/?${params.toString()}`
      );

      if (!response.ok) {
        return null;
      }

      const data: PixabaySearchResponse = await response.json();

      if (!data.hits || data.hits.length === 0) {
        return null;
      }

      const hit = data.hits[0];

      return {
        url: hit.largeImageURL,
        thumbnailUrl: hit.webformatURL,
        source: 'pixabay',
        width: hit.imageWidth,
        height: hit.imageHeight,
        author: hit.user,
        license: 'Pixabay License',
      };
    } catch (error) {
      console.error('[PixabayAdapter] Random error:', error);
      return null;
    }
  }
}

