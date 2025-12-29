/**
 * Service Nexus Artist Metadata Provider
 * Multi-sources avec cache intelligent et fallback automatique
 */

import type {
  ArtistMetadata,
  AlbumMetadata,
  TrackMetadata,
  MetadataSearchOptions,
  MetadataSearchResult,
  MetadataProviderConfig,
} from '@/types/artist-metadata';
import { WikipediaAdapter } from './artist-metadata/adapters/wikipedia-adapter';
import { WikidataAdapter } from './artist-metadata/adapters/wikidata-adapter';
import { MusicBrainzAdapter } from './artist-metadata/adapters/musicbrainz-adapter';
import { LastFmAdapter } from './artist-metadata/adapters/lastfm-adapter';
import { MetadataCacheManager } from './artist-metadata/cache-manager';

export class ArtistMetadataProvider {
  private config: MetadataProviderConfig;
  private cache: MetadataCacheManager;
  private adapters: {
    wikipedia?: WikipediaAdapter;
    wikidata?: WikidataAdapter;
    musicbrainz?: MusicBrainzAdapter;
    lastfm?: LastFmAdapter;
  } = {};

  constructor(config?: Partial<MetadataProviderConfig>) {
    this.config = {
      wikipedia: {
        enabled: true,
        language: 'fr',
        ...config?.wikipedia,
      },
      wikidata: {
        enabled: true,
        ...config?.wikidata,
      },
      musicbrainz: {
        enabled: true,
        userAgent: 'Nexus-Audio-Player/1.0.0',
        ...config?.musicbrainz,
      },
      lastfm: {
        enabled: true,
        ...config?.lastfm,
      },
      cache: {
        enabled: true,
        ttl: 30 * 24 * 60 * 60 * 1000, // 30 jours
        maxSize: 100, // 100 MB
        ...config?.cache,
      },
    };

    // Initialiser le cache
    this.cache = new MetadataCacheManager(
      this.config.cache?.ttl,
      this.config.cache?.maxSize
    );

    // Initialiser les adaptateurs
    if (this.config.wikipedia?.enabled) {
      this.adapters.wikipedia = new WikipediaAdapter(this.config.wikipedia.language);
    }

    if (this.config.wikidata?.enabled) {
      this.adapters.wikidata = new WikidataAdapter();
    }

    if (this.config.musicbrainz?.enabled) {
      this.adapters.musicbrainz = new MusicBrainzAdapter(
        this.config.musicbrainz.userAgent,
        this.config.musicbrainz.email
      );
    }

    if (this.config.lastfm?.enabled && this.config.lastfm?.apiKey) {
      this.adapters.lastfm = new LastFmAdapter(this.config.lastfm.apiKey);
    }
  }

  /**
   * Récupère les métadonnées d'un artiste avec fallback automatique
   */
  async getArtistMetadata(artistName: string): Promise<ArtistMetadata | null> {
    // Vérifier le cache d'abord
    if (this.config.cache?.enabled) {
      const cached = this.cache.get<ArtistMetadata>(artistName, 'artist');
      if (cached) {
        return cached;
      }
    }

    // Ordre de fallback: Last.fm → MusicBrainz → Wikidata → Wikipedia
    // Last.fm a souvent les meilleures biographies
    // MusicBrainz a les meilleures données structurées
    // Wikidata a des données enrichies
    // Wikipedia a les meilleures descriptions générales
    const sources: Array<keyof typeof this.adapters> = [
      'lastfm',
      'musicbrainz',
      'wikidata',
      'wikipedia',
    ];

    for (const source of sources) {
      const adapter = this.adapters[source];
      if (!adapter) {
        continue;
      }

      try {
        let metadata: ArtistMetadata | null = null;

        if (source === 'wikipedia') {
          metadata = await adapter.searchArtist(artistName);
        } else if (source === 'wikidata') {
          metadata = await adapter.searchArtist(artistName);
        } else if (source === 'musicbrainz') {
          metadata = await adapter.searchArtist(artistName);
        } else if (source === 'lastfm') {
          metadata = await adapter.searchArtist(artistName);
        }

        if (metadata) {
          // Mettre en cache si succès
          if (this.config.cache?.enabled) {
            this.cache.set(artistName, metadata, 'artist', source);
          }

          return metadata;
        }
      } catch (error) {
        console.warn(`[ArtistMetadataProvider] ${source} failed:`, error);
        // Continuer avec la source suivante
        continue;
      }
    }

    return null;
  }

