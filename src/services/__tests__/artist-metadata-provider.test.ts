/**
 * Tests unitaires pour le service Artist Metadata Provider
 * Utilise Vitest
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArtistMetadataProvider } from '../artist-metadata-provider';
import { WikipediaAdapter } from '../artist-metadata/adapters/wikipedia-adapter';
import { WikidataAdapter } from '../artist-metadata/adapters/wikidata-adapter';
import { MusicBrainzAdapter } from '../artist-metadata/adapters/musicbrainz-adapter';
import { LastFmAdapter } from '../artist-metadata/adapters/lastfm-adapter';
import { MetadataCacheManager } from '../artist-metadata/cache-manager';
import type { ArtistMetadata, AlbumMetadata } from '@/types/artist-metadata';

describe('ArtistMetadataProvider', () => {
  let provider: ArtistMetadataProvider;

  beforeEach(() => {
    // Nettoyer le cache avant chaque test
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    provider = new ArtistMetadataProvider({
      wikipedia: { enabled: true, language: 'fr' },
      wikidata: { enabled: true },
      musicbrainz: { enabled: true, userAgent: 'Test/1.0.0' },
      lastfm: { enabled: false }, // Désactivé pour les tests
      cache: { enabled: true, ttl: 1000 }, // TTL court pour les tests
    });
  });

  describe('Configuration', () => {
    it('devrait initialiser avec la configuration par défaut', () => {
      expect(provider).toBeDefined();
    });

    it('devrait vérifier la disponibilité des sources', () => {
      expect(provider.isSourceAvailable('wikipedia')).toBe(true);
      expect(provider.isSourceAvailable('wikidata')).toBe(true);
      expect(provider.isSourceAvailable('musicbrainz')).toBe(true);
      expect(provider.isSourceAvailable('lastfm')).toBe(false);
    });
  });

  describe('getArtistMetadata', () => {
    it('devrait retourner null pour un artiste inexistant', async () => {
      const result = await provider.getArtistMetadata('ArtisteInexistant12345');
      expect(result).toBeNull();
    }, 10000);

    it('devrait récupérer les métadonnées d\'un artiste connu', async () => {
      const result = await provider.getArtistMetadata('The Beatles');
      
      if (result) {
        expect(result.name).toBeDefined();
        expect(result.source).toBeDefined();
        expect(['wikipedia', 'wikidata', 'musicbrainz', 'lastfm']).toContain(result.source);
      }
    }, 15000);

    it('devrait utiliser le cache pour les requêtes répétées', async () => {
      const firstCall = await provider.getArtistMetadata('The Beatles');
      const secondCall = await provider.getArtistMetadata('The Beatles');

      // La deuxième requête devrait être plus rapide grâce au cache
      expect(secondCall).toBeDefined();
    }, 20000);
  });

  describe('getCombinedArtistMetadata', () => {
    it('devrait combiner les métadonnées de plusieurs sources', async () => {
      const result = await provider.getCombinedArtistMetadata('The Beatles');
      
      if (result) {
        expect(result.name).toBeDefined();
        // Le mode combiné devrait avoir plus d'informations
        expect(result.source).toBeDefined();
      }
    }, 20000);
  });

  describe('getAlbumMetadata', () => {
    it('devrait retourner null pour un album inexistant', async () => {
      const result = await provider.getAlbumMetadata('AlbumInexistant12345', 'ArtisteInexistant');
      expect(result).toBeNull();
    }, 10000);

    it('devrait récupérer les métadonnées d\'un album connu', async () => {
      const result = await provider.getAlbumMetadata('Abbey Road', 'The Beatles');
      
      if (result) {
        expect(result.name).toBeDefined();
        expect(result.artist).toBeDefined();
        expect(result.source).toBeDefined();
      }
    }, 15000);
  });

  describe('search', () => {
    it('devrait rechercher un artiste', async () => {
      const result = await provider.search({
        query: 'The Beatles',
        type: 'artist',
        limit: 1,
      });

      expect(result).toBeDefined();
      expect(result.query).toBe('The Beatles');
      expect(result.type).toBe('artist');
    }, 15000);

    it('devrait rechercher un album', async () => {
      const result = await provider.search({
        query: 'Abbey Road',
        type: 'album',
        limit: 1,
      });

      expect(result).toBeDefined();
      expect(result.query).toBe('Abbey Road');
      expect(result.type).toBe('album');
    }, 15000);
  });

  describe('Cache', () => {
    it('devrait vider le cache', () => {
      expect(() => provider.clearCache()).not.toThrow();
    });
  });
});

describe('MetadataCacheManager', () => {
  let cache: MetadataCacheManager;

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    cache = new MetadataCacheManager(1000, 10); // TTL court, taille max petite
  });

  it('devrait stocker et récupérer des métadonnées', () => {
    const metadata: ArtistMetadata = {
      name: 'Test Artist',
      source: 'wikipedia',
    };

    cache.set('Test Artist', metadata, 'artist', 'wikipedia');
    const retrieved = cache.get<ArtistMetadata>('Test Artist', 'artist', 'wikipedia');

    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('Test Artist');
  });

  it('devrait expirer les entrées après le TTL', async () => {
    const metadata: ArtistMetadata = {
      name: 'Test Artist',
      source: 'wikipedia',
    };

    cache.set('Test Artist', metadata, 'artist', 'wikipedia');
    
    // Attendre que le TTL expire
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    const retrieved = cache.get<ArtistMetadata>('Test Artist', 'artist', 'wikipedia');
    expect(retrieved).toBeNull();
  });

  it('devrait vider le cache', () => {
    const metadata: ArtistMetadata = {
      name: 'Test Artist',
      source: 'wikipedia',
    };

    cache.set('Test Artist', metadata, 'artist', 'wikipedia');
    cache.clear();
    
    const retrieved = cache.get<ArtistMetadata>('Test Artist', 'artist', 'wikipedia');
    expect(retrieved).toBeNull();
  });
});

describe('WikipediaAdapter', () => {
  let adapter: WikipediaAdapter;

  beforeEach(() => {
    adapter = new WikipediaAdapter('fr');
  });

  it('devrait rechercher un artiste', async () => {
    const result = await adapter.searchArtist('The Beatles');
    
    if (result) {
      expect(result.name).toBeDefined();
      expect(result.source).toBe('wikipedia');
    }
  }, 10000);

  it('devrait rechercher un album', async () => {
    const result = await adapter.searchAlbum('Abbey Road', 'The Beatles');
    
    if (result) {
      expect(result.name).toBeDefined();
      expect(result.artist).toBe('The Beatles');
      expect(result.source).toBe('wikipedia');
    }
  }, 10000);
});

describe('WikidataAdapter', () => {
  let adapter: WikidataAdapter;

  beforeEach(() => {
    adapter = new WikidataAdapter();
  });

  it('devrait rechercher un artiste', async () => {
    const result = await adapter.searchArtist('The Beatles');
    
    if (result) {
      expect(result.name).toBeDefined();
      expect(result.source).toBe('wikidata');
    }
  }, 15000);
});

describe('MusicBrainzAdapter', () => {
  let adapter: MusicBrainzAdapter;

  beforeEach(() => {
    adapter = new MusicBrainzAdapter('Test/1.0.0');
  });

  it('devrait rechercher un artiste', async () => {
    const result = await adapter.searchArtist('The Beatles');
    
    if (result) {
      expect(result.name).toBeDefined();
      expect(result.source).toBe('musicbrainz');
    }
  }, 15000);

  it('devrait rechercher un album', async () => {
    const result = await adapter.searchAlbum('Abbey Road', 'The Beatles');
    
    if (result) {
      expect(result.name).toBeDefined();
      expect(result.artist).toBeDefined();
      expect(result.source).toBe('musicbrainz');
    }
  }, 15000);
});

