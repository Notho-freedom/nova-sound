/**
 * YouTube Provider Nexus - Routing intelligent QUOTA/NO-QUOTA
 * 
 * Architecture hybride :
 * 1. Cache local/DB (no quota) - PRIORITÉ 1
 * 2. oEmbed YouTube (no quota) - PRIORITÉ 2
 * 3. YouTube Data API (quota) - PRIORITÉ 3 (si disponible)
 * 4. Fallback embed only (no quota) - PRIORITÉ 4
 * 
 * Principe : La LECTURE fonctionne TOUJOURS, même sans quota
 */

import { youtubeQuotaManager, QuotaState } from './youtube-quota-manager';
import { youtubeCacheService } from './youtube-cache';
import { youtubeOEmbedService } from './youtube-oembed';

export interface YouTubeMetadataResult {
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
}

/**
 * Déduplication des appels en cours
 */
class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<YouTubeMetadataResult>>();

  async deduplicate<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    // Si une requête est déjà en cours, attendre son résultat
    const existing = this.pendingRequests.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    // Créer la nouvelle requête
    const promise = requestFn().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise as Promise<YouTubeMetadataResult>);
    return promise;
  }

  clear(): void {
    this.pendingRequests.clear();
  }
}

const requestDeduplicator = new RequestDeduplicator();

/**
 * YouTube Provider - Routing intelligent
 */