  /**
   * Récupère les métadonnées d'un album avec fallback automatique
   */
  async getAlbumMetadata(albumName: string, artistName: string): Promise<AlbumMetadata | null> {
    const cacheKey = `${albumName} - ${artistName}`;

    // Vérifier le cache d'abord
    if (this.config.cache?.enabled) {
      const cached = this.cache.get<AlbumMetadata>(cacheKey, 'album');
      if (cached) {
        return cached;
      }
    }

    // Ordre de fallback: Last.fm → MusicBrainz → Wikipedia
    const sources: Array<keyof typeof this.adapters> = [
      'lastfm',
      'musicbrainz',
      'wikipedia',
    ];

    for (const source of sources) {
      const adapter = this.adapters[source];
      if (!adapter) {
        continue;
      }

      try {
        let metadata: AlbumMetadata | null = null;

        if (source === 'wikipedia') {
          metadata = await adapter.searchAlbum(albumName, artistName);
        } else if (source === 'musicbrainz') {
          metadata = await adapter.searchAlbum(albumName, artistName);
        } else if (source === 'lastfm') {
          metadata = await adapter.searchAlbum(albumName, artistName);
        }

        if (metadata) {
          // Mettre en cache si succès
          if (this.config.cache?.enabled) {
            this.cache.set(cacheKey, metadata, 'album', source);
          }

          return metadata;
        }
      } catch (error) {
        console.warn(`[ArtistMetadataProvider] ${source} failed:`, error);
        continue;
      }
    }

    return null;
  }

  /**
   * Recherche générique
   */
  async search(options: MetadataSearchOptions): Promise<MetadataSearchResult<ArtistMetadata | AlbumMetadata>> {
    // Vérifier le cache
    if (this.config.cache?.enabled) {
      const cached = this.cache.get(options.query, options.type);
      if (cached) {
        return {
          items: [cached] as (ArtistMetadata | AlbumMetadata)[],
          total: 1,
          source: 'cache',
          query: options.query,
          cached: true,
          type: options.type,
        };
      }
    }

    // Essayer chaque source (Wikidata n'a pas de méthode search, seulement searchArtist/searchAlbum)
    const sources: Array<keyof typeof this.adapters> = [
      'lastfm',
      'musicbrainz',
      'wikipedia',
    ];

    for (const source of sources) {
      const adapter = this.adapters[source];
      if (!adapter || source === 'wikidata') {
        continue; // Wikidata n'a pas de méthode search
      }

      try {
        // Type guard: vérifier que l'adapter a la méthode search
        if ('search' in adapter && typeof adapter.search === 'function') {
          const result = await adapter.search(options);
          if (result.items.length > 0) {
            // Mettre en cache
            if (this.config.cache?.enabled) {
              // store as array for search results
              this.cache.set(options.query, result.items, options.type, result.source);
            }
            // Ensure the returned result includes the requested type
            return { ...result, type: options.type };
          }
        }
      } catch (error) {
        console.warn(`[ArtistMetadataProvider] ${source} search failed:`, error);
        continue;
      }
    }

    return {
      items: [],
      total: 0,
      source: 'wikipedia',
      query: options.query,
      cached: false,
      type: options.type,
    };
  }

