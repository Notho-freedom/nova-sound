/**
 * Adaptateur Unsplash API
 * Documentation: https://unsplash.com/developers
 */

import type { ArtistImage, ImageSearchOptions, ImageSearchResult } from '@/types/artist-image';

interface UnsplashPhoto {
  id: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  width: number;
  height: number;
  user: {
    name: string;
    username: string;
    links: {
      html: string;
    };
  };
  links: {
    html: string;
  };
}

interface UnsplashSearchResponse {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
}

export class UnsplashAdapter {
  private accessKey: string;
  private baseUrl = 'https://api.unsplash.com';

  constructor(accessKey: string) {
    this.accessKey = accessKey;
  }

  async search(options: ImageSearchOptions): Promise<ImageSearchResult> {
    try {
      const { query, limit = 10, orientation = 'squarish' } = options;
      
      const params = new URLSearchParams({
        query: query,
        per_page: Math.min(limit, 30).toString(),
        orientation: orientation,
      });

      const response = await fetch(
        `${this.baseUrl}/search/photos?${params.toString()}`,
        {
          headers: {
            'Authorization': `Client-ID ${this.accessKey}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Unsplash API: Quota dépassé ou clé invalide');
        }
        throw new Error(`Unsplash API: ${response.status} ${response.statusText}`);
      }

      const data: UnsplashSearchResponse = await response.json();

      const images: ArtistImage[] = data.results.map((photo) => ({
        url: photo.urls.regular,
        thumbnailUrl: photo.urls.small,
        source: 'unsplash',
        width: photo.width,
        height: photo.height,
        author: photo.user.name,
        authorUrl: photo.user.links.html,
        license: 'Unsplash License',
      }));

      return {
        images,
        total: data.total,
        source: 'unsplash',
        query,
        cached: false,
      };
    } catch (error) {
      console.error('[UnsplashAdapter] Error:', error);
      throw error;
    }
  }

  async getRandom(query: string): Promise<ArtistImage | null> {
    try {
      const params = new URLSearchParams({
        query: query,
        count: '1',
        orientation: 'squarish',
      });

      const response = await fetch(
        `${this.baseUrl}/photos/random?${params.toString()}`,
        {
          headers: {
            'Authorization': `Client-ID ${this.accessKey}`,
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data: UnsplashPhoto | UnsplashPhoto[] = await response.json();
      const photo = Array.isArray(data) ? data[0] : data;

      if (!photo) {
        return null;
      }

      return {
        url: photo.urls.regular,
        thumbnailUrl: photo.urls.small,
        source: 'unsplash',
        width: photo.width,
        height: photo.height,
        author: photo.user.name,
        authorUrl: photo.user.links.html,
        license: 'Unsplash License',
      };
    } catch (error) {
      console.error('[UnsplashAdapter] Random error:', error);
      return null;
    }
  }
}

