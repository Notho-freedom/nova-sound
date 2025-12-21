/**
 * Export centralisé pour le service Artist Image Provider
 */

export { ArtistImageProvider, initArtistImageProvider, getArtistImageProvider } from '../artist-image-provider';
export { UnsplashAdapter } from './adapters/unsplash-adapter';
export { PexelsAdapter } from './adapters/pexels-adapter';
export { PixabayAdapter } from './adapters/pixabay-adapter';
export { WikimediaAdapter } from './adapters/wikimedia-adapter';
export { CacheManager } from './cache-manager';
export type {
  ArtistImage,
  ImageSource,
  ImageSearchOptions,
  ImageSearchResult,
  ImageProviderConfig,
  CacheEntry,
} from '@/types/artist-image';