  /**
   * Combine les métadonnées de plusieurs sources
   */
  async getCombinedArtistMetadata(artistName: string): Promise<ArtistMetadata | null> {
    const results: ArtistMetadata[] = [];

    // Récupérer depuis toutes les sources disponibles
    const sources: Array<keyof typeof this.adapters> = [
      'lastfm',
      'musicbrainz',
      'wikidata',
      'wikipedia',
    ];

    for (const source of sources) {
      const adapter = this.adapters[source];
      if (!adapter) {
        continue;
      }

      try {
        const metadata = await adapter.searchArtist(artistName);
        if (metadata) {
          results.push(metadata);
        }
      } catch (error) {
        // Ignorer les erreurs
      }
    }

    if (results.length === 0) {
      return null;
    }

    // Combiner les métadonnées (priorité aux sources avec plus d'infos)
    const combined: ArtistMetadata = {
      name: results[0].name,
      source: 'wikipedia', // Source principale
    };

    // Prendre la meilleure biographie (Last.fm > Wikipedia > autres)
    const lastfm = results.find(r => r.source === 'lastfm');
    const wikipedia = results.find(r => r.source === 'wikipedia');
    const musicbrainz = results.find(r => r.source === 'musicbrainz');
    const wikidata = results.find(r => r.source === 'wikidata');

    if (lastfm?.biography) {
      combined.biography = lastfm.biography;
      combined.biographyShort = lastfm.biographyShort;
      combined.biographyUrl = lastfm.biographyUrl;
    } else if (wikipedia?.biography) {
      combined.biography = wikipedia.biography;
      combined.biographyShort = wikipedia.biographyShort;
      combined.biographyUrl = wikipedia.biographyUrl;
    }

    // Combiner les autres champs
    combined.id = musicbrainz?.id || wikidata?.id || lastfm?.id;
    combined.birthDate = wikidata?.birthDate || musicbrainz?.birthDate;
    combined.deathDate = wikidata?.deathDate || musicbrainz?.deathDate;
    combined.origin = musicbrainz?.origin || wikidata?.origin;
    combined.country = wikidata?.country || musicbrainz?.country;
    combined.genres = lastfm?.genres || musicbrainz?.genres || wikidata?.genres;
    combined.website = wikidata?.website || musicbrainz?.socialLinks?.official;
    combined.imageUrl = lastfm?.imageUrl || wikipedia?.imageUrl || wikidata?.imageUrl;
    combined.thumbnailUrl = lastfm?.thumbnailUrl || wikipedia?.thumbnailUrl;
    combined.similarArtists = lastfm?.similarArtists;

    // Combiner les liens sociaux
    combined.socialLinks = {
      ...wikidata?.socialLinks,
      ...musicbrainz?.socialLinks,
      ...lastfm?.socialLinks,
    };

    return combined;
  }

  /**
   * Vide le cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Vérifie si une source est disponible
   */
  isSourceAvailable(source: keyof typeof this.adapters): boolean {
    return !!this.adapters[source];
  }
}

// Instance singleton
let providerInstance: ArtistMetadataProvider | null = null;

/**
 * Initialise le provider avec la configuration
 */
export function initArtistMetadataProvider(config?: Partial<MetadataProviderConfig>): ArtistMetadataProvider {
  providerInstance = new ArtistMetadataProvider(config);
  return providerInstance;
}

/**
 * Récupère l'instance du provider
 */
export function getArtistMetadataProvider(): ArtistMetadataProvider {
  if (!providerInstance) {
    // Configuration par défaut depuis les variables d'environnement
    const config: Partial<MetadataProviderConfig> = {
      wikipedia: {
        enabled: true,
        language: 'fr',
      },
      wikidata: {
        enabled: true,
      },
      musicbrainz: {
        enabled: true,
        userAgent: 'Nexus-Audio-Player/1.0.0',
        email: process.env.MUSICBRAINZ_EMAIL,
      },
      lastfm: {
        enabled: !!(process.env.LASTFM_API_KEY || process.env.NEXT_PUBLIC_LASTFM_API_KEY),
        apiKey: process.env.LASTFM_API_KEY || process.env.NEXT_PUBLIC_LASTFM_API_KEY,
      },
    };

    providerInstance = new ArtistMetadataProvider(config);
  }

  return providerInstance;
}

