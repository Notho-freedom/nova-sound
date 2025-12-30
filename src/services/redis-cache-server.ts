/**
 * Redis Cache Server
 * 
 * Server-side Redis integration for Nova Sound
 * Manages the L3 cache layer shared across all users
 * 
 * Features:
 * - Real-time sync between client caches and Redis
 * - Automatic expiration management
 * - No duplicate entries
 * - Distributed cache for all users
 */

import { createClient, RedisClientType } from 'redis';

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class RedisCacheServer {
  private client: RedisClientType | null = null;
  private isConnected = false;

  // Redis configuration
  private readonly CONFIG = {
    username: process.env.REDIS_USERNAME || '',
    password: process.env.REDIS_PASSWORD || '',
    socket: {
      host: process.env.REDIS_HOST || '',
      port: parseInt(process.env.REDIS_PORT || ''),
    },
    // TTL configuration
    videoTTL: 7 * 24 * 60 * 60,           // 7 days in seconds
    searchTTL: 7 * 24 * 60 * 60,          // 7 days
    playlistTTL: 24 * 60 * 60,            // 24 hours
    playlistVideosTTL: 6 * 60 * 60,       // 6 hours
    suggestionsTTL: 7 * 24 * 60 * 60,     // 7 days
    artistPlaylistsTTL: 24 * 60 * 60,     // 24 hours
    trackTTL: 30 * 24 * 60 * 60,          // 30 days
  };

  async connect(): Promise<void> {
    try {
      this.client = createClient({
        username: this.CONFIG.username,
        password: this.CONFIG.password,
        socket: this.CONFIG.socket,
      });

      this.client.on('error', (err) => {
        console.error('[RedisCacheServer] Redis error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('[RedisCacheServer] Redis connected');
        this.isConnected = true;
      });

      await this.client.connect();
      console.log('[RedisCacheServer] Connected to Redis server');
    } catch (error) {
      console.error('[RedisCacheServer] Connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      console.log('[RedisCacheServer] Disconnected from Redis');
    }
  }

  private async setWithTTL<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
    if (!this.client || !this.isConnected) {
      console.warn('[RedisCacheServer] Redis not connected, skipping cache write');
      return;
    }

    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + ttlSeconds * 1000,
      };
      await this.client.setEx(key, ttlSeconds, JSON.stringify(entry));
    } catch (error) {
      console.error('[RedisCacheServer] Error setting key:', error);
    }
  }

  private async getAndValidate<T>(key: string): Promise<T | null> {
    if (!this.client || !this.isConnected) {
      console.warn('[RedisCacheServer] Redis not connected, returning null');
      return null;
    }

    try {
      const stored = await this.client.get(key);
      if (!stored) return null;

      const entry = JSON.parse(stored) as CacheEntry<T>;
      
      // Check if expired
      if (Date.now() >= entry.expiresAt) {
        await this.client.del(key); // Clean up expired entry
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error('[RedisCacheServer] Error getting key:', error);
      return null;
    }
  }

  // ==================== VIDEO CACHE ====================

  async getVideo(videoId: string): Promise<any | null> {
    const key = `video:${videoId}`;
    return this.getAndValidate(key);
  }

  async setVideo(videoId: string, video: any): Promise<void> {
    const key = `video:${videoId}`;
    await this.setWithTTL(key, video, this.CONFIG.videoTTL);
  }

  // ==================== SEARCH CACHE ====================

  async getSearch(query: string): Promise<any[] | null> {
    const key = `search:${query.toLowerCase().trim()}`;
    return this.getAndValidate(key);
  }

  async setSearch(query: string, videos: any[]): Promise<void> {
    const key = `search:${query.toLowerCase().trim()}`;
    await this.setWithTTL(key, videos, this.CONFIG.searchTTL);
  }

  // ==================== PLAYLIST CACHE ====================

  async getPlaylist(playlistId: string): Promise<any | null> {
    const key = `playlist:${playlistId}`;
    return this.getAndValidate(key);
  }

  async setPlaylist(playlistId: string, playlist: any): Promise<void> {
    const key = `playlist:${playlistId}`;
    await this.setWithTTL(key, playlist, this.CONFIG.playlistTTL);
  }

  async getPlaylistVideos(playlistId: string): Promise<any[] | null> {
    const key = `playlist_videos:${playlistId}`;
    return this.getAndValidate(key);
  }

  async setPlaylistVideos(playlistId: string, videos: any[]): Promise<void> {
    const key = `playlist_videos:${playlistId}`;
    await this.setWithTTL(key, videos, this.CONFIG.playlistVideosTTL);
  }

  // ==================== SUGGESTIONS CACHE ====================

  async getSuggestions(videoId: string): Promise<any[] | null> {
    const key = `suggestions:${videoId}`;
    return this.getAndValidate(key);
  }

  async setSuggestions(videoId: string, suggestions: any[]): Promise<void> {
    const key = `suggestions:${videoId}`;
    await this.setWithTTL(key, suggestions, this.CONFIG.suggestionsTTL);
  }

  // ==================== ARTIST PLAYLISTS CACHE ====================

  async getArtistPlaylists(artistName: string): Promise<any[] | null> {
    const key = `artist_playlists:${artistName.toLowerCase().trim()}`;
    return this.getAndValidate(key);
  }

  async setArtistPlaylists(artistName: string, playlists: any[]): Promise<void> {
    const key = `artist_playlists:${artistName.toLowerCase().trim()}`;
    await this.setWithTTL(key, playlists, this.CONFIG.artistPlaylistsTTL);
  }

  // ==================== TRACK CACHE ====================

  async getTrack(trackId: string): Promise<any | null> {
    const key = `track:${trackId}`;
    return this.getAndValidate(key);
  }

  async setTrack(trackId: string, track: any): Promise<void> {
    const key = `track:${trackId}`;
    await this.setWithTTL(key, track, this.CONFIG.trackTTL);
  }

  async getTracks(trackIds: string[]): Promise<any[]> {
    const results: any[] = [];
    for (const id of trackIds) {
      const track = await this.getTrack(id);
      if (track) results.push(track);
    }
    return results;
  }

  async setTracks(tracks: any[]): Promise<void> {
    for (const track of tracks) {
      await this.setTrack(track.id, track);
    }
  }

  // ==================== CACHE MANAGEMENT ====================

  async clear(): Promise<void> {
    if (!this.client || !this.isConnected) {
      console.warn('[RedisCacheServer] Redis not connected');
      return;
    }

    try {
      // Delete all keys with our prefixes (safe deletion)
      const patterns = [
        'video:*',
        'search:*',
        'playlist:*',
        'playlist_videos:*',
        'suggestions:*',
        'artist_playlists:*',
        'track:*',
        'migration:*',
      ];

      for (const pattern of patterns) {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(keys);
          console.log(`[RedisCacheServer] Cleared ${keys.length} keys matching ${pattern}`);
        }
      }
    } catch (error) {
      console.error('[RedisCacheServer] Error clearing cache:', error);
    }
  }

  async getStats(): Promise<{ keys: number; memory: string }> {
    if (!this.client || !this.isConnected) {
      return { keys: 0, memory: '0B' };
    }

    try {
      const info = await this.client.info('memory');
      const dbSize = await this.client.dbSize();
      
      // Parse memory usage from INFO
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memory = memoryMatch ? memoryMatch[1] : 'unknown';

      return {
        keys: dbSize,
        memory,
      };
    } catch (error) {
      console.error('[RedisCacheServer] Error getting stats:', error);
      return { keys: 0, memory: '0B' };
    }
  }

  async health(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch (error) {
      console.error('[RedisCacheServer] Health check failed:', error);
      return false;
    }
  }

  /**
   * Get all cache entries matching pattern
   * Useful for migration and debugging
   */
  async getAllEntries(pattern: string = '*'): Promise<Record<string, any>> {
    if (!this.client || !this.isConnected) {
      return {};
    }

    try {
      const keys = await this.client.keys(pattern);
      const entries: Record<string, any> = {};

      for (const key of keys) {
        const stored = await this.client.get(key);
        if (stored) {
          try {
            const entry = JSON.parse(stored) as CacheEntry;
            entries[key] = entry;
          } catch (e) {
            entries[key] = { error: 'Failed to parse entry' };
          }
        }
      }

      return entries;
    } catch (error) {
      console.error('[RedisCacheServer] Error getting entries:', error);
      return {};
    }
  }

  /**
   * Check for duplicate keys between two sets
   * Used during migration to avoid overwrites
   */
  async findDuplicates(newKeys: string[]): Promise<string[]> {
    if (!this.client || !this.isConnected) {
      return [];
    }

    try {
      const existingKeys = await this.client.keys('*');
      return newKeys.filter(key => existingKeys.includes(key));
    } catch (error) {
      console.error('[RedisCacheServer] Error finding duplicates:', error);
      return [];
    }
  }

  /**
   * Migrate data from localStorage to Redis (server-side execution)
   * Called during app initialization
   */
  async migrateFromLocalStorage(data: Record<string, any>): Promise<{ migrated: number; skipped: number; errors: number }> {
    if (!this.client || !this.isConnected) {
      console.warn('[RedisCacheServer] Redis not connected, migration skipped');
      return { migrated: 0, skipped: 0, errors: 0 };
    }

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    try {
      for (const [key, value] of Object.entries(data)) {
        try {
          // Check if key already exists in Redis
          const exists = await this.client.exists(key);
          if (exists) {
            skipped++;
            console.log(`[RedisCacheServer] Skipped existing key: ${key}`);
            continue;
          }

          // Parse localStorage entry
          let entry: CacheEntry;
          if (typeof value === 'string') {
            entry = JSON.parse(value);
          } else {
            entry = value as CacheEntry;
          }

          // Calculate remaining TTL
          const now = Date.now();
          const remainingMs = entry.expiresAt - now;
          const remainingSeconds = Math.max(60, Math.ceil(remainingMs / 1000)); // Minimum 1 minute

          // Migrate to Redis
          await this.client.setEx(key, remainingSeconds, JSON.stringify(entry));
          migrated++;
        } catch (e) {
          console.error(`[RedisCacheServer] Error migrating key ${key}:`, e);
          errors++;
        }
      }

      console.log(`[RedisCacheServer] Migration complete: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);
      return { migrated, skipped, errors };
    } catch (error) {
      console.error('[RedisCacheServer] Migration failed:', error);
      return { migrated, skipped, errors };
    }
  }
}

// Export singleton instance
export const redisCacheServer = new RedisCacheServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('[RedisCacheServer] Shutting down...');
  await redisCacheServer.disconnect();
  process.exit(0);
});

export default redisCacheServer;
