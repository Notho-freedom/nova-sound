/**
 * Service de recherche YouTube unifié
 * Point d'entrée unique pour toutes les recherches
 */

import { YouTubeVideo, YouTubeSearchResult, YouTubeSearchOptions, createYouTubeVideo } from './types';
import { youtubeCache } from './cache';
import { youtubeQuota } from './quota';
import { 
  getVideoViaOEmbed, 
  searchViaInvidious, 
  createMinimalVideo,
  generateSmartSuggestions,
} from './fallback';

// API YouTube (si disponible côté serveur)
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

class YouTubeSearchService {
  private apiKey: string | null = null;

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  // ==================== RECHERCHE PRINCIPALE ====================

  /**
   * Recherche des vidéos avec fallback automatique
   */
  async search(query: string, options: YouTubeSearchOptions = {}): Promise<YouTubeSearchResult> {
    const { maxResults = 20, forceRefresh = false, useFallback = true } = options;

    if (!query.trim()) {
      return { videos: [], source: 'cache', fromCache: true };
    }

    // 1. Vérifier le cache (sauf si forceRefresh)
    if (!forceRefresh) {
      const cached = youtubeCache.getSearch(query);
      if (cached && cached.length > 0) {
        console.log('[YouTubeSearch] Résultats depuis cache');
        return { videos: cached, source: 'cache', fromCache: true };
      }
    }

    // 2. Essayer l'API YouTube si quota disponible
    if (youtubeQuota.canMakeRequest('search') && this.apiKey) {
      try {
        const videos = await this.searchViaAPI(query, maxResults);
        if (videos.length > 0) {
          youtubeQuota.recordSuccess();
          youtubeCache.setSearch(query, videos);
          videos.forEach(v => youtubeCache.setVideo(v));
          return { videos, source: 'api', fromCache: false };
        }
      } catch (error) {
        console.warn('[YouTubeSearch] API error:', error);
        youtubeQuota.recordFailure();
      }
    }

    // 3. Fallback vers Invidious
    if (useFallback) {
      console.log('[YouTubeSearch] Utilisation fallback Invidious');
      try {
        const videos = await searchViaInvidious(query);
        if (videos.length > 0) {
          youtubeCache.setSearch(query, videos);
          videos.forEach(v => youtubeCache.setVideo(v));
          return { videos, source: 'invidious', fromCache: false };
        }
      } catch (error) {
        console.warn('[YouTubeSearch] Invidious fallback failed:', error);
      }
    }

    // 4. Retourner cache même expiré si disponible
    const staleCache = youtubeCache.getSearch(query);
    if (staleCache) {
      return { videos: staleCache, source: 'cache', fromCache: true };
    }

    return { videos: [], source: 'fallback', fromCache: false };
  }

