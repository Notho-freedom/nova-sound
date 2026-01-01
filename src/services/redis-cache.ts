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
 * 
 * @version 2.0 - 2025-12-31 - Rate limiting + Circuit breaker
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
  private isAvailable = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_REDIS_ENABLED !== 'false';

  // Batch queue for debounced writes
  private trackBatchQueue: Map<string, Track> = new Map();
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 10000; // 10 seconds debounce (rate limiting)
  private readonly BATCH_SIZE = 50; // Max tracks per batch
  private isFlushing = false; // Lock to prevent concurrent flushes
  private lastFlushTime = 0; // Track last successful flush
  private readonly MIN_FLUSH_INTERVAL = 10000; // Minimum 10s between flushes
  private backoffMultiplier = 1; // Exponential backoff on errors
  private readonly MAX_BACKOFF = 5; // Max 50s backoff (10s * 5)
  
  // Circuit breaker pattern
  private failureCount = 0;
  private readonly FAILURE_THRESHOLD = 3; // Open circuit after 3 failures
  private circuitOpen = false;
  private circuitOpenTime = 0;
  private readonly CIRCUIT_RESET_TIMEOUT = 60000; // Try again after 60s

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
      const reason = typeof window === 'undefined' 
        ? 'non-browser environment'
        : 'REDIS_ENABLED=false';
      console.warn(`[RedisCacheService] Redis sync disabled (${reason})`);
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
      const response = await fetch(`${this.baseURL}/video/${videoId}`, { signal: AbortSignal.timeout(2000) });
      if (!response.ok) return null;
      const entry = await response.json();
      return entry.data || null;
    } catch (e: any) {
      // Silent fail for GET operations - expected in offline scenarios
      // Catch AbortError, ECONNRESET, and network errors
      if (e.name === 'AbortError' || e.code === 'ECONNRESET' || e.code === 'ECONNREFUSED') {
        return null;
      }
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
      const response = await fetch(`${this.baseURL}/video/${video.videoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
        signal: AbortSignal.timeout(3000),
      });
      // Log non-200 responses but don't throw - offline-first
      if (!response.ok) {
        console.debug(`[RedisCacheService] Video sync failed (${response.status}), continuing with local cache`);
      }
    } catch (e: any) {
      // Silent fail - Redis sync is non-critical, continue with local cache
      // Specifically catch timeout, abort, and connection errors
      if (e.name === 'AbortError' || e.code === 'ECONNRESET' || e.code === 'ECONNREFUSED') {
        return; // Silent return for expected errors
      }
      console.debug('[RedisCacheService] Video sync offline, using local cache only');
    }
  }

  // ==================== SEARCHES ====================

  async getSearch(query: string): Promise<YouTubeVideo[] | null> {
    if (!this.isAvailable) return null;
    try {
      const key = `search:${query.toLowerCase().trim()}`;
      const response = await fetch(`${this.baseURL}/search?key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(2000) });
      if (!response.ok) return null;
      const entry = await response.json();
      return entry.data || null;
    } catch (e: any) {
      if (e.name === 'AbortError' || e.code === 'ECONNRESET' || e.code === 'ECONNREFUSED') {
        return null;
      }
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
      const response = await fetch(`${this.baseURL}/search`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, ...entry }),
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) {
        console.debug(`[RedisCacheService] Search sync failed (${response.status})`);
      }
    } catch (e: any) {
      if (e.name === 'AbortError' || e.code === 'ECONNRESET' || e.code === 'ECONNREFUSED') {
        return; // Silent return for expected errors
      }
      console.debug('[RedisCacheService] Search sync offline');
    }
  }

  // ==================== PLAYLISTS ====================

  async getPlaylist(playlistId: string): Promise<YouTubePlaylist | null> {
    if (!this.isAvailable) return null;
    try {
      const response = await fetch(`${this.baseURL}/playlist/${playlistId}`, { signal: AbortSignal.timeout(2000) });
      if (!response.ok) return null;
      const entry = await response.json();
      return entry.data || null;
    } catch (e: any) {
      if (e.name === 'AbortError' || e.code === 'ECONNRESET' || e.code === 'ECONNREFUSED') {
        return null;
      }
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
      const response = await fetch(`${this.baseURL}/playlist/${playlist.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) {
        console.debug(`[RedisCacheService] Playlist sync failed (${response.status})`);
      }
    } catch (e: any) {
      if (e.name === 'AbortError' || e.code === 'ECONNRESET' || e.code === 'ECONNREFUSED') {
        return; // Silent return for expected errors
      }
      console.debug('[RedisCacheService] Playlist sync offline');
    }
  }

  async getPlaylistVideos(playlistId: string): Promise<YouTubeVideo[] | null> {
    if (!this.isAvailable) return null;
    try {
      const key = `playlist_videos:${playlistId}`;
      const response = await fetch(`${this.baseURL}/playlist-videos?key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(2000) });
      if (!response.ok) return null;
      const entry = await response.json();
      return entry.data || null;
    } catch (e: any) {
      if (e.name === 'AbortError' || e.code === 'ECONNRESET' || e.code === 'ECONNREFUSED') {
        return null;
      }
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
      const response = await fetch(`${this.baseURL}/playlist-videos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, ...entry }),
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) {
        console.debug(`[RedisCacheService] Playlist videos sync failed (${response.status})`);
      }
    } catch (e: any) {
      if (e.name === 'AbortError' || e.code === 'ECONNRESET' || e.code === 'ECONNREFUSED') {
        return; // Silent return for expected errors
      }
      console.debug('[RedisCacheService] Playlist videos sync offline');
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
      const response = await fetch(`${this.baseURL}/track/${trackId}`, { signal: AbortSignal.timeout(2000) });
      if (!response.ok) return null;
      const entry = await response.json();
      return entry.data || null;
    } catch (e: any) {
      if (e.name === 'AbortError' || e.code === 'ECONNRESET' || e.code === 'ECONNREFUSED') {
        return null;
      }
      return null;
    }
  }

  /**
   * Queue a track for batch writing (debounced)
   * This prevents request storms when adding multiple tracks
   */
  async setTrack(track: Track): Promise<void> {
    if (!this.isAvailable) return;
    
    // Add to batch queue instead of immediate write
    this.trackBatchQueue.set(track.id, track);
    
    // Cancel previous timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    
    // Calculate next allowed flush time
    const now = Date.now();
    const timeSinceLastFlush = now - this.lastFlushTime;
    const minInterval = this.MIN_FLUSH_INTERVAL * this.backoffMultiplier;
    
    // Determine delay: either full BATCH_DELAY or remaining time until next allowed flush
    let delay = this.BATCH_DELAY;
    if (timeSinceLastFlush < minInterval) {
      delay = Math.max(delay, minInterval - timeSinceLastFlush);
    }
    
    // Schedule batch write after calculated delay
    this.batchTimeout = setTimeout(() => {
      this.flushTrackBatch();
    }, delay);
    
    // Flush if queue is full AND we're outside the cooldown period
    if (this.trackBatchQueue.size >= this.BATCH_SIZE && timeSinceLastFlush >= minInterval) {
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
        this.batchTimeout = null;
      }
      this.flushTrackBatch();
    }
  }

  /**
   * Flush the track batch queue to Redis via batch endpoint
   * Uses Redis pipeline on server side
   */
  private async flushTrackBatch(): Promise<void> {
    // Prevent concurrent flushes (anti-loop protection)
    if (this.isFlushing || this.trackBatchQueue.size === 0) return;
    
    // Circuit breaker: if open, check if we can try again
    if (this.circuitOpen) {
      const now = Date.now();
      if (now - this.circuitOpenTime < this.CIRCUIT_RESET_TIMEOUT) {
        console.debug(`[RedisCacheService] 🚫 Circuit breaker open, skipping flush (${Math.round((this.CIRCUIT_RESET_TIMEOUT - (now - this.circuitOpenTime))/1000)}s remaining)`);
        return;
      }
      // Try to close the circuit
      console.debug('[RedisCacheService] 🔄 Circuit breaker: attempting reconnection');
      this.circuitOpen = false;
      this.failureCount = 0;
    }
    
    // Rate limiting: enforce minimum interval between flushes
    const now = Date.now();
    const timeSinceLastFlush = now - this.lastFlushTime;
    const minInterval = this.MIN_FLUSH_INTERVAL * this.backoffMultiplier;
    
    if (timeSinceLastFlush < minInterval) {
      // Too soon, reschedule
      const delay = minInterval - timeSinceLastFlush;
      console.debug(`[RedisCacheService] ⏱️ Rate limit: rescheduling flush in ${Math.round(delay/1000)}s`);
      
      if (this.batchTimeout) clearTimeout(this.batchTimeout);
      this.batchTimeout = setTimeout(() => this.flushTrackBatch(), delay);
      return;
    }
    
    this.isFlushing = true;
    const tracks = Array.from(this.trackBatchQueue.values());
    this.trackBatchQueue.clear();
    
    try {
      const response = await fetch(`${this.baseURL}/batch/tracks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tracks),
        signal: AbortSignal.timeout(8000), // 8s timeout for batch
      });
      
      if (response.ok) {
        console.debug(`[RedisCacheService] ✓ Batch flushed ${tracks.length} tracks`);
        this.lastFlushTime = Date.now();
        this.backoffMultiplier = 1; // Reset backoff on success
        this.failureCount = 0; // Reset failure count on success
      } else if (response.status === 307 || response.status === 503) {
        // Redirect or service unavailable - count as failure
        this.failureCount++;
        this.backoffMultiplier = Math.min(this.backoffMultiplier + 1, this.MAX_BACKOFF);
        
        console.warn(`[RedisCacheService] ⚠️ Flush failed (${response.status}), failures: ${this.failureCount}/${this.FAILURE_THRESHOLD}, backoff: ${this.backoffMultiplier}x`);
        
        // Open circuit breaker if threshold reached
        if (this.failureCount >= this.FAILURE_THRESHOLD) {
          this.circuitOpen = true;
          this.circuitOpenTime = Date.now();
          console.error(`[RedisCacheService] 🚫 Circuit breaker OPEN - Redis appears unavailable, pausing for ${this.CIRCUIT_RESET_TIMEOUT/1000}s`);
          // Don't re-queue on circuit open
          this.trackBatchQueue.clear();
          this.isFlushing = false;
          return;
        }
        
        // Re-queue tracks for retry (only if circuit not open)
        tracks.forEach(track => this.trackBatchQueue.set(track.id, track));
        
        // Schedule retry with backoff
        const retryDelay = this.MIN_FLUSH_INTERVAL * this.backoffMultiplier;
        if (this.batchTimeout) clearTimeout(this.batchTimeout);
        this.batchTimeout = setTimeout(() => this.flushTrackBatch(), retryDelay);
      } else {
        console.debug(`[RedisCacheService] Batch flush failed (${response.status})`);
      }
    } catch (e: any) {
      if (e.name === 'AbortError' || e.code === 'ECONNRESET' || e.code === 'ECONNREFUSED') {
        // Network error - count as failure
        this.failureCount++;
        this.backoffMultiplier = Math.min(this.backoffMultiplier + 1, this.MAX_BACKOFF);
        
        console.debug(`[RedisCacheService] Network error, failures: ${this.failureCount}/${this.FAILURE_THRESHOLD}, backoff: ${this.backoffMultiplier}x`);
        
        // Open circuit breaker if threshold reached
        if (this.failureCount >= this.FAILURE_THRESHOLD) {
          this.circuitOpen = true;
          this.circuitOpenTime = Date.now();
          console.error(`[RedisCacheService] 🚫 Circuit breaker OPEN - Network error, pausing for ${this.CIRCUIT_RESET_TIMEOUT/1000}s`);
          this.trackBatchQueue.clear();
          this.isFlushing = false;
          return;
        }
        
        // Re-queue tracks (only if circuit not open)
        tracks.forEach(track => this.trackBatchQueue.set(track.id, track));
        
        this.isFlushing = false;
        return;
      }
      console.debug('[RedisCacheService] Batch flush offline');
    } finally {
      this.isFlushing = false;
    }
  }

  async getTracks(trackIds: string[]): Promise<Track[]> {
    if (!this.isAvailable || trackIds.length === 0) return [];
    try {
      const keys = trackIds.join(',');
      const response = await fetch(`${this.baseURL}/batch/tracks?ids=${encodeURIComponent(keys)}`, { 
        signal: AbortSignal.timeout(3000) // Longer timeout for batch
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.tracks || [];
    } catch (e: any) {
      if (e.name === 'AbortError' || e.code === 'ECONNRESET' || e.code === 'ECONNREFUSED') {
        return [];
      }
      return [];
    }
  }

  async setTracks(tracks: Track[]): Promise<void> {
    if (!this.isAvailable || tracks.length === 0) return;
    
    // Check circuit breaker
    if (this.circuitOpen) {
      const now = Date.now();
      if (now - this.circuitOpenTime < this.CIRCUIT_RESET_TIMEOUT) {
        console.debug(`[RedisCacheService] 🚫 Circuit breaker open, skipping setTracks (${Math.round((this.CIRCUIT_RESET_TIMEOUT - (now - this.circuitOpenTime))/1000)}s remaining)`);
        return;
      }
    }
    
    // Use batch endpoint directly for explicit batch calls
    try {
      const response = await fetch(`${this.baseURL}/batch/tracks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tracks),
        signal: AbortSignal.timeout(8000), // 8s timeout for batch
      });
      if (response.ok) {
        console.debug(`[RedisCacheService] ✓ Batch set ${tracks.length} tracks`);
        this.failureCount = 0; // Reset on success
        this.backoffMultiplier = 1;
      } else if (response.status === 307 || response.status === 503) {
        this.failureCount++;
        console.warn(`[RedisCacheService] ⚠️ Batch set failed (${response.status}), failures: ${this.failureCount}/${this.FAILURE_THRESHOLD}`);
        
        // Open circuit breaker if threshold reached
        if (this.failureCount >= this.FAILURE_THRESHOLD) {
          this.circuitOpen = true;
          this.circuitOpenTime = Date.now();
          console.error(`[RedisCacheService] 🚫 Circuit breaker OPEN from setTracks`);
        }
      } else {
        console.debug(`[RedisCacheService] Batch set failed (${response.status})`);
      }
    } catch (e: any) {
      if (e.name === 'AbortError' || e.code === 'ECONNRESET' || e.code === 'ECONNREFUSED') {
        this.failureCount++;
        console.debug(`[RedisCacheService] Network error in setTracks, failures: ${this.failureCount}/${this.FAILURE_THRESHOLD}`);
        
        // Open circuit breaker if threshold reached
        if (this.failureCount >= this.FAILURE_THRESHOLD) {
          this.circuitOpen = true;
          this.circuitOpenTime = Date.now();
          console.error(`[RedisCacheService] 🚫 Circuit breaker OPEN from setTracks network error`);
        }
        return;
      }
      console.debug('[RedisCacheService] Batch set offline');
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
   * Verify Redis connection with short timeout
   * Returns false on any error (offline-first approach)
   */
  async isConnected(): Promise<boolean> {
    if (!this.isAvailable) return false;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const response = await fetch(`${this.baseURL}?action=health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response.ok && response.status === 200;
    } catch (e: any) {
      // Silently fail - Redis is optional
      // Handle AbortError, ECONNRESET, and other network errors
      if (e.name === 'AbortError' || e.code === 'ECONNRESET' || e.code === 'ECONNREFUSED') {
        return false;
      }
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
