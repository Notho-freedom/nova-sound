/**
 * Adaptateur Wikimedia Commons API
 * Documentation: https://www.mediawiki.org/wiki/API:Main_page
 */

import type { ArtistImage, ImageSearchOptions, ImageSearchResult } from '@/types/artist-image';

interface WikimediaPage {
  pageid: number;
  ns: number;
  title: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  original?: {
    source: string;
    width: number;
    height: number;
  };
}

interface WikimediaSearchResponse {
  query: {
    pages: Record<string, WikimediaPage>;
  };
}

interface WikimediaImageInfo {
  pageid: number;
  ns: number;
  title: string;
  imagerepository: string;
  imageinfo: Array<{
    url: string;
    descriptionurl: string;
    descriptionshorturl: string;
    thumburl?: string;
    thumbwidth?: number;
    thumbheight?: number;
    width: number;
    height: number;
    extmetadata?: {
      Artist?: { value: string };
      License?: { value: string };
    };
  }>;
}

export class WikimediaAdapter {
  private baseUrl = 'https://commons.wikimedia.org/w/api.php';

  async search(options: ImageSearchOptions): Promise<ImageSearchResult> {
    try {
      const { query, limit = 10 } = options;
      
      // Étape 1: Rechercher des pages d'images
      const searchParams = new URLSearchParams({
        action: 'query',
        format: 'json',
        list: 'search',
        srsearch: `filetype:bitmap ${query}`,
        srnamespace: '6', // Namespace pour les fichiers
        srlimit: Math.min(limit, 50).toString(),
        origin: '*',
      });

      const searchResponse = await fetch(
        `${this.baseUrl}?${searchParams.toString()}`
      );

      if (!searchResponse.ok) {
        throw new Error(`Wikimedia API: ${searchResponse.status} ${searchResponse.statusText}`);
      }

      const searchData = await searchResponse.json();

      if (!searchData.query?.search || searchData.query.search.length === 0) {
        return {
          images: [],
          total: 0,
          source: 'wikimedia',
          query,
          cached: false,
        };
      }

      // Étape 2: Récupérer les infos des images
      const pageIds = searchData.query.search
        .map((page: any) => page.pageid)
        .join('|');

      const imageInfoParams = new URLSearchParams({
        action: 'query',
        format: 'json',
        pageids: pageIds,
        prop: 'imageinfo',
        iiprop: 'url|thumburl|size|extmetadata',
        iiurlwidth: '800',
        origin: '*',
      });

      const imageInfoResponse = await fetch(
        `${this.baseUrl}?${imageInfoParams.toString()}`
      );

      if (!imageInfoResponse.ok) {
        throw new Error(`Wikimedia API: ${imageInfoResponse.status} ${imageInfoResponse.statusText}`);
      }

      const imageInfoData = await imageInfoResponse.json();

      const images: ArtistImage[] = Object.values<WikimediaImageInfo>(
        imageInfoData.query?.pages || {}
      )
        .filter((page) => page.imageinfo && page.imageinfo.length > 0)
        .map((page) => {
          const info = page.imageinfo[0];
          return {
            url: info.url,
            thumbnailUrl: info.thumburl || info.url,
            source: 'wikimedia' as const,
            width: info.width,
            height: info.height,
            author: info.extmetadata?.Artist?.value,
            license: info.extmetadata?.License?.value || 'Public Domain / CC',
          };
        });

      return {
        images,
        total: searchData.query.searchinfo?.totalhits || images.length,
        source: 'wikimedia',
        query,
        cached: false,
      };
    } catch (error) {
      console.error('[WikimediaAdapter] Error:', error);
      throw error;
    }
  }

  async getRandom(query: string): Promise<ArtistImage | null> {
    try {
      const result = await this.search({ query, limit: 1 });
      
      if (result.images.length === 0) {
        return null;
      }

      return result.images[0];
    } catch (error) {
      console.error('[WikimediaAdapter] Random error:', error);
      return null;
    }
  }
}