  /**
   * Recherche via API YouTube officielle
   */
  private async searchViaAPI(query: string, maxResults: number): Promise<YouTubeVideo[]> {
    if (!this.apiKey) {
      throw new Error('API key non configurée');
    }

    youtubeQuota.consumeQuota('search');

    const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`);
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('maxResults', maxResults.toString());
    searchUrl.searchParams.set('key', this.apiKey);

    const response = await fetch(searchUrl.toString());
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const videoIds = data.items?.map((item: any) => item.id.videoId).filter(Boolean) || [];

    if (videoIds.length === 0) {
      return [];
    }

    // Récupérer les détails complets
    return this.getVideoDetails(videoIds);
  }

  // ==================== DÉTAILS VIDÉO ====================

  /**
   * Récupère les détails d'une vidéo par ID
   */
  async getVideo(videoId: string, options: { forceRefresh?: boolean } = {}): Promise<YouTubeVideo | null> {
    const { forceRefresh = false } = options;

    // 1. Cache
    if (!forceRefresh) {
      const cached = youtubeCache.getVideo(videoId);
      if (cached) return cached;
    }

    // 2. API
    if (youtubeQuota.canMakeRequest('videoDetails') && this.apiKey) {
      try {
        const videos = await this.getVideoDetails([videoId]);
        if (videos.length > 0) {
          youtubeQuota.recordSuccess();
          return videos[0];
        }
      } catch (error) {
        console.warn('[YouTubeSearch] getVideo API error:', error);
        youtubeQuota.recordFailure();
      }
    }

    // 3. Fallback oEmbed
    console.log('[YouTubeSearch] Fallback oEmbed pour', videoId);
    const video = await getVideoViaOEmbed(videoId);
    if (video) {
      youtubeCache.setVideo(video);
      return video;
    }

    // 4. Fallback minimal
    return createMinimalVideo(videoId);
  }

  /**
   * Récupère les détails de plusieurs vidéos
   */
  async getVideoDetails(videoIds: string[]): Promise<YouTubeVideo[]> {
    if (!this.apiKey || videoIds.length === 0) {
      return [];
    }

    // Vérifier le cache d'abord
    const cachedVideos: YouTubeVideo[] = [];
    const uncachedIds: string[] = [];

    for (const id of videoIds) {
      const cached = youtubeCache.getVideo(id);
      if (cached) {
        cachedVideos.push(cached);
      } else {
        uncachedIds.push(id);
      }
    }

    if (uncachedIds.length === 0) {
      return cachedVideos;
    }

    // Fetch les non-cachés
    youtubeQuota.consumeQuota('videoDetails');

    const detailsUrl = new URL(`${YOUTUBE_API_BASE}/videos`);
    detailsUrl.searchParams.set('part', 'snippet,contentDetails,statistics');
    detailsUrl.searchParams.set('id', uncachedIds.join(','));
    detailsUrl.searchParams.set('key', this.apiKey);

    const response = await fetch(detailsUrl.toString());
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const newVideos: YouTubeVideo[] = data.items?.map((item: any) => this.parseVideoItem(item)) || [];

    // Mettre en cache
    newVideos.forEach(v => youtubeCache.setVideo(v));

    // Retourner dans l'ordre original
    const allVideos = [...cachedVideos, ...newVideos];
    return videoIds
      .map(id => allVideos.find(v => v.videoId === id))
      .filter((v): v is YouTubeVideo => v !== undefined);
  }

  private parseVideoItem(item: any): YouTubeVideo {
    const snippet = item.snippet || {};
    const contentDetails = item.contentDetails || {};

    return createYouTubeVideo(item.id, {
      title: snippet.title || 'Vidéo',
      artist: snippet.channelTitle || 'Artiste inconnu',
      channelTitle: snippet.channelTitle || 'YouTube',
      channelId: snippet.channelId,
      thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || '',
      thumbnailHighUrl: snippet.thumbnails?.maxres?.url || snippet.thumbnails?.high?.url || '',
      duration: this.parseDuration(contentDetails.duration),
      description: snippet.description,
      publishedAt: snippet.publishedAt,
      viewCount: parseInt(item.statistics?.viewCount || '0', 10),
    });
  }

  private parseDuration(duration: string | undefined): number {
    if (!duration) return 0;
    
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    return hours * 3600 + minutes * 60 + seconds;
  }

  // ==================== AUTOCOMPLETE ====================

  /**
   * Récupère les suggestions d'autocomplétion
   */
  async getAutocomplete(query: string): Promise<string[]> {
    if (!query.trim() || query.length < 2) {
      return [];
    }

    // 1. Cache
    const cached = youtubeCache.getAutocomplete(query);
    if (cached) return cached;

    // 2. API Google Suggest (sans quota)
    try {
      const suggestions = await this.fetchGoogleSuggest(query);
      if (suggestions.length > 0) {
        youtubeCache.setAutocomplete(query, suggestions);
        return suggestions;
      }
    } catch (error) {
      console.warn('[YouTubeSearch] Autocomplete error:', error);
    }

    // 3. Suggestions générées
    return generateSmartSuggestions(query);
  }

  private async fetchGoogleSuggest(query: string): Promise<string[]> {
    // Utiliser le proxy CORS ou l'API native si disponible
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query)}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) return [];
      
      const data = await response.json();
      // Format: [query, [suggestions]]
      return Array.isArray(data[1]) ? data[1].slice(0, 8) : [];
    } catch {
      // Fallback: utiliser un proxy ou les suggestions générées
      return [];
    }
  }

  // ==================== UTILITAIRES ====================

  /**
   * Extrait l'ID vidéo d'une URL YouTube
   */
  extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/, // ID direct
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  /**
   * Vérifie si une chaîne est un ID vidéo valide
   */
  isValidVideoId(id: string): boolean {
    return /^[a-zA-Z0-9_-]{11}$/.test(id);
  }
}

// Singleton
export const youtubeSearch = new YouTubeSearchService();
export { YouTubeSearchService };
