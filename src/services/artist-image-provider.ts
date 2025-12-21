/**
 * Service Nexus Artist Image Provider
 * Multi-sources avec cache intelligent et fallback automatique
 */

import type {
  ArtistImage,
  ImageSearchOptions,
  ImageSearchResult,
  ImageProviderConfig,
} from '@/types/artist-image';
import { UnsplashAdapter } from './artist-image/adapters/unsplash-adapter';
import { PexelsAdapter } from './artist-image/adapters/pexels-adapter';
import { PixabayAdapter } from './artist-image/adapters/pixabay-adapter';
import { WikimediaAdapter } from './artist-image/adapters/wikimedia-adapter';
import { CacheManager } from './artist-image/cache-manager';

export class ArtistImageProvider {
  private config: ImageProviderConfig;
  private cache: CacheManager;
  private adapters: {
    unsplash?: UnsplashAdapter;
    pexels?: PexelsAdapter;
    pixabay?: PixabayAdapter;
    wikimedia?: WikimediaAdapter;
  } = {};

  constructor(config?: Partial<ImageProviderConfig>) {
    this.config = {
      unsplash: {
        enabled: true,
        ...config?.unsplash,
      },
      pexels: {
        enabled: true,
        ...config?.pexels,
      },
      pixabay: {
        enabled: true,
        ...config?.pixabay,
      },
      wikimedia: {
        enabled: true,
        ...config?.wikimedia,
      },
      cache: {
        enabled: true,
        ttl: 7 * 24 * 60 * 60 * 1000, // 7 jours
        maxSize: 50, // 50 MB
        ...config?.cache,
      },
    };

    // Initialiser le cache
    this.cache = new CacheManager(
      this.config.cache?.ttl,
      this.config.cache?.maxSize
    );

    // Initialiser les adaptateurs
    if (this.config.unsplash?.enabled && this.config.unsplash?.accessKey) {
      this.adapters.unsplash = new UnsplashAdapter(this.config.unsplash.accessKey);
    }

    if (this.config.pexels?.enabled && this.config.pexels?.apiKey) {
      this.adapters.pexels = new PexelsAdapter(this.config.pexels.apiKey);
    }

    if (this.config.pixabay?.enabled && this.config.pixabay?.apiKey) {
      this.adapters.pixabay = new PixabayAdapter(this.config.pixabay.apiKey);
    }

    if (this.config.wikimedia?.enabled) {
      this.adapters.wikimedia = new WikimediaAdapter();
    }
  }

  /**
   * Recherche d'images avec fallback automatique
   */
  async search(options: ImageSearchOptions): Promise<ImageSearchResult> {
    const { query } = options;

    // Vérifier le cache d'abord
    if (this.config.cache?.enabled) {
      const cached = this.cache.get(query);
      if (cached && cached.length > 0) {
        return {
          images: cached,
          total: cached.length,
          source: 'cache',
          query,
          cached: true,
        };
      }
    }

    // Ordre de fallback: Unsplash → Pexels → Pixabay → Wikimedia
    const sources: Array<keyof typeof this.adapters> = [
      'unsplash',
      'pexels',
      'pixabay',
      'wikimedia',
    ];

    for (const source of sources) {
      const adapter = this.adapters[source];
      if (!adapter) {
        continue;
      }

      try {
        const result = await adapter.search(options);

        // Mettre en cache si succès
        if (this.config.cache?.enabled && result.images.length > 0) {
          this.cache.set(query, result.images, result.source);
        }

        return result;
      } catch (error) {
        console.warn(`[ArtistImageProvider] ${source} failed:`, error);
        // Continuer avec la source suivante
        continue;
      }
    }

    // Aucune source n'a fonctionné
    return {
      images: [],
      total: 0,
      source: 'wikimedia',
      query,
      cached: false,
    };
  }

  /**
   * Récupère une image aléatoire pour un artiste
   */
  async getRandomImage(query: string): Promise<ArtistImage | null> {
    // Vérifier le cache
    if (this.config.cache?.enabled) {
      const cached = this.cache.get(query);
      if (cached && cached.length > 0) {
        // Retourner une image aléatoire du cache
        const randomIndex = Math.floor(Math.random() * cached.length);
        return cached[randomIndex];
      }
    }

    // Essayer chaque source
    const sources: Array<keyof typeof this.adapters> = [
      'unsplash',
      'pexels',
      'pixabay',
      'wikimedia',
    ];

    for (const source of sources) {
      const adapter = this.adapters[source];
      if (!adapter) {
        continue;
      }

      try {
        const image = await adapter.getRandom(query);
        if (image) {
          // Mettre en cache
          if (this.config.cache?.enabled) {
            this.cache.set(query, [image], source);
          }
          return image;
        }
      } catch (error) {
        console.warn(`[ArtistImageProvider] ${source} random failed:`, error);
        continue;
      }
    }

    return null;
  }

  /**
   * Récupère plusieurs images (pour carrousel/preview)
   */
  async getImages(query: string, limit: number = 5): Promise<ArtistImage[]> {
    const result = await this.search({ query, limit });
    return result.images.slice(0, limit);
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

// Instance singleton (sera initialisée côté client ou serveur)
let providerInstance: ArtistImageProvider | null = null;

/**
 * Initialise le provider avec la configuration
 */
export function initArtistImageProvider(config?: Partial<ImageProviderConfig>): ArtistImageProvider {
  providerInstance = new ArtistImageProvider(config);
  return providerInstance;
}

/**
 * Récupère l'instance du provider
 * Note: Pour usage côté client, utilisez plutôt la route API /api/artist-images
 * Cette fonction est principalement pour usage côté serveur
 */
export function getArtistImageProvider(): ArtistImageProvider {
  if (!providerInstance) {
    // Configuration par défaut depuis les variables d'environnement
    // Utilise les variables serveur si disponibles, sinon les variables client
    const config: Partial<ImageProviderConfig> = {
      unsplash: {
        enabled: !!(process.env.UNSPLASH_ACCESS_KEY || process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY),
        accessKey: process.env.UNSPLASH_ACCESS_KEY || process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY,
      },
      pexels: {
        enabled: !!(process.env.PEXELS_API_KEY || process.env.NEXT_PUBLIC_PEXELS_API_KEY),
        apiKey: process.env.PEXELS_API_KEY || process.env.NEXT_PUBLIC_PEXELS_API_KEY,
      },
      pixabay: {
        enabled: !!(process.env.PIXABAY_API_KEY || process.env.NEXT_PUBLIC_PIXABAY_API_KEY),
        apiKey: process.env.PIXABAY_API_KEY || process.env.NEXT_PUBLIC_PIXABAY_API_KEY,
      },
      wikimedia: {
        enabled: true, // Toujours disponible
      },
    };

    providerInstance = new ArtistImageProvider(config);
  }

  return providerInstance;
}

