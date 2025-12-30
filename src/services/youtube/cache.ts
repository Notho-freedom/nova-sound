/**
 * Cache unifié pour le système YouTube
 * 
 * Three-layer architecture:
 * - L1: Memory (10 min TTL) - Fastest, process memory
 * - L2: localStorage (7 days TTL) - Persistent, browser-local
 * - L3: Redis (7-30 days TTL) - Shared, distributed, all users
 * 
 * Gère le cache mémoire, localStorage et Redis avec TTL
 */

import type { YouTubeVideo, YouTubePlaylist } from './types';
import { redisCache } from '@/services/redis-cache';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheConfig {
  memoryTTL: number;      // TTL mémoire en ms
  storageTTL: number;     // TTL localStorage en ms
  maxMemoryItems: number; // Limite d'items en mémoire
  maxStorageItems: number; // Limite d'items en storage
}

const DEFAULT_CONFIG: CacheConfig = {
  memoryTTL: 10 * 60 * 1000,       // 10 minutes (augmenté)
  storageTTL: 7 * 24 * 60 * 60 * 1000, // 7 jours (augmenté)
  maxMemoryItems: 200,             // Augmenté
  maxStorageItems: 1000,           // Augmenté
};

class YouTubeCache {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private config: CacheConfig;
  private readonly STORAGE_PREFIX = 'yt_cache_';

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cleanupExpired();
  }

  // ==================== RECHERCHE ====================

  getSearch(query: string): YouTubeVideo[] | null {
    const key = this.getSearchKey(query);
    return this.get<YouTubeVideo[]>(key);
  }

  setSearch(query: string, results: YouTubeVideo[]): void {
    const key = this.getSearchKey(query);
    this.set(key, results);
  }

  private getSearchKey(query: string): string {
    return `search:${query.toLowerCase().trim()}`;
  }

  // ==================== VIDÉO UNIQUE ====================

  getVideo(videoId: string): YouTubeVideo | null {
    const key = this.getVideoKey(videoId);
    return this.get<YouTubeVideo>(key);
  }

  setVideo(video: YouTubeVideo): void {
    if (!video.videoId) return;
    const key = this.getVideoKey(video.videoId);
    this.set(key, video);
  }

  private getVideoKey(videoId: string): string {
    return `video:${videoId}`;
  }

  // ==================== SUGGESTIONS ====================

  getSuggestions(videoId: string): YouTubeVideo[] | null {
    const key = this.getSuggestionsKey(videoId);
    return this.get<YouTubeVideo[]>(key);
  }

  setSuggestions(videoId: string, suggestions: YouTubeVideo[]): void {
    const key = this.getSuggestionsKey(videoId);
    this.set(key, suggestions);
  }

  private getSuggestionsKey(videoId: string): string {
    return `suggestions:${videoId}`;
  }

  // ==================== AUTOCOMPLETE ====================

  getAutocomplete(query: string): string[] | null {
    const key = this.getAutocompleteKey(query);
    return this.get<string[]>(key);
  }

  setAutocomplete(query: string, suggestions: string[]): void {
    const key = this.getAutocompleteKey(query);
    this.set(key, suggestions, { memoryOnly: true }); // Autocomplete en mémoire seulement
  }

  private getAutocompleteKey(query: string): string {
    return `autocomplete:${query.toLowerCase().trim()}`;
  }

  // ==================== POPULAR SUGGESTIONS ====================

  getPopularSuggestions(): string[] | null {
    return this.get<string[]>('popular_suggestions');
  }

  setPopularSuggestions(suggestions: string[]): void {
    this.set('popular_suggestions', suggestions, { storageTTL: 7 * 24 * 60 * 60 * 1000 }); // 7 jours
  }

  // ==================== PLAYLISTS ====================

  getArtistPlaylists(artistName: string): YouTubePlaylist[] | null {
    const key = this.getArtistPlaylistsKey(artistName);
    return this.get<YouTubePlaylist[]>(key);
  }

  setArtistPlaylists(artistName: string, playlists: YouTubePlaylist[]): void {
    const key = this.getArtistPlaylistsKey(artistName);
    this.set(key, playlists, { storageTTL: 24 * 60 * 60 * 1000 }); // 24 heures
  }

  private getArtistPlaylistsKey(artistName: string): string {
    return `artist_playlists:${artistName.toLowerCase().trim()}`;
  }

  getPlaylist(playlistId: string): YouTubePlaylist | null {
    const key = this.getPlaylistKey(playlistId);
    return this.get<YouTubePlaylist>(key);
  }

  setPlaylist(playlist: YouTubePlaylist): void {
    if (!playlist.id) return;
    const key = this.getPlaylistKey(playlist.id);
    this.set(key, playlist, { storageTTL: 24 * 60 * 60 * 1000 }); // 24 heures
  }

  private getPlaylistKey(playlistId: string): string {
    return `playlist:${playlistId}`;
  }

  getPlaylistVideos(playlistId: string): YouTubeVideo[] | null {
    const key = `playlist_videos:${playlistId}`;
    return this.get<YouTubeVideo[]>(key);
  }

  setPlaylistVideos(playlistId: string, videos: YouTubeVideo[]): void {
    const key = `playlist_videos:${playlistId}`;
    this.set(key, videos, { storageTTL: 6 * 60 * 60 * 1000 }); // 6 heures
  }

  // ==================== MÉTHODES GÉNÉRIQUES ====================

  /**
   * Two-layer cache lookup (L1 & L2, synchronous):
   * L1: Memory (<1ms)
   * L2: localStorage (5-10ms)
   */
  private get<T>(key: string): T | null {
    // 1. Vérifier le cache mémoire (L1)
    const memEntry = this.memoryCache.get(key);
    if (memEntry && Date.now() < memEntry.expiresAt) {
      return memEntry.data as T;
    }

    // 2. Vérifier localStorage (L2, uniquement côté client)
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = localStorage.getItem(this.STORAGE_PREFIX + key);
        if (stored) {
          const entry: CacheEntry<T> = JSON.parse(stored);
          if (Date.now() < entry.expiresAt) {
            // Remettre en cache mémoire
            this.memoryCache.set(key, entry);
            return entry.data;
          } else {
            // Nettoyer l'entrée expirée
            localStorage.removeItem(this.STORAGE_PREFIX + key);
          }
        }
      } catch (e) {
        console.warn('[YouTubeCache] Erreur lecture localStorage:', e);
      }
    }

    return null;
  }

  /**
   * Three-layer cache lookup with async Redis fallback (L1 & L2 & L3)
   * Used by components that can handle async operations
   * L1: Memory (<1ms)
   * L2: localStorage (5-10ms)
   * L3: Redis (network latency, but shared across users)
   */
  async getAsync<T>(key: string): Promise<T | null> {
    // First try sync L1 & L2
    const data = this.get<T>(key);
    if (data !== null) return data;

    // Fall back to Redis L3
    try {
      const redisData = await this._getFromRedis<T>(key);
      if (redisData) {
        // Promote to L1 & L2
        const entry: CacheEntry<T> = {
          data: redisData,
          timestamp: Date.now(),
          expiresAt: Date.now() + this.config.memoryTTL,
        };
        this.memoryCache.set(key, entry);
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            localStorage.setItem(this.STORAGE_PREFIX + key, JSON.stringify(entry));
          } catch (e) {
            console.warn('[YouTubeCache] Failed to promote Redis hit to localStorage:', e);
          }
        }
        return redisData;
      }
    } catch (e) {
      console.warn('[YouTubeCache] Erreur lecture Redis:', e);
    }

    return null;
  }

  /**
   * Helper to get data from Redis based on key type
   */
  private async _getFromRedis<T>(key: string): Promise<T | null> {
    try {
      if (key.startsWith('video:')) {
        const videoId = key.replace('video:', '');
        return (await redisCache.getVideo(videoId)) as T;
      } else if (key.startsWith('search:')) {
        const query = key.replace('search:', '');
        return (await redisCache.getSearch(query)) as T;
      } else if (key.startsWith('playlist:')) {
        const playlistId = key.replace('playlist:', '');
        return (await redisCache.getPlaylist(playlistId)) as T;
      } else if (key.startsWith('playlist_videos:')) {
        const playlistId = key.replace('playlist_videos:', '');
        return (await redisCache.getPlaylistVideos(playlistId)) as T;
      } else if (key.startsWith('suggestions:')) {
        const videoId = key.replace('suggestions:', '');
        return (await redisCache.getSuggestions(videoId)) as T;
      } else if (key.startsWith('artist_playlists:')) {
        const artistName = key.replace('artist_playlists:', '');
        return (await redisCache.getArtistPlaylists(artistName)) as T;
      }
    } catch (e) {
      console.warn('[YouTubeCache] Error getting from Redis:', e);
    }
    return null;
  }

  /**
   * Three-layer cache write:
   * L1: Memory (always)
   * L2: localStorage (unless memoryOnly)
   * L3: Redis (async, fire-and-forget, unless memoryOnly)
   */
  private set<T>(
    key: string, 
    data: T, 
    options?: { memoryOnly?: boolean; memoryTTL?: number; storageTTL?: number }
  ): void {
    const now = Date.now();
    const memoryTTL = options?.memoryTTL ?? this.config.memoryTTL;
    const storageTTL = options?.storageTTL ?? this.config.storageTTL;

    const memEntry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + memoryTTL,
    };

    // 1. Stocker en mémoire
    this.enforceMemoryLimit();
    this.memoryCache.set(key, memEntry);

    // 2. Stocker en localStorage (sauf si memoryOnly, uniquement côté client)
    if (!options?.memoryOnly && typeof window !== 'undefined' && window.localStorage) {
      try {
        const storageEntry: CacheEntry<T> = {
          data,
          timestamp: now,
          expiresAt: now + storageTTL,
        };
        this.enforceStorageLimit();
        localStorage.setItem(this.STORAGE_PREFIX + key, JSON.stringify(storageEntry));
      } catch (e) {
        console.warn('[YouTubeCache] Erreur écriture localStorage:', e);
      }
    }

    // 3. Stocker en Redis (L3, asynchrone, fire-and-forget)
    // Ne pas attendre, ne pas bloquer
    if (!options?.memoryOnly) {
      this._setInRedisAsync(key, data, storageTTL).catch(e => {
        console.warn('[YouTubeCache] Erreur écriture Redis:', e);
      });
    }
  }

  /**
   * Async Redis write (fire-and-forget)
   */
  private async _setInRedisAsync<T>(key: string, data: T, ttlMs: number): Promise<void> {
    try {
      if (key.startsWith('video:')) {
        // data is already the YouTubeVideo object
        await redisCache.setVideo(data as any);
      } else if (key.startsWith('search:')) {
        const query = key.replace('search:', '');
        // data is the array of videos
        await redisCache.setSearch(query, data as any);
      } else if (key.startsWith('playlist:')) {
        // data is already the YouTubePlaylist object
        await redisCache.setPlaylist(data as any);
      } else if (key.startsWith('playlist_videos:')) {
        const playlistId = key.replace('playlist_videos:', '');
        // data is the array of videos
        await redisCache.setPlaylistVideos(playlistId, data as any);
      } else if (key.startsWith('suggestions:')) {
        const videoId = key.replace('suggestions:', '');
        // data is the array of videos
        await redisCache.setSuggestions(videoId, data as any);
      } else if (key.startsWith('artist_playlists:')) {
        const artistName = key.replace('artist_playlists:', '');
        // data is the array of playlists
        await redisCache.setArtistPlaylists(artistName, data as any);
      }
    } catch (e) {
      console.warn('[YouTubeCache] Error setting in Redis:', e);
    }
  }

  private enforceMemoryLimit(): void {
    if (this.memoryCache.size >= this.config.maxMemoryItems) {
      // Supprimer les entrées les plus anciennes
      const entries = Array.from(this.memoryCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toDelete = entries.slice(0, Math.floor(this.config.maxMemoryItems * 0.2));
      toDelete.forEach(([key]) => this.memoryCache.delete(key));
    }
  }

  private enforceStorageLimit(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.STORAGE_PREFIX)) {
          keys.push(key);
        }
      }

      if (keys.length >= this.config.maxStorageItems) {
        // Supprimer les plus anciennes
        const entries = keys.map(key => {
          try {
            const entry = JSON.parse(localStorage.getItem(key) || '{}');
            return { key, timestamp: entry.timestamp || 0 };
          } catch {
            return { key, timestamp: 0 };
          }
        });
        entries.sort((a, b) => a.timestamp - b.timestamp);
        const toDelete = entries.slice(0, Math.floor(this.config.maxStorageItems * 0.2));
        toDelete.forEach(({ key }) => localStorage.removeItem(key));
      }
    } catch (e) {
      console.warn('[YouTubeCache] Erreur gestion limite storage:', e);
    }
  }

  private cleanupExpired(): void {
    // Nettoyer mémoire
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now >= entry.expiresAt) {
        this.memoryCache.delete(key);
      }
    }

    // Nettoyer localStorage (uniquement côté client)
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key?.startsWith(this.STORAGE_PREFIX)) {
            try {
              const entry = JSON.parse(localStorage.getItem(key) || '{}');
              if (now >= entry.expiresAt) {
                localStorage.removeItem(key);
              }
            } catch {
              localStorage.removeItem(key);
            }
          }
        }
      } catch (e) {
        console.warn('[YouTubeCache] Erreur nettoyage localStorage:', e);
      }
    }
  }

  clear(): void {
    this.memoryCache.clear();
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key?.startsWith(this.STORAGE_PREFIX)) {
            localStorage.removeItem(key);
          }
        }
      } catch (e) {
        console.warn('[YouTubeCache] Erreur clear localStorage:', e);
      }
    }
  }

  getStats(): { memoryItems: number; storageItems: number } {
    let storageItems = 0;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          if (localStorage.key(i)?.startsWith(this.STORAGE_PREFIX)) {
            storageItems++;
          }
        }
      } catch {}
    }
    
    return {
      memoryItems: this.memoryCache.size,
      storageItems,
    };
  }
}

// Singleton
export const youtubeCache = new YouTubeCache();
export { YouTubeCache };
