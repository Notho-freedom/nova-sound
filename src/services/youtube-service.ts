/**
 * Service YouTube Centralisé - Nexus
 * 
 * Service unifié qui centralise toutes les fonctionnalités YouTube :
 * - Recherche
 * - Métadonnées
 * - Cache
 * - Quota management
 * - Suggestions
 * - Batch operations
 * 
 * Ce service remplace progressivement les appels directs aux services individuels
 * pour une meilleure cohérence et maintenabilité.
 */

import { youtubeProvider } from './youtube-provider';
import { youtubeCacheService } from './youtube-cache';
import { youtubeQuotaManager, QuotaState } from './youtube-quota-manager';
import { youtubeOEmbedService } from './youtube-oembed';
import { youtubeBatchService } from './youtube-batch';
import { youtubePrefetchService } from './youtube-prefetch';
import type { Video } from '@/types/music';
import type { YouTubeSearchResult } from '@/hooks/useYouTubeSearch';
import { extractYouTubeVideoId } from '@/lib/youtube';
import { youtubeVideoToTrack } from '@/lib/youtube-to-track';
import type { Track } from '@/types/music';

export interface YouTubeServiceConfig {
  enableCache?: boolean;
  enablePrefetch?: boolean;
  maxResults?: number;
}

export interface YouTubeSearchOptions {
  maxResults?: number;
  useCache?: boolean;
  fallbackToHistory?: boolean;
}

export interface YouTubeMetadataOptions {
  useCache?: boolean;
  useOEmbed?: boolean;
  useAPI?: boolean;
}

/**
 * Service YouTube Centralisé
 */
class YouTubeService {
  private defaultConfig: YouTubeServiceConfig = {
    enableCache: true,
    enablePrefetch: true,
    maxResults: 20,
  };

  /**
   * Configure le service
   */
  configure(config: Partial<YouTubeServiceConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }

  /**
   * Récupère les métadonnées d'une vidéo YouTube
   * Utilise le routing intelligent (cache → oEmbed → API → fallback)
   */
  async getVideoMetadata(
    videoId: string,
    options: YouTubeMetadataOptions = {}
  ): Promise<{
    success: boolean;
    metadata?: {
      id: string;
      title: string;
      description?: string;
      channelTitle: string;
      channelId?: string;
      publishedAt?: string;
      duration?: number;
      viewCount?: number;
      likeCount?: number;
      thumbnailUrl: string;
      thumbnailHighUrl?: string;
      tags?: string[];
      categoryId?: string;
    };
    source: 'cache' | 'oembed' | 'api' | 'fallback';
    error?: string;
  }> {
    return youtubeProvider.getVideoMetadata(videoId);
  }

