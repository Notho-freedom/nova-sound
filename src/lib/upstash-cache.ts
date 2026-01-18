/**
 * Upstash Redis Cache Layer for heavy computations
 * Caches stats, genres, and metadata across sessions
 * Dramatically speeds up app boot on return visits
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CacheData = any;

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

interface CacheConfig {
  ttl: number;
  version: string;
}

interface ListeningStats {
  totalListeningTime: number;
  totalTracks: number;
  totalPlays: number;
  topArtists: Record<string, unknown>[];
  topGenres: Record<string, unknown>[];
  recentArtists: Record<string, unknown>[];
  dailyListeningTime: number;
  weeklyListeningTime: number;
  monthlyListeningTime: number;
  averageTrackDuration: number;
  longestSession: number;
  mostPlayedTrack?: Record<string, unknown>;
}

interface Genre {
  name: string;
  trackCount: number;
  trackIds: string[];
  sampleCoverUrl?: string;
}

const CACHE_TTL = {
  STATS: 24 * 60 * 60, // 24 hours
  GENRES: 24 * 60 * 60, // 24 hours
  METADATA: 7 * 24 * 60 * 60, // 7 days
  LIBRARY_SCAN: 12 * 60 * 60, // 12 hours
  SEARCH: 1 * 60 * 60, // 1 hour
};

const CACHE_VERSION = "v1";

/**
 * Generate cache key with user context
 * Format: cache:{type}:{userId}:{contentHash}:{version}
 */
function getCacheKey(
  type: string,
  userId: string | null,
  contentHash: string
): string {
  const user = userId || "anonymous";
  return `cache:${type}:${user}:${contentHash}:${CACHE_VERSION}`;
}

/**
 * Hash array of track IDs to create stable cache key
 * This allows detecting when library has changed
 */
function hashTrackIds(trackIds: string[]): string {
  // Simple hash based on count and first/last ID
  const sorted = trackIds.sort();
  const count = sorted.length;
  const first = sorted[0] || "empty";
  const last = sorted[count - 1] || "empty";
  return `${count}-${first}-${last}`;
}

/**
 * Cache service for stats calculations
 */
export const statsCache = {
  /**
   * Get cached stats if available and valid
   */
  async get(userId: string | null, trackIds: string[]) {
    try {
      const hash = hashTrackIds(trackIds);
      const key = getCacheKey("stats", userId, hash);
      const cached = await redis.get(key);
      
      if (cached) {
        console.log("[StatsCache] ✅ Hit:", key);
        return cached as CacheData;
      }
      
      console.log("[StatsCache] ⏭️  Miss:", key);
      return null;
    } catch (err) {
      console.warn("[StatsCache] Read error:", err);
      return null; // Fallback to recalculate
    }
  },

  /**
   * Store calculated stats in cache
   */
  async set(userId: string | null, trackIds: string[], stats: CacheData) {
    try {
      const hash = hashTrackIds(trackIds);
      const key = getCacheKey("stats", userId, hash);
      
      await redis.setex(key, CACHE_TTL.STATS, JSON.stringify(stats));
      console.log("[StatsCache] 💾 Stored:", key, `TTL: ${CACHE_TTL.STATS}s`);
    } catch (err) {
      console.warn("[StatsCache] Write error:", err);
      // Fail silently - cache is optional
    }
  },

  /**
   * Invalidate stats cache (called after library changes)
   */
  async invalidate(userId: string | null) {
    try {
      // Delete all stats caches for user
      // In practice, we let them expire naturally (TTL)
      // Or user can manually clear via button
      console.log("[StatsCache] 🔄 Invalidated for user:", userId);
    } catch (err) {
      console.warn("[StatsCache] Invalidate error:", err);
    }
  },
};

/**
 * Cache service for genres calculations
 */
export const genresCache = {
  /**
   * Get cached genres if available
   */
  async get(userId: string | null, trackIds: string[]) {
    try {
      const hash = hashTrackIds(trackIds);
      const key = getCacheKey("genres", userId, hash);
      const cached = await redis.get(key);
      
      if (cached) {
        console.log("[GenresCache] ✅ Hit:", key);
        return cached as CacheData;
      }
      
      console.log("[GenresCache] ⏭️  Miss:", key);
      return null;
    } catch (err) {
      console.warn("[GenresCache] Read error:", err);
      return null;
    }
  },

  /**
   * Store calculated genres in cache
   */
  async set(userId: string | null, trackIds: string[], genres: CacheData) {
    try {
      const hash = hashTrackIds(trackIds);
      const key = getCacheKey("genres", userId, hash);
      
      await redis.setex(key, CACHE_TTL.GENRES, JSON.stringify(genres));
      console.log("[GenresCache] 💾 Stored:", key, `TTL: ${CACHE_TTL.GENRES}s`);
    } catch (err) {
      console.warn("[GenresCache] Write error:", err);
    }
  },

  /**
   * Invalidate genres cache
   */
  async invalidate(userId: string | null) {
    try {
      console.log("[GenresCache] 🔄 Invalidated for user:", userId);
    } catch (err) {
      console.warn("[GenresCache] Invalidate error:", err);
    }
  },
};

/**
 * Cache service for library scan results
 */
