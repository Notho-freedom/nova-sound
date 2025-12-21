/**
 * Service de batch pour YouTube API
 * Combine plusieurs appels en un seul pour économiser le quota
 * 
 * Exemple: 10 vidéos = 1 call au lieu de 10
 */

import { youtubeQuotaManager } from './youtube-quota-manager';
import { youtubeCacheService } from './youtube-cache';

interface BatchRequest {
  videoIds: string[];
  resolve: (videos: any[]) => void;
  reject: (error: Error) => void;
}

class YouTubeBatchService {
  private batchQueue: BatchRequest[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 100; // ms
  private readonly MAX_BATCH_SIZE = 50; // Max 50 IDs par call API

  /**
   * Récupère les métadonnées de plusieurs vidéos en batch
   * Utilise le YouTubeProvider pour routing intelligent
   */
  async getVideosBatch(videoIds: string[]): Promise<any[]> {
    // Déduplication : supprimer les doublons
    const uniqueIds = Array.from(new Set(videoIds));
    
    // Vérifier le cache d'abord (NO QUOTA)
    const cachedVideos: any[] = [];
    const uncachedIds: string[] = [];
    
    for (const videoId of uniqueIds) {
      const cached = await youtubeCacheService.getVideo(videoId);
      if (cached) {
        cachedVideos.push(cached);
      } else {
        uncachedIds.push(videoId);
      }
    }
    
    // Si tout est en cache, retourner
    if (uncachedIds.length === 0) {
      return cachedVideos;
    }
    
    // Pour les vidéos non cachées, utiliser le provider (routing intelligent)
    // Le provider gère automatiquement oEmbed/API selon quota
    const { youtubeProvider } = await import('./youtube-provider');
    const providerResults = await Promise.allSettled(
      uncachedIds.map(id => youtubeProvider.getVideoMetadata(id))
    );
    
    const providerVideos: any[] = [];
    for (let i = 0; i < providerResults.length; i++) {
      const result = providerResults[i];
      if (result.status === 'fulfilled' && result.value.success && result.value.metadata) {
        const metadata = result.value.metadata;
        providerVideos.push({
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
      }
    }
    
    // Si quota disponible et certaines vidéos manquent encore, essayer batch API
    if (providerVideos.length < uncachedIds.length && youtubeQuotaManager.canBatch(uncachedIds.length)) {
      try {
        const apiVideos = await this.fetchVideosFromAPI(uncachedIds);
        // Mettre en cache et ajouter
        for (const video of apiVideos) {
          await youtubeCacheService.setVideo({
            id: video.id,
            videoId: video.id,
            title: video.snippet?.title || '',
            description: video.snippet?.description,
            channelTitle: video.snippet?.channelTitle || '',
            channelId: video.snippet?.channelId || '',
            publishedAt: video.snippet?.publishedAt || '',
            duration: this.parseDuration(video.contentDetails?.duration),
            viewCount: parseInt(video.statistics?.viewCount || '0'),
            likeCount: parseInt(video.statistics?.likeCount || '0'),
            thumbnailUrl: video.snippet?.thumbnails?.default?.url || '',
            thumbnailHighUrl: video.snippet?.thumbnails?.high?.url || '',
            tags: video.snippet?.tags,
            categoryId: video.snippet?.categoryId,
          });
        }
        
        youtubeQuotaManager.consumeBatch(uncachedIds.length);
        youtubeQuotaManager.recordSuccess();
        
        // Convertir en format standardisé
        const apiFormatted = apiVideos.map(video => ({
          id: video.id,
          videoId: video.id,
          title: video.snippet?.title || '',
          description: video.snippet?.description,
          channelTitle: video.snippet?.channelTitle || '',
          channelId: video.snippet?.channelId || '',
          publishedAt: video.snippet?.publishedAt || '',
          duration: this.parseDuration(video.contentDetails?.duration),
          viewCount: parseInt(video.statistics?.viewCount || '0'),
          likeCount: parseInt(video.statistics?.likeCount || '0'),
          thumbnailUrl: video.snippet?.thumbnails?.default?.url || '',
          thumbnailHighUrl: video.snippet?.thumbnails?.high?.url || '',
          tags: video.snippet?.tags,
          categoryId: video.snippet?.categoryId,
        }));
        
        return [...cachedVideos, ...providerVideos, ...apiFormatted];
      } catch (error) {
        console.warn('[YouTubeBatch] Erreur batch API, utiliser provider results:', error);
        youtubeQuotaManager.recordFailure();
      }
    }
    
    // Retourner cache + résultats provider
    return [...cachedVideos, ...providerVideos];
    
    // Faire l'appel API batch
    const apiVideos = await this.fetchVideosFromAPI(uncachedIds);
    
    // Mettre en cache
    for (const video of apiVideos) {
      await youtubeCacheService.setVideo({
        id: video.id,
        videoId: video.id,
        title: video.snippet?.title || '',
        description: video.snippet?.description,
        channelTitle: video.snippet?.channelTitle || '',
        channelId: video.snippet?.channelId || '',
        publishedAt: video.snippet?.publishedAt || '',
        duration: this.parseDuration(video.contentDetails?.duration),
        viewCount: parseInt(video.statistics?.viewCount || '0'),
        likeCount: parseInt(video.statistics?.likeCount || '0'),
        thumbnailUrl: video.snippet?.thumbnails?.default?.url || '',
        thumbnailHighUrl: video.snippet?.thumbnails?.high?.url || '',
        tags: video.snippet?.tags,
        categoryId: video.snippet?.categoryId,
      });
    }
    
    // Consommer le quota
    youtubeQuotaManager.consumeBatch(uncachedIds.length);
    
    return [...cachedVideos, ...apiVideos];
  }

  /**
   * Appel API YouTube pour récupérer plusieurs vidéos
   */
  private async fetchVideosFromAPI(videoIds: string[]): Promise<any[]> {
    const apiKey = this.getYouTubeApiKey();
    if (!apiKey) {
      throw new Error('YouTube API key not found');
    }
    
    // Diviser en chunks de 50 (limite API)
    const chunks: string[][] = [];
    for (let i = 0; i < videoIds.length; i += this.MAX_BATCH_SIZE) {
      chunks.push(videoIds.slice(i, i + this.MAX_BATCH_SIZE));
    }
    
    const allVideos: any[] = [];
    
    for (const chunk of chunks) {
      const ids = chunk.join(',');
      const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${ids}&key=${apiKey}`;
      
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`YouTube API error: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.items) {
          allVideos.push(...data.items);
        }
      } catch (error) {
        console.error('[YouTubeBatch] Erreur fetch batch:', error);
        throw error;
      }
    }
    
    return allVideos;
  }

  /**
   * Parse la durée ISO 8601 en secondes
   */
  private parseDuration(duration?: string): number | undefined {
    if (!duration) return undefined;
    
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return undefined;
    
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    
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
export const youtubeBatchService = new YouTubeBatchService();
