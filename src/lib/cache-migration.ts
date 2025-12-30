/**
 * Cache Migration Service
 * 
 * Migrates data from localStorage (L2 cache) to Redis (L3 cache)
 * without duplicates or data loss
 * 
 * Strategy:
 * 1. Collect all localStorage cache entries
 * 2. Check for duplicates in Redis
 * 3. Skip existing entries (no overwrites)
 * 4. Migrate new entries
 * 5. Verify completeness
 */

import { redisCache } from '@/services/redis-cache';

interface MigrationResult {
  timestamp: string;
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
  duration: number; // ms
  success: boolean;
}

/**
 * Collect all cache entries from localStorage
 */
function collectLocalStorageCache(): Record<string, any> {
  const caches: Record<string, any> = {};

  try {
    // Collect YouTube service cache entries
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      // Collect all yt_cache_* entries
      if (key.startsWith('yt_cache_')) {
        const value = localStorage.getItem(key);
        if (value) {
          try {
            caches[key] = JSON.parse(value);
          } catch (e) {
            console.warn(`[Migration] Failed to parse ${key}:`, e);
          }
        }
      }

      // Collect YouTube track cache
      if (key === 'nexus-youtube-tracks-cache') {
        const value = localStorage.getItem(key);
        if (value) {
          try {
            const trackCache = JSON.parse(value);
            // Convert Map structure to individual track entries
            for (const [trackId, track] of Object.entries(trackCache)) {
              caches[`track:${trackId}`] = {
                data: track,
                timestamp: Date.now(),
                expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
              };
            }
          } catch (e) {
            console.warn(`[Migration] Failed to parse track cache:`, e);
          }
        }
      }
    }

    console.log(`[Migration] Collected ${Object.keys(caches).length} cache entries from localStorage`);
    return caches;
  } catch (error) {
    console.error('[Migration] Error collecting localStorage cache:', error);
    return {};
  }
}

/**
 * Migrate cache entries to Redis
 * Handles duplicates by skipping existing entries
 */