class YouTubeProvider {
  /**
   * Récupère les métadonnées d'une vidéo avec routing intelligent
   * 
   * Pipeline :
   * 1. Cache (L1/L2) - NO QUOTA
   * 2. oEmbed - NO QUOTA
   * 3. YouTube Data API - QUOTA (si disponible)
   * 4. Fallback minimal - NO QUOTA
   */
  async getVideoMetadata(videoId: string): Promise<YouTubeMetadataResult> {
    // Déduplication : même vidéo = 1 seul appel
    return requestDeduplicator.deduplicate(videoId, async () => {
      // 1. PRIORITÉ 1 : Cache (L1 mémoire + L2 Firestore) - NO QUOTA
      try {
        const cached = await youtubeCacheService.getVideo(videoId);
        if (cached) {
          console.log(`[YouTubeProvider] ✅ Cache HIT (NO QUOTA): ${videoId}`);
          return {
            success: true,
            metadata: {
              id: cached.videoId,
              title: cached.title,
              description: cached.description,
              channelTitle: cached.channelTitle,
              channelId: cached.channelId,
              publishedAt: cached.publishedAt,
              duration: cached.duration,
              viewCount: cached.viewCount,
              likeCount: cached.likeCount,
              thumbnailUrl: cached.thumbnailUrl,
              thumbnailHighUrl: cached.thumbnailHighUrl,
              tags: cached.tags,
              categoryId: cached.categoryId,
            },
            source: 'cache',
          };
        }
      } catch (error) {
        console.warn('[YouTubeProvider] Erreur cache:', error);
      }

      // 2. PRIORITÉ 2 : oEmbed - NO QUOTA
      try {
        const oembedData = await youtubeOEmbedService.getMetadata(videoId);
        if (oembedData) {
          console.log(`[YouTubeProvider] ✅ oEmbed (NO QUOTA): ${videoId}`);
          
          // Convertir en format standardisé
          return {
            success: true,
            metadata: {
              id: videoId,
              title: oembedData.title,
              channelTitle: oembedData.channelTitle,
              channelId: undefined, // oEmbed ne fournit pas channelId
              thumbnailUrl: oembedData.thumbnailUrl,
              thumbnailHighUrl: oembedData.thumbnailUrl,
              duration: oembedData.duration,
              viewCount: oembedData.viewCount,
            },
            source: 'oembed',
          };
        }
      } catch (error) {
        console.warn('[YouTubeProvider] Erreur oEmbed:', error);
      }

      // 3. PRIORITÉ 3 : YouTube Data API - QUOTA (si disponible)
      const quotaState = youtubeQuotaManager.getState();
      if (quotaState !== QuotaState.EXHAUSTED && youtubeQuotaManager.canGetMetadata(1)) {
        try {
          // Appel API direct (éviter dépendance circulaire)
          const apiKey = this.getYouTubeApiKey();
          if (apiKey) {
            const url = new URL("https://www.googleapis.com/youtube/v3/videos");
            url.searchParams.set("id", videoId);
            url.searchParams.set("key", apiKey);
            url.searchParams.set("part", "snippet,contentDetails,statistics");
            url.searchParams.set("fields", "items(id,snippet(title,description,channelTitle,channelId,publishedAt,thumbnails,tags,categoryId),contentDetails(duration),statistics(viewCount,likeCount))");

            const response = await fetch(url.toString());
            
            if (response.ok) {
              const data = await response.json();
              if (data.items && data.items.length > 0) {
                const item = data.items[0];
                const snippet = item.snippet || {};
                const contentDetails = item.contentDetails || {};
                const statistics = item.statistics || {};

                // Parser durée ISO 8601
                const durationMatch = contentDetails.duration?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
                let duration = 0;
                if (durationMatch) {
                  const hours = parseInt(durationMatch[1] || "0", 10);
                  const minutes = parseInt(durationMatch[2] || "0", 10);
                  const seconds = parseInt(durationMatch[3] || "0", 10);
                  duration = hours * 3600 + minutes * 60 + seconds;
                }

                const thumbnails = snippet.thumbnails || {};
                const thumbnailUrl = thumbnails.default?.url || thumbnails.medium?.url || "";
                const thumbnailHighUrl = thumbnails.high?.url || thumbnails.medium?.url || thumbnailUrl;

                const metadata = {
                  id: item.id,
                  title: snippet.title || "",
                  description: snippet.description || "",
                  channelTitle: snippet.channelTitle || "",
                  channelId: snippet.channelId || "",
                  publishedAt: snippet.publishedAt || "",
                  duration,
                  viewCount: parseInt(statistics.viewCount || "0", 10),
                  likeCount: statistics.likeCount ? parseInt(statistics.likeCount, 10) : undefined,
                  thumbnailUrl,
                  thumbnailHighUrl,
                  tags: snippet.tags || [],
                  categoryId: snippet.categoryId,
                };

                // Mettre en cache
                await youtubeCacheService.setVideo({
                  id: metadata.id,
                  videoId: metadata.id,
                  title: metadata.title,
                  description: metadata.description,
                  channelTitle: metadata.channelTitle,
                  channelId: metadata.channelId,
                  publishedAt: metadata.publishedAt,
                  duration: metadata.duration,
                  viewCount: metadata.viewCount,
                  likeCount: metadata.likeCount,
                  thumbnailUrl: metadata.thumbnailUrl,
                  thumbnailHighUrl: metadata.thumbnailHighUrl,
                  tags: metadata.tags,
                  categoryId: metadata.categoryId,
                });

                // Consommer quota
                youtubeQuotaManager.consumeMetadata(1);
                youtubeQuotaManager.recordSuccess();

                console.log(`[YouTubeProvider] ✅ API (QUOTA): ${videoId}`);
                return {
                  success: true,
                  metadata,
                  source: 'api',
                };
              }
            }
          }
          // Erreur API
          youtubeQuotaManager.recordFailure();
        } catch (error) {
          console.warn('[YouTubeProvider] Erreur API:', error);
          youtubeQuotaManager.recordFailure();
        }
      } else {
        console.log(`[YouTubeProvider] ⚠️ Quota épuisé, skip API pour: ${videoId}`);
      }

      // 4. PRIORITÉ 4 : Fallback minimal - NO QUOTA
      // Retourner des métadonnées minimales pour permettre la lecture
      console.log(`[YouTubeProvider] 🔄 Fallback minimal (NO QUOTA): ${videoId}`);
      return {
        success: true,
        metadata: {
          id: videoId,
          title: `Vidéo YouTube ${videoId}`,
          channelTitle: 'YouTube', // Fallback obligatoire pour éviter undefined
          thumbnailUrl: `https://img.youtube.com/vi/${videoId}/default.jpg`,
          thumbnailHighUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        },
        source: 'fallback',
      };
    });
  }

  /**
   * Vérifie si la lecture est possible (toujours true, même sans quota)
   */
  canPlay(videoId: string): boolean {
    // La lecture YouTube via IFrame API fonctionne TOUJOURS
    // Elle ne consomme PAS de quota
    return true;
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
    const quotaState = youtubeQuotaManager.getState();
    const canUseAPI = youtubeQuotaManager.canUseAPI();
    
    return {
      quotaState,
      canUseAPI,
      canPlay: true, // Toujours true
      message: youtubeQuotaManager.getUXMessage(),
    };
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
export const youtubeProvider = new YouTubeProvider();
