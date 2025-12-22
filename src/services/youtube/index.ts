/**
 * Service YouTube unifié
 * Point d'entrée central pour toutes les fonctionnalités YouTube
 */

// Exporter les types
export * from './types';

// Exporter les services
export { youtubeCache, YouTubeCache } from './cache';
export { youtubeQuota, YouTubeQuotaManager } from './quota';
export { youtubeSearch, YouTubeSearchService } from './search';
export { youtubePlayer, YouTubePlayerService } from './player';

// Exporter les fonctions de fallback
export {
  getVideoViaOEmbed,
  getVideosViaOEmbed,
  createMinimalVideo,
  getBestThumbnail,
  thumbnailExists,
  searchViaInvidious,
  getPopularSuggestions,
  generateSmartSuggestions,
} from './fallback';

// ==================== API SIMPLIFIÉE ====================

import { youtubeSearch } from './search';
import { youtubePlayer } from './player';
import { youtubeCache } from './cache';
import { youtubeQuota } from './quota';
import type { YouTubeVideo } from './types';

/**
 * API simplifiée pour les cas d'usage courants
 */
export const YouTube = {
  // Recherche
  search: (query: string, maxResults?: number) => 
    youtubeSearch.search(query, { maxResults }),
  
  getVideo: (videoId: string) => 
    youtubeSearch.getVideo(videoId),
  
  getAutocomplete: (query: string) => 
    youtubeSearch.getAutocomplete(query),

  // Player
  play: (videoOrId: YouTubeVideo | string) => 
    youtubePlayer.setCurrentVideo(videoOrId),
  
  getCurrentVideo: () => 
    youtubePlayer.getCurrentVideo(),
  
  addToQueue: (video: YouTubeVideo) => 
    youtubePlayer.addToQueue(video),
  
  getQueue: () => 
    youtubePlayer.getQueue(),
  
  playNext: () => 
    youtubePlayer.playNext(),
  
  playPrevious: () => 
    youtubePlayer.playPrevious(),

  // Prefetch
  prefetch: (videoId: string) => 
    youtubePlayer.prefetch(videoId),
  
  onHover: (videoId: string) => 
    youtubePlayer.onHover(videoId),

  // Cache
  clearCache: () => 
    youtubeCache.clear(),
  
  getCacheStats: () => 
    youtubeCache.getStats(),

  // Quota
  getQuotaStatus: () => 
    youtubeQuota.getStatus(),
  
  isQuotaExhausted: () => 
    youtubeQuota.isQuotaExhausted(),

  // Utilitaires
  extractVideoId: (url: string) => 
    youtubeSearch.extractVideoId(url),
  
  isValidVideoId: (id: string) => 
    youtubeSearch.isValidVideoId(id),
  
  getEmbedUrl: (videoId: string, options?: { autoplay?: boolean; start?: number }) => 
    youtubePlayer.getEmbedUrl(videoId, options),
  
  getWatchUrl: (videoId: string) => 
    youtubePlayer.getWatchUrl(videoId),

  // Configuration
  setApiKey: (key: string) => 
    youtubeSearch.setApiKey(key),
};

// Export par défaut
export default YouTube;
