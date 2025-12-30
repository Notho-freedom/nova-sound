/**
 * Redis Cache Service
 * 
 * Three-layer caching architecture:
 * - L1: Memory (10 min TTL) - Fast, volatile
 * - L2: localStorage (7 days TTL) - Persistent, browser-local
 * - L3: Redis (7-30 days TTL) - Shared backup cache across all users
 * 
 * Redis serves as a distributed cache layer that:
 * 1. Syncs data from all users' browsers
 * 2. Provides fallback when local caches miss
 * 3. Enables offline-first with server-side backup
 * 4. Reduces API calls for popular content
 */

import type { YouTubeVideo, YouTubePlaylist, YouTubeSearchResult } from '@/services/youtube/types';
import type { Track } from '@/types/music';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Redis cache service - Singleton pattern
 * 
 * Note: This is a client-side service that communicates with Redis
 * For server-side Node.js environments, use redis client directly
 * For browser environments, this communicates via API endpoints
 */
export class RedisCacheService {
  private static instance: RedisCacheService;
  private baseURL = process.env.NEXT_PUBLIC_REDIS_API_URL || '/api/cache/redis';
  private isAvailable = typeof window !== 'undefined';

  // Configuration
  private readonly CONFIG = {
    videoTTL: 7 * 24 * 60 * 60 * 1000,           // 7 days
    searchTTL: 7 * 24 * 60 * 60 * 1000,          // 7 days
    playlistTTL: 24 * 60 * 60 * 1000,            // 24 hours
    playlistVideosTTL: 6 * 60 * 60 * 1000,       // 6 hours
    suggestionsTTL: 7 * 24 * 60 * 60 * 1000,     // 7 days
    artistPlaylistsTTL: 24 * 60 * 60 * 1000,     // 24 hours
    trackTTL: 30 * 24 * 60 * 60 * 1000,          // 30 days
  };

  private constructor() {
    if (!this.isAvailable) {
      console.warn('[RedisCacheService] Running in non-browser environment, Redis sync disabled');
    }
  }

  static getInstance(): RedisCacheService {
    if (!RedisCacheService.instance) {
      RedisCacheService.instance = new RedisCacheService();
    }
    return RedisCacheService.instance;
  }

  // ==================== VIDEOS ====================

  async getVideo(videoId: string): Promise<YouTubeVideo | null> {
    if (!this.isAvailable) return null;
    try {
      const response = await fetch(`${this.baseURL}/video/${videoId}`);
      if (!response.ok) return null;
      const entry = await response.json();
      return entry.data || null;
    } catch (e) {
      console.warn('[RedisCacheService] Error getting video:', e);
      return null;
    }
  }

  async setVideo(video: YouTubeVideo): Promise<void> {
    if (!this.isAvailable) return;
    try {
      const entry: CacheEntry<YouTubeVideo> = {
        data: video,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.CONFIG.videoTTL,
      };
      await fetch(`${this.baseURL}/video/${video.videoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch (e) {
      console.warn('[RedisCacheService] Error setting video:', e);
    }
  }

  // ==================== SEARCHES ====================

  async getSearch(query: string): Promise<YouTubeVideo[] | null> {
    if (!this.isAvailable) return null;
    try {
      const key = `search:${query.toLowerCase().trim()}`;
      const response = await fetch(`${this.baseURL}/search?key=${encodeURIComponent(key)}`);
      if (!response.ok) return null;
      const entry = await response.json();
      return entry.data || null;
    } catch (e) {
      console.warn('[RedisCacheService] Error getting search:', e);
      return null;
    }
  }

  async setSearch(query: string, videos: YouTubeVideo[]): Promise<void> {
    if (!this.isAvailable) return;
    try {
      const key = `search:${query.toLowerCase().trim()}`;
      const entry: CacheEntry<YouTubeVideo[]> = {
        data: videos,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.CONFIG.searchTTL,
      };
      await fetch(`${this.baseURL}/search`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, ...entry }),
      });
    } catch (e) {
      console.warn('[RedisCacheService] Error setting search:', e);
    }
  }

  // ==================== PLAYLISTS ====================

  async getPlaylist(playlistId: string): Promise<YouTubePlaylist | null> {
    if (!this.isAvailable) return null;
    try {
      const response = await fetch(`${this.baseURL}/playlist/${playlistId}`);
      if (!response.ok) return null;
      const entry = await response.json();
      return entry.data || null;
    } catch (e) {
      console.warn('[RedisCacheService] Error getting playlist:', e);
      return null;
    }
  }

  async setPlaylist(playlist: YouTubePlaylist): Promise<void> {
    if (!this.isAvailable) return;
    try {
      const entry: CacheEntry<YouTubePlaylist> = {
        data: playlist,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.CONFIG.playlistTTL,
      };
      await fetch(`${this.baseURL}/playlist/${playlist.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch (e) {
      console.warn('[RedisCacheService] Error setting playlist:', e);
    }
  }

  async getPlaylistVideos(playlistId: string): Promise<YouTubeVideo[] | null> {
    if (!this.isAvailable) return null;
    try {
      const key = `playlist_videos:${playlistId}`;
      const response = await fetch(`${this.baseURL}/playlist-videos?key=${encodeURIComponent(key)}`);
      if (!response.ok) return null;
      const entry = await response.json();
      return entry.data || null;
    } catch (e) {
      console.warn('[RedisCacheService] Error getting playlist videos:', e);
      return null;
    }
  }

  async setPlaylistVideos(playlistId: string, videos: YouTubeVideo[]): Promise<void> {
    if (!this.isAvailable) return;
    try {
      const key = `playlist_videos:${playlistId}`;
      const entry: CacheEntry<YouTubeVideo[]> = {
        data: videos,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.CONFIG.playlistVideosTTL,
      };
      await fetch(`${this.baseURL}/playlist-videos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, ...entry }),
      });
    } catch (e) {
      console.warn('[RedisCacheService] Error setting playlist videos:', e);
    }
  }

  // ==================== SUGGESTIONS ====================

  async getSuggestions(videoId: string): Promise<YouTubeVideo[] | null> {
    if (!this.isAvailable) return null;
    try {
      const key = `suggestions:${videoId}`;
      const response = await fetch(`${this.baseURL}/suggestions?key=${encodeURIComponent(key)}`);
      if (!response.ok) return null;
      const entry = await response.json();
      return entry.data || null;
    } catch (e) {
      console.warn('[RedisCacheService] Error getting suggestions:', e);
      return null;
    }
  }

  async setSuggestions(videoId: string, suggestions: YouTubeVideo[]): Promise<void> {
    if (!this.isAvailable) return;
    try {
      const key = `suggestions:${videoId}`;
      const entry: CacheEntry<YouTubeVideo[]> = {
        data: suggestions,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.CONFIG.suggestionsTTL,
      };
      await fetch(`${this.baseURL}/suggestions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, ...entry }),
      });
    } catch (e) {
      console.warn('[RedisCacheService] Error setting suggestions:', e);
    }
  }

