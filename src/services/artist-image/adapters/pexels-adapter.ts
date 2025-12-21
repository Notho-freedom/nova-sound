/**
 * Adaptateur Pexels API
 * Documentation: https://www.pexels.com/api/
 */

import type { ArtistImage, ImageSearchOptions, ImageSearchResult } from '@/types/artist-image';

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
}

interface PexelsSearchResponse {
  total_results: number;
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
}

export class PexelsAdapter {
  private apiKey: string;
  private baseUrl = 'https://api.pexels.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(options: ImageSearchOptions): Promise<ImageSearchResult> {
    try {
      const { query, limit = 10, orientation } = options;
      
      const params = new URLSearchParams({
        query: query,
        per_page: Math.min(limit, 80).toString(),
      });

      if (orientation) {
        params.append('orientation', orientation);
      }

      const response = await fetch(
        `${this.baseUrl}/search?${params.toString()}`,
        {
          headers: {
            'Authorization': this.apiKey,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Pexels API: Clé API invalide');
        }
        if (response.status === 429) {
          throw new Error('Pexels API: Limite de requêtes dépassée');
        }
        throw new Error(`Pexels API: ${response.status} ${response.statusText}`);
      }

      const data: PexelsSearchResponse = await response.json();

      const images: ArtistImage[] = data.photos.map((photo) => ({
        url: photo.src.large,
        thumbnailUrl: photo.src.medium,
        source: 'pexels',
        width: photo.width,
        height: photo.height,
        author: photo.photographer,
        authorUrl: photo.photographer_url,
        license: 'Pexels License',
      }));

      return {
        images,
        total: data.total_results,
        source: 'pexels',
        query,
        cached: false,
      };
    } catch (error) {
      console.error('[PexelsAdapter] Error:', error);
      throw error;
    }
  }

  async getRandom(query: string): Promise<ArtistImage | null> {
    try {
      const params = new URLSearchParams({
        query: query,
        per_page: '1',
      });

      const response = await fetch(
        `${this.baseUrl}/search?${params.toString()}`,
        {
          headers: {
            'Authorization': this.apiKey,
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data: PexelsSearchResponse = await response.json();

      if (!data.photos || data.photos.length === 0) {
        return null;
      }

      const photo = data.photos[0];

      return {
        url: photo.src.large,
        thumbnailUrl: photo.src.medium,
        source: 'pexels',
        width: photo.width,
        height: photo.height,
        author: photo.photographer,
        authorUrl: photo.photographer_url,
        license: 'Pexels License',
      };
    } catch (error) {
      console.error('[PexelsAdapter] Random error:', error);
      return null;
    }
  }
}