  /**
   * Recherche des vidéos YouTube
   * Utilise le cache et le fallback intelligent
   */
  async searchVideos(
    query: string,
    options: YouTubeSearchOptions = {}
  ): Promise<{
    results: YouTubeSearchResult[];
    source: 'api' | 'cache' | 'fallback';
    error?: string;
  }> {
    const maxResults = options.maxResults || this.defaultConfig.maxResults || 20;
    const useCache = options.useCache !== false;

    // 1. Vérifier le cache si activé
    if (useCache) {
      try {
        const cached = await youtubeCacheService.getSearch(query);
        if (cached && cached.results.length > 0) {
          return {
            results: cached.results.map(v => ({
              videoId: v.videoId,
              title: v.title,
              description: v.description,
              thumbnailUrl: v.thumbnailUrl,
              channelTitle: v.channelTitle,
              publishedAt: v.publishedAt,
              duration: v.duration ? `PT${Math.floor(v.duration / 3600)}H${Math.floor((v.duration % 3600) / 60)}M${v.duration % 60}S` : undefined,
              viewCount: v.viewCount?.toString(),
            })),
            source: 'cache',
          };
        }
      } catch (error) {
        console.warn('[YouTubeService] Erreur cache:', error);
      }
    }

    // 2. Vérifier le quota et utiliser l'API si disponible
    if (youtubeQuotaManager.canUseAPI() && youtubeQuotaManager.canSearch()) {
      try {
        const apiKey = this.getYouTubeApiKey();
        if (apiKey) {
          const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?` +
            `part=snippet&` +
            `q=${encodeURIComponent(query)}&` +
            `type=video&` +
            `maxResults=${maxResults}&` +
            `key=${apiKey}`
          );

          if (response.ok) {
            const data = await response.json();
            
            // Récupérer les détails (durée, vues)
            const videoIds = data.items.map((item: any) => item.id.videoId).join(',');
            const detailsResponse = await fetch(
              `https://www.googleapis.com/youtube/v3/videos?` +
              `part=contentDetails,statistics&` +
              `id=${videoIds}&` +
              `key=${apiKey}`
            );

            const detailsData = detailsResponse.ok ? await detailsResponse.json() : { items: [] };
            const detailsMap = new Map<string, any>(
              detailsData.items.map((item: any) => [item.id, item])
            );

            const results: YouTubeSearchResult[] = data.items.map((item: any) => {
              const details = detailsMap.get(item.id.videoId);
              return {
                videoId: item.id.videoId,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnailUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default.url,
                channelTitle: item.snippet.channelTitle,
                publishedAt: item.snippet.publishedAt,
                duration: details?.contentDetails?.duration,
                viewCount: details?.statistics?.viewCount,
              };
            });

            // Mettre en cache
            if (useCache) {
              try {
                const videosForCache = results.map(result => ({
                  id: result.videoId,
                  videoId: result.videoId,
                  title: result.title,
                  description: result.description,
                  channelTitle: result.channelTitle,
                  channelId: '',
                  publishedAt: result.publishedAt,
                  duration: result.duration ? this.parseDuration(result.duration) : undefined,
                  viewCount: result.viewCount ? parseInt(result.viewCount) : undefined,
                  thumbnailUrl: result.thumbnailUrl,
                  thumbnailHighUrl: result.thumbnailUrl,
                }));
                await youtubeCacheService.setSearch(query, videosForCache as any);
              } catch (error) {
                console.warn('[YouTubeService] Erreur mise en cache:', error);
              }
            }

            // Consommer le quota
            youtubeQuotaManager.consumeSearch();
            youtubeQuotaManager.recordSuccess();

            return { results, source: 'api' };
          } else {
            const isQuotaError = response.status === 403 || response.status === 429;
            if (isQuotaError) {
              youtubeQuotaManager.recordFailure();
            }
          }
        }
      } catch (error) {
        console.warn('[YouTubeService] Erreur API:', error);
      }
    }

    // 3. Fallback : chercher dans l'historique si activé
    if (options.fallbackToHistory !== false) {
      try {
        if (typeof window !== 'undefined') {
          const searchHistory = JSON.parse(localStorage.getItem('nexus-search-history') || '[]') as string[];
          const queryLower = query.toLowerCase();
          
          const similarSearches = searchHistory
            .filter(h => h.toLowerCase().includes(queryLower) || queryLower.includes(h.toLowerCase()))
            .slice(0, 3);
          
          for (const similarQuery of similarSearches) {
            const cached = await youtubeCacheService.getSearch(similarQuery);
            if (cached && cached.results.length > 0) {
              const matchingResults = cached.results
                .filter(v => 
                  v.title.toLowerCase().includes(queryLower) ||
                  v.channelTitle.toLowerCase().includes(queryLower)
                )
                .map(v => ({
                  videoId: v.videoId,
                  title: v.title,
                  description: v.description,
                  thumbnailUrl: v.thumbnailUrl,
                  channelTitle: v.channelTitle,
                  publishedAt: v.publishedAt,
                  duration: v.duration ? `PT${Math.floor(v.duration / 3600)}H${Math.floor((v.duration % 3600) / 60)}M${v.duration % 60}S` : undefined,
                  viewCount: v.viewCount?.toString(),
                }));
              
              if (matchingResults.length > 0) {
                return {
                  results: matchingResults.slice(0, maxResults),
                  source: 'fallback',
                };
              }
            }
          }
        }
      } catch (error) {
        console.warn('[YouTubeService] Erreur fallback:', error);
      }
    }

    return {
      results: [],
      source: 'fallback',
      error: 'Aucun résultat trouvé',
    };
  }

  /**
   * Convertit un résultat de recherche en Video
   */
  searchResultToVideo(result: YouTubeSearchResult): Video {
    return {
      id: `youtube-${result.videoId}`,
      filePath: `https://www.youtube.com/watch?v=${result.videoId}`,
      title: result.title,
      description: result.description,
      duration: result.duration ? this.parseDuration(result.duration) : 0,
      thumbnailUrl: result.thumbnailUrl,
      posterUrl: result.thumbnailUrl,
      channelTitle: result.channelTitle,
      fileSize: 0,
      addedAt: new Date().toISOString(),
      mediaSource: 'youtube',
      youtubeVideoId: result.videoId,
      type: 'music_video',
    };
  }

  /**
   * Convertit un résultat de recherche en Track
   */
  searchResultToTrack(result: YouTubeSearchResult): Track {
    return youtubeVideoToTrack(result);
  }

  /**
   * Récupère plusieurs vidéos en batch
   */
  async getVideosBatch(videoIds: string[]): Promise<any[]> {
    return youtubeBatchService.getVideosBatch(videoIds);
  }

  /**
   * Vérifie si la lecture est possible (toujours true)
   */
  canPlay(videoId: string): boolean {
    return youtubeProvider.canPlay(videoId);
  }

  /**
   * Retourne l'état du système
   */
  getSystemStatus(): {
    quotaState: QuotaState;
    canUseAPI: boolean;
    canPlay: boolean;
    message: string | null;
  } {
    return youtubeProvider.getSystemStatus();
  }

  /**
   * Précharge les suggestions
   */
  async prefetchTrending(maxResults: number = 25): Promise<void> {
    return youtubePrefetchService.prefetchTrending(maxResults);
  }

  /**
   * Précharge depuis l'historique
   */
  async prefetchFromHistory(
    audioHistory: any[],
    audioTracks: Track[],
    youtubeVideos: Video[],
    searchHistory: string[] = []
  ): Promise<void> {
    return youtubePrefetchService.prefetchFromHistory(
      audioHistory,
      audioTracks,
      youtubeVideos,
      searchHistory
    );
  }

  /**
   * Parse la durée ISO 8601 en secondes
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Récupère la clé API YouTube
   */
  private getYouTubeApiKey(): string | null {
    if (typeof window === 'undefined') return null;
    
    const fromStorage = localStorage.getItem("nexus-youtube-api-key");
    if (fromStorage) return fromStorage;
    
    return process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || null;
  }
}

// Export singleton
export const youtubeService = new YouTubeService();