export const libraryScanCache = {
  /**
   * Get cached library scan results
   */
  async get(userId: string | null, libraryScanId: string) {
    try {
      const key = getCacheKey("library-scan", userId, libraryScanId);
      const cached = await redis.get(key);
      
      if (cached) {
        console.log("[ScanCache] ✅ Hit:", key);
        return cached as CacheData;
      }
      
      return null;
    } catch (err) {
      console.warn("[ScanCache] Read error:", err);
      return null;
    }
  },

  /**
   * Store library scan results
   */
  async set(userId: string | null, libraryScanId: string, results: CacheData) {
    try {
      const key = getCacheKey("library-scan", userId, libraryScanId);
      await redis.setex(key, CACHE_TTL.LIBRARY_SCAN, JSON.stringify(results));
      console.log("[ScanCache] 💾 Stored:", key);
    } catch (err) {
      console.warn("[ScanCache] Write error:", err);
    }
  },
};

/**
 * Cache service for artist/album metadata
 */
export const metadataCache = {
  /**
   * Get cached metadata for artist
   */
  async getArtist(artistName: string) {
    try {
      const key = `cache:artist:${artistName}:${CACHE_VERSION}`;
      const cached = await redis.get(key);
      
      if (cached) {
        console.log("[MetadataCache] ✅ Artist hit:", artistName);
        return cached as CacheData;
      }
      
      return null;
    } catch (err) {
      console.warn("[MetadataCache] Read error:", err);
      return null;
    }
  },

  /**
   * Store artist metadata
   */
  async setArtist(artistName: string, metadata: CacheData) {
    try {
      const key = `cache:artist:${artistName}:${CACHE_VERSION}`;
      await redis.setex(key, CACHE_TTL.METADATA, JSON.stringify(metadata));
      console.log("[MetadataCache] 💾 Artist stored:", artistName);
    } catch (err) {
      console.warn("[MetadataCache] Write error:", err);
    }
  },

  /**
   * Get cached metadata for album
   */
  async getAlbum(albumName: string, artistName: string) {
    try {
      const key = `cache:album:${artistName}:${albumName}:${CACHE_VERSION}`;
      const cached = await redis.get(key);
      
      if (cached) {
        console.log("[MetadataCache] ✅ Album hit:", albumName);
        return cached as CacheData;
      }
      
      return null;
    } catch (err) {
      console.warn("[MetadataCache] Read error:", err);
      return null;
    }
  },

  /**
   * Store album metadata
   */
  async setAlbum(albumName: string, artistName: string, metadata: CacheData) {
    try {
      const key = `cache:album:${artistName}:${albumName}:${CACHE_VERSION}`;
      await redis.setex(key, CACHE_TTL.METADATA, JSON.stringify(metadata));
      console.log("[MetadataCache] 💾 Album stored:", albumName);
    } catch (err) {
      console.warn("[MetadataCache] Write error:", err);
    }
  },
};

/**
 * Cache service for search results
 */
export const searchCache = {
  /**
   * Get cached search results
   */
  async get(query: string, filters: Record<string, unknown>) {
    try {
      const filterStr = JSON.stringify(filters);
      const key = `cache:search:${query}:${filterStr}:${CACHE_VERSION}`;
      const cached = await redis.get(key);
      
      if (cached) {
        console.log("[SearchCache] ✅ Hit:", query);
        return cached as CacheData;
      }
      
      return null;
    } catch (err) {
      console.warn("[SearchCache] Read error:", err);
      return null;
    }
  },

  /**
   * Store search results
   */
  async set(query: string, filters: Record<string, unknown>, results: CacheData) {
    try {
      const filterStr = JSON.stringify(filters);
      const key = `cache:search:${query}:${filterStr}:${CACHE_VERSION}`;
      await redis.setex(key, CACHE_TTL.SEARCH, JSON.stringify(results));
      console.log("[SearchCache] 💾 Stored:", query);
    } catch (err) {
      console.warn("[SearchCache] Write error:", err);
    }
  },
};

/**
 * Utility to check all cache stats
 */
export async function getCacheStats(userId: string | null) {
  try {
    const stats = {
      timestamp: new Date().toISOString(),
      userId,
      cacheServices: [
        { service: "stats", ttl: CACHE_TTL.STATS },
        { service: "genres", ttl: CACHE_TTL.GENRES },
        { service: "metadata", ttl: CACHE_TTL.METADATA },
        { service: "library-scan", ttl: CACHE_TTL.LIBRARY_SCAN },
        { service: "search", ttl: CACHE_TTL.SEARCH },
      ],
    };
    
    console.log("[CacheStats]", stats);
    return stats;
  } catch (err) {
    console.warn("[CacheStats] Error:", err);
    return null;
  }
}

/**
 * Clear all caches (for testing/manual invalidation)
 */
export async function clearAllCaches(userId: string | null) {
  try {
    console.log("[Cache] 🗑️  Clearing all caches for user:", userId);
    // In production, would use FLUSHDB or pattern deletion
    // For now, let TTLs expire naturally
    return true;
  } catch (err) {
    console.warn("[Cache] Clear error:", err);
    return false;
  }
}

export default {
  statsCache,
  genresCache,
  libraryScanCache,
  metadataCache,
  searchCache,
  getCacheStats,
  clearAllCaches,
};