  // ==================== ARTIST PLAYLISTS ====================

  async getArtistPlaylists(artistName: string): Promise<YouTubePlaylist[] | null> {
    if (!this.isAvailable) return null;
    try {
      const key = `artist_playlists:${artistName.toLowerCase().trim()}`;
      const response = await fetch(`${this.baseURL}/artist-playlists?key=${encodeURIComponent(key)}`);
      if (!response.ok) return null;
      const entry = await response.json();
      return entry.data || null;
    } catch (e) {
      console.warn('[RedisCacheService] Error getting artist playlists:', e);
      return null;
    }
  }

  async setArtistPlaylists(artistName: string, playlists: YouTubePlaylist[]): Promise<void> {
    if (!this.isAvailable) return;
    try {
      const key = `artist_playlists:${artistName.toLowerCase().trim()}`;
      const entry: CacheEntry<YouTubePlaylist[]> = {
        data: playlists,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.CONFIG.artistPlaylistsTTL,
      };
      await fetch(`${this.baseURL}/artist-playlists`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, ...entry }),
      });
    } catch (e) {
      console.warn('[RedisCacheService] Error setting artist playlists:', e);
    }
  }

  // ==================== TRACKS ====================

  async getTrack(trackId: string): Promise<Track | null> {
    if (!this.isAvailable) return null;
    try {
      const response = await fetch(`${this.baseURL}/track/${trackId}`);
      if (!response.ok) return null;
      const entry = await response.json();
      return entry.data || null;
    } catch (e) {
      console.warn('[RedisCacheService] Error getting track:', e);
      return null;
    }
  }

  async setTrack(track: Track): Promise<void> {
    if (!this.isAvailable) return;
    try {
      const entry: CacheEntry<Track> = {
        data: track,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.CONFIG.trackTTL,
      };
      await fetch(`${this.baseURL}/track/${track.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch (e) {
      console.warn('[RedisCacheService] Error setting track:', e);
    }
  }

  async getTracks(trackIds: string[]): Promise<Track[]> {
    if (!this.isAvailable) return [];
    try {
      const keys = trackIds.join(',');
      const response = await fetch(`${this.baseURL}/tracks?ids=${encodeURIComponent(keys)}`);
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map((entry: any) => entry.data).filter(Boolean) : [];
    } catch (e) {
      console.warn('[RedisCacheService] Error getting tracks:', e);
      return [];
    }
  }

  async setTracks(tracks: Track[]): Promise<void> {
    if (!this.isAvailable) return;
    try {
      const entries = tracks.map(track => ({
        id: track.id,
        data: track,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.CONFIG.trackTTL,
      }));
      await fetch(`${this.baseURL}/tracks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entries),
      });
    } catch (e) {
      console.warn('[RedisCacheService] Error setting tracks:', e);
    }
  }

  // ==================== CACHE MANAGEMENT ====================

  /**
   * Clear all Redis cache
   * Caution: This affects all users!
   */
  async clear(): Promise<void> {
    if (!this.isAvailable) return;
    try {
      await fetch(`${this.baseURL}/clear`, { method: 'POST' });
    } catch (e) {
      console.warn('[RedisCacheService] Error clearing cache:', e);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ keys: number; memory: number } | null> {
    if (!this.isAvailable) return null;
    try {
      const response = await fetch(`${this.baseURL}/stats`);
      if (!response.ok) return null;
      return await response.json();
    } catch (e) {
      console.warn('[RedisCacheService] Error getting stats:', e);
      return null;
    }
  }

  /**
   * Verify Redis connection
   */
  async isConnected(): Promise<boolean> {
    if (!this.isAvailable) return false;
    try {
      const response = await fetch(`${this.baseURL}/health`);
      return response.ok;
    } catch (e) {
      return false;
    }
  }

  /**
   * Get all cache entries (for debugging/migration)
   */
  async getAllEntries(pattern: string = '*'): Promise<Record<string, any>> {
    if (!this.isAvailable) return {};
    try {
      const response = await fetch(`${this.baseURL}/entries?pattern=${encodeURIComponent(pattern)}`);
      if (!response.ok) return {};
      return await response.json();
    } catch (e) {
      console.warn('[RedisCacheService] Error getting entries:', e);
      return {};
    }
  }
}

// Export singleton instance
export const redisCache = RedisCacheService.getInstance();