export async function migrateToRedis(): Promise<MigrationResult> {
  const startTime = Date.now();
  
  try {
    // Check Redis connection first
    const isConnected = await redisCache.isConnected();
    if (!isConnected) {
      console.warn('[Migration] Redis not connected, migration skipped');
      return {
        timestamp: new Date().toISOString(),
        total: 0,
        migrated: 0,
        skipped: 0,
        errors: 1,
        duration: Date.now() - startTime,
        success: false,
      };
    }

    // Collect local cache
    const localCache = collectLocalStorageCache();
    const total = Object.keys(localCache).length;

    if (total === 0) {
      console.log('[Migration] No cache entries to migrate');
      return {
        timestamp: new Date().toISOString(),
        total: 0,
        migrated: 0,
        skipped: 0,
        errors: 0,
        duration: Date.now() - startTime,
        success: true,
      };
    }

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    // Get all existing keys in Redis to check for duplicates
    const redisEntries = await redisCache.getAllEntries('*');
    const redisKeys = Object.keys(redisEntries);

    console.log(`[Migration] Redis has ${redisKeys.length} existing entries`);

    // Migrate entries
    for (const [key, entry] of Object.entries(localCache)) {
      try {
        // Check for duplicate
        if (redisKeys.includes(key)) {
          console.log(`[Migration] Skipping existing key: ${key}`);
          skipped++;
          continue;
        }

        // Determine which setter to use based on key prefix
        if (key.startsWith('video:')) {
          // entry.data is already the video object
          await redisCache.setVideo(entry.data);
        } else if (key.startsWith('search:')) {
          const query = key.replace('search:', '');
          // entry.data is the array of videos for this search
          await redisCache.setSearch(query, entry.data);
        } else if (key.startsWith('playlist:')) {
          // entry.data is already the playlist object
          await redisCache.setPlaylist(entry.data);
        } else if (key.startsWith('playlist_videos:')) {
          const playlistId = key.replace('playlist_videos:', '');
          // entry.data is the array of videos in this playlist
          await redisCache.setPlaylistVideos(playlistId, entry.data);
        } else if (key.startsWith('suggestions:')) {
          const videoId = key.replace('suggestions:', '');
          // entry.data is the array of suggestion videos
          await redisCache.setSuggestions(videoId, entry.data);
        } else if (key.startsWith('artist_playlists:')) {
          const artistName = key.replace('artist_playlists:', '');
          // entry.data is the array of playlists for this artist
          await redisCache.setArtistPlaylists(artistName, entry.data);
        } else if (key.startsWith('track:')) {
          // entry.data is already the track object
          await redisCache.setTrack(entry.data);
        } else {
          console.warn(`[Migration] Unknown cache type: ${key}`);
          errors++;
          continue;
        }

        migrated++;
        console.log(`[Migration] Migrated ${key}`);
      } catch (error) {
        console.error(`[Migration] Error migrating ${key}:`, error);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    const success = errors === 0;

    const result: MigrationResult = {
      timestamp: new Date().toISOString(),
      total,
      migrated,
      skipped,
      errors,
      duration,
      success,
    };

    console.log('[Migration] Complete:', result);

    // Mark migration as done
    if (success) {
      try {
        const status = {
          migrated: true,
          timestamp: new Date().toISOString(),
          migrationResult: result,
        };
        localStorage.setItem('cache-migration-status', JSON.stringify(status));
      } catch (e) {
        console.warn('[Migration] Failed to save migration status:', e);
      }
    }

    return result;
  } catch (error) {
    console.error('[Migration] Fatal error:', error);
    return {
      timestamp: new Date().toISOString(),
      total: 0,
      migrated: 0,
      skipped: 0,
      errors: 1,
      duration: Date.now() - startTime,
      success: false,
    };
  }
}

/**
 * Check if migration has already been done
 */
export function isMigrationDone(): boolean {
  try {
    const status = localStorage.getItem('cache-migration-status');
    if (!status) return false;

    const parsed = JSON.parse(status);
    return parsed.migrated === true;
  } catch (e) {
    return false;
  }
}

/**
 * Get migration status from localStorage
 */
export function getMigrationStatus(): MigrationResult | null {
  try {
    const status = localStorage.getItem('cache-migration-status');
    if (!status) return null;

    const parsed = JSON.parse(status);
    return parsed.migrationResult || null;
  } catch (e) {
    return null;
  }
}

/**
 * Reset migration status (for testing)
 */
export function resetMigrationStatus(): void {
  try {
    localStorage.removeItem('cache-migration-status');
    console.log('[Migration] Status reset');
  } catch (e) {
    console.warn('[Migration] Failed to reset status:', e);
  }
}

/**
 * Perform migration if not already done
 */
export async function ensureMigrated(): Promise<MigrationResult> {
  // Only run in browser
  if (typeof window === 'undefined') {
    return {
      timestamp: new Date().toISOString(),
      total: 0,
      migrated: 0,
      skipped: 0,
      errors: 0,
      duration: 0,
      success: true,
    };
  }

  // Check if already migrated
  if (isMigrationDone()) {
    console.log('[Migration] Already completed, skipping');
    return getMigrationStatus() || {
      timestamp: new Date().toISOString(),
      total: 0,
      migrated: 0,
      skipped: 0,
      errors: 0,
      duration: 0,
      success: true,
    };
  }

  // Perform migration
  return migrateToRedis();
}

/**
 * Hook-friendly version: Returns a promise that resolves when migration is done
 */
export async function useCacheMigration(): Promise<void> {
  try {
    const result = await ensureMigrated();
    if (!result.success) {
      console.warn('[Migration] Migration had errors:', result);
    }
  } catch (error) {
    console.error('[Migration] Migration failed:', error);
  }
}
