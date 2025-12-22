/**
 * Adaptateur Wikipedia API
 * Documentation: https://www.mediawiki.org/wiki/API:Main_page
 */

import type { ArtistMetadata, AlbumMetadata, MetadataSearchOptions, MetadataSearchResult } from '@/types/artist-metadata';

interface WikipediaPage {
  pageid: number;
  ns: number;
  title: string;
  extract?: string;
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
  fullurl?: string;
}

interface WikipediaSearchResponse {
  query: {
    search?: Array<{
      title: string;
      pageid: number;
      snippet: string;
    }>;
    pages?: Record<string, WikipediaPage>;
  };
}

export class WikipediaAdapter {
  private baseUrl: string;
  private language: string;

  constructor(language: string = 'fr') {
    this.language = language;
    this.baseUrl = `https://${language}.wikipedia.org/w/api.php`;
  }

  /**
   * Recherche un artiste sur Wikipedia
   */
  async searchArtist(artistName: string): Promise<ArtistMetadata | null> {
    try {
      // Étape 1: Rechercher la page
      const searchParams = new URLSearchParams({
        action: 'query',
        format: 'json',
        list: 'search',
        srsearch: artistName,
        srlimit: '1',
        origin: '*',
      });

      const searchResponse = await fetch(`${this.baseUrl}?${searchParams.toString()}`);
      if (!searchResponse.ok) {
        return null;
      }

      const searchData: WikipediaSearchResponse = await searchResponse.json();
      const results = searchData.query?.search;

      if (!results || results.length === 0) {
        return null;
      }

      const pageTitle = results[0].title;

      // Étape 2: Récupérer le contenu de la page
      const contentParams = new URLSearchParams({
        action: 'query',
        format: 'json',
        titles: pageTitle,
        prop: 'extracts|pageimages|info',
        exintro: 'true',
        explaintext: 'true',
        exsentences: '10',
        piprop: 'thumbnail|original',
        pithumbsize: '800',
        inprop: 'url',
        origin: '*',
      });

      const contentResponse = await fetch(`${this.baseUrl}?${contentParams.toString()}`);
      if (!contentResponse.ok) {
        return null;
      }

      const contentData: WikipediaSearchResponse = await contentResponse.json();
      const pages = contentData.query?.pages;

      if (!pages) {
        return null;
      }

      const page = Object.values(pages)[0];
      if (!page || !page.extract) {
        return null;
      }

      // Extraire des informations de base depuis l'extrait
      const extract = page.extract;
      const biographyShort = extract.split('\n')[0]; // Première phrase
      const biography = extract.substring(0, 1000); // Limiter à 1000 caractères

      // Parser les infobox si possible (nécessiterait un parsing HTML plus complexe)
      const metadata: ArtistMetadata = {
        name: page.title,
        biography: biography,
        biographyShort: biographyShort,
        biographyUrl: page.fullurl,
        imageUrl: page.original?.source || page.thumbnail?.source,
        thumbnailUrl: page.thumbnail?.source,
        source: 'wikipedia',
      };

      return metadata;
    } catch (error) {
      console.error('[WikipediaAdapter] Error:', error);
      return null;
    }
  }

  /**
   * Recherche un album sur Wikipedia
   */
  async searchAlbum(albumName: string, artistName: string): Promise<AlbumMetadata | null> {
    try {
      const query = `${albumName} ${artistName}`;
      
      const searchParams = new URLSearchParams({
        action: 'query',
        format: 'json',
        list: 'search',
        srsearch: query,
        srlimit: '1',
        origin: '*',
      });

      const searchResponse = await fetch(`${this.baseUrl}?${searchParams.toString()}`);
      if (!searchResponse.ok) {
        return null;
      }

      const searchData: WikipediaSearchResponse = await searchResponse.json();
      const results = searchData.query?.search;

      if (!results || results.length === 0) {
        return null;
      }

      const pageTitle = results[0].title;

      const contentParams = new URLSearchParams({
        action: 'query',
        format: 'json',
        titles: pageTitle,
        prop: 'extracts|pageimages|info',
        exintro: 'true',
        explaintext: 'true',
        exsentences: '5',
        piprop: 'thumbnail',
        pithumbsize: '800',
        inprop: 'url',
        origin: '*',
      });

      const contentResponse = await fetch(`${this.baseUrl}?${contentParams.toString()}`);
      if (!contentResponse.ok) {
        return null;
      }

      const contentData: WikipediaSearchResponse = await contentResponse.json();
      const pages = contentData.query?.pages;

      if (!pages) {
        return null;
      }

      const page = Object.values(pages)[0];
      if (!page || !page.extract) {
        return null;
      }

      const extract = page.extract;
      const description = extract.substring(0, 500);

      const metadata: AlbumMetadata = {
        name: page.title,
        artist: artistName,
        description: description,
        descriptionUrl: page.fullurl,
        coverUrl: page.thumbnail?.source,
        thumbnailUrl: page.thumbnail?.source,
        source: 'wikipedia',
      };

      return metadata;
    } catch (error) {
      console.error('[WikipediaAdapter] Error:', error);
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
        source: 'wikipedia',
        query: options.query,
        cached: false,
      };
    } else if (options.type === 'album') {
      // Pour les albums, on a besoin du nom de l'artiste
      // On va essayer de l'extraire de la query ou utiliser une recherche simple
      const album = await this.searchAlbum(options.query, '');
      return {
        items: album ? [album] : [],
        total: album ? 1 : 0,
        source: 'wikipedia',
        query: options.query,
        cached: false,
      };
    }

    return {
      items: [],
      total: 0,
      source: 'wikipedia',
      query: options.query,
      cached: false,
    };
  }
}

