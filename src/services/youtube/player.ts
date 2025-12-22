/**
 * Service de gestion du lecteur YouTube unifié
 * Gère l'état du lecteur et les interactions
 */

import { YouTubeVideo, YouTubePrefetchOptions, createYouTubeVideo } from './types';
import { youtubeCache } from './cache';
import { youtubeSearch } from './search';
import { getVideoViaOEmbed, createMinimalVideo } from './fallback';

class YouTubePlayerService {
  private currentVideo: YouTubeVideo | null = null;
  private queue: YouTubeVideo[] = [];
  private history: YouTubeVideo[] = [];
  private prefetchQueue: Set<string> = new Set();
  private isPrefetching = false;

  // ==================== VIDÉO COURANTE ====================

  getCurrentVideo(): YouTubeVideo | null {
    return this.currentVideo;
  }

  async setCurrentVideo(videoOrId: YouTubeVideo | string): Promise<YouTubeVideo | null> {
    let video: YouTubeVideo | null = null;

    if (typeof videoOrId === 'string') {
      // ID fourni, récupérer les détails
      video = await this.getVideoDetails(videoOrId);
    } else {
      video = videoOrId;
    }

    if (video) {
      // Ajouter à l'historique
      if (this.currentVideo) {
        this.addToHistory(this.currentVideo);
      }
      this.currentVideo = video;
      
      // Prefetch les vidéos similaires
      if (video.videoId) {
        this.prefetchRelated(video.videoId);
      }
    }

    return video;
  }

  // ==================== QUEUE ====================

  getQueue(): YouTubeVideo[] {
    return [...this.queue];
  }

  addToQueue(video: YouTubeVideo): void {
    // Éviter les doublons
    if (!this.queue.some(v => v.videoId === video.videoId)) {
      this.queue.push(video);
    }
  }

  addToQueueNext(video: YouTubeVideo): void {
    // Ajouter après la vidéo courante
    const filtered = this.queue.filter(v => v.videoId !== video.videoId);
    this.queue = [video, ...filtered];
  }

  removeFromQueue(videoId: string): void {
    this.queue = this.queue.filter(v => v.videoId !== videoId);
  }

  clearQueue(): void {
    this.queue = [];
  }

  getNextInQueue(): YouTubeVideo | null {
    return this.queue[0] || null;
  }

  playNext(): YouTubeVideo | null {
    if (this.queue.length === 0) return null;
    
    const next = this.queue.shift()!;
    this.setCurrentVideo(next);
    return next;
  }

  // ==================== HISTORIQUE ====================

  getHistory(): YouTubeVideo[] {
    return [...this.history];
  }

  private addToHistory(video: YouTubeVideo): void {
    // Éviter les doublons consécutifs
    if (this.history[0]?.videoId === video.videoId) return;

    this.history.unshift(video);
    // Limiter la taille de l'historique
    if (this.history.length > 50) {
      this.history = this.history.slice(0, 50);
    }
  }

  playPrevious(): YouTubeVideo | null {
    if (this.history.length === 0) return null;

    const previous = this.history.shift()!;
    
    // Remettre la vidéo courante en tête de queue
    if (this.currentVideo) {
      this.queue.unshift(this.currentVideo);
    }
    
    this.currentVideo = previous;
    return previous;
  }

  // ==================== PREFETCH ====================

  /**
   * Prefetch une vidéo pour un chargement plus rapide
   */
  async prefetch(videoId: string, options: YouTubePrefetchOptions = {}): Promise<void> {
    if (this.prefetchQueue.has(videoId)) return;

    this.prefetchQueue.add(videoId);

    try {
      // Vérifier si déjà en cache
      const cached = youtubeCache.getVideo(videoId);
      if (!cached) {
        await this.getVideoDetails(videoId);
      }

      // Prefetch les vidéos liées si demandé
      if (options.includeRelated) {
        this.prefetchRelated(videoId);
      }
    } catch (error) {
      console.warn('[YouTubePlayer] Prefetch error:', error);
    } finally {
      this.prefetchQueue.delete(videoId);
    }
  }

  /**
   * Prefetch les vidéos liées à une vidéo
   */
  async prefetchRelated(videoId: string): Promise<void> {
    if (this.isPrefetching) return;
    this.isPrefetching = true;

    try {
      // Vérifier le cache de suggestions
      const cached = youtubeCache.getSuggestions(videoId);
      if (cached && cached.length > 0) {
        // Prefetch les 3 premières
        await Promise.all(
          cached.slice(0, 3).map(v => v.videoId && this.prefetch(v.videoId))
        );
      }
    } catch (error) {
      console.warn('[YouTubePlayer] PrefetchRelated error:', error);
    } finally {
      this.isPrefetching = false;
    }
  }

  /**
   * Prefetch au survol (hover)
   */
  onHover(videoId: string): void {
    // Prefetch avec délai pour éviter les requêtes inutiles
    setTimeout(() => {
      if (this.prefetchQueue.size < 5) { // Limiter les prefetch simultanés
        this.prefetch(videoId, { priority: 'low' });
      }
    }, 200);
  }

  // ==================== UTILITAIRES ====================

  private async getVideoDetails(videoId: string): Promise<YouTubeVideo | null> {
    // 1. Cache
    const cached = youtubeCache.getVideo(videoId);
    if (cached) return cached;

    // 2. Via le service de recherche
    try {
      const video = await youtubeSearch.getVideo(videoId);
      if (video) return video;
    } catch (error) {
      console.warn('[YouTubePlayer] getVideoDetails error:', error);
    }

    // 3. Fallback oEmbed
    try {
      const video = await getVideoViaOEmbed(videoId);
      if (video) {
        youtubeCache.setVideo(video);
        return video;
      }
    } catch {}

    // 4. Fallback minimal
    return createMinimalVideo(videoId);
  }

  /**
   * Génère l'URL embed pour le lecteur
   */
  getEmbedUrl(videoId: string, options: {
    autoplay?: boolean;
    start?: number;
    controls?: boolean;
  } = {}): string {
    const params = new URLSearchParams({
      enablejsapi: '1',
      origin: window.location.origin,
      rel: '0',
      modestbranding: '1',
    });

    if (options.autoplay) params.set('autoplay', '1');
    if (options.start) params.set('start', options.start.toString());
    if (options.controls === false) params.set('controls', '0');

    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  }

  /**
   * Génère l'URL de watch
   */
  getWatchUrl(videoId: string): string {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  /**
   * Reset l'état du player
   */
  reset(): void {
    this.currentVideo = null;
    this.queue = [];
    this.history = [];
    this.prefetchQueue.clear();
    this.isPrefetching = false;
  }
}

// Singleton
export const youtubePlayer = new YouTubePlayerService();
export { YouTubePlayerService };
