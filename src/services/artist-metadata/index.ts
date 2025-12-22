/**
 * Export centralisé pour le service Artist Metadata Provider
 */

export { ArtistMetadataProvider, initArtistMetadataProvider, getArtistMetadataProvider } from '../artist-metadata-provider';
export { WikipediaAdapter } from './adapters/wikipedia-adapter';
export { WikidataAdapter } from './adapters/wikidata-adapter';
export { MusicBrainzAdapter } from './adapters/musicbrainz-adapter';
export { LastFmAdapter } from './adapters/lastfm-adapter';
export { MetadataCacheManager } from './cache-manager';
export type {
  ArtistMetadata,
  AlbumMetadata,
  TrackMetadata,
  MetadataSource,
  MetadataSearchOptions,
  MetadataSearchResult,
  MetadataProviderConfig,
  CacheEntry,
} from '@/types/artist-metadata';

