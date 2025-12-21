/**
 * Service oEmbed YouTube - Métadonnées SANS QUOTA
 * Fallback intelligent quand quota API épuisé
 * 
 * oEmbed endpoint: https://www.youtube.com/oembed?url=VIDEO_URL&format=json
 */

export interface YouTubeOEmbedResponse {
  title: string;
  author_name: string;
  author_url: string;
  type: string;
  height: number;
  width: number;
  version: string;
  provider_name: string;
  provider_url: string;
  thumbnail_url: string;
  thumbnail_width: number;
  thumbnail_height: number;
  html?: string;
}

export interface YouTubeOEmbedMetadata {
  title: string;
  channelTitle: string;
  channelUrl: string;
  thumbnailUrl: string;
  thumbnailWidth: number;
  thumbnailHeight: number;
  // Données limitées (oEmbed ne fournit pas tout)
  duration?: number;
  viewCount?: number;
}

class YouTubeOEmbedService {
  private readonly OEMBED_ENDPOINT = 'https://www.youtube.com/oembed';
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
  private cache = new Map<string, { data: YouTubeOEmbedMetadata; timestamp: number }>();

  /**
   * Construit l'URL YouTube à partir d'un videoId
   */
  private buildYouTubeUrl(videoId: string): string {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  /**
   * Nettoie le cache expiré
   */
  private cleanCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Récupère les métadonnées via oEmbed (NO QUOTA)
   */
  async getMetadata(videoId: string): Promise<YouTubeOEmbedMetadata | null> {
    // Vérifier le cache d'abord
    this.cleanCache();
    const cached = this.cache.get(videoId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log(`[oEmbed] Cache HIT pour: ${videoId}`);
      return cached.data;
    }

    try {
      const videoUrl = this.buildYouTubeUrl(videoId);
      const oembedUrl = `${this.OEMBED_ENDPOINT}?url=${encodeURIComponent(videoUrl)}&format=json`;

      const response = await fetch(oembedUrl);
      
      if (!response.ok) {
        console.warn(`[oEmbed] Erreur HTTP ${response.status} pour ${videoId}`);
        return null;
      }

      const data: YouTubeOEmbedResponse = await response.json();

      const metadata: YouTubeOEmbedMetadata = {
        title: data.title,
        channelTitle: data.author_name,
        channelUrl: data.author_url,
        thumbnailUrl: data.thumbnail_url,
        thumbnailWidth: data.thumbnail_width,
        thumbnailHeight: data.thumbnail_height,
        // oEmbed ne fournit pas duration/viewCount
        duration: undefined,
        viewCount: undefined,
      };

      // Mettre en cache
      this.cache.set(videoId, {
        data: metadata,
        timestamp: Date.now(),
      });

      console.log(`[oEmbed] ✅ Métadonnées récupérées (NO QUOTA) pour: ${videoId}`);
      return metadata;
    } catch (error) {
      console.error(`[oEmbed] Erreur pour ${videoId}:`, error);
      return null;
    }
  }

  /**
   * Nettoie tout le cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton
export const youtubeOEmbedService = new YouTubeOEmbedService();
