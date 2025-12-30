/**
 * Cache pour les tracks YouTube complets
 * 
 * Three-layer architecture:
 * - L1: Memory (Map in process memory)
 * - L2: localStorage (full Track objects)
 * - L3: Redis (backup/shared, distributed across users)
 * 
 * Permet de préserver les métadonnées YouTube (mediaSource, youtubeVideoId, etc.)
 * même quand le track est ajouté aux favoris ou à l'historique
 */

import type { Track } from "@/types/music";
import { redisCache } from "@/services/redis-cache";

const CACHE_KEY = "nexus-youtube-tracks-cache";
const MAX_CACHE_SIZE = 500; // Limiter la taille du cache

// In-memory fallback for environments without localStorage (tests, SSR)
let inMemoryYouTubeCache: Map<string, Track> | null = null;

interface CachedYouTubeTrack {
  track: Track;
  cachedAt: string;
}

/**
 * Récupère le cache des tracks YouTube (synchrone pour compatibilité)
 * Note: Peut ne pas inclure les données Redis en mode synchrone
 * Pour garantir les données Redis, utilisez getYouTubeTracksCacheAsync()
 */
export function getYouTubeTracksCache(): Map<string, Track> {
  // Use in-memory fallback in environments without window/localStorage
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    if (!inMemoryYouTubeCache) inMemoryYouTubeCache = new Map();
    return inMemoryYouTubeCache;
  }

  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) {
      // If there's an in-memory cache (tests or previous runtime), return it
      if (inMemoryYouTubeCache) return inMemoryYouTubeCache;
      return new Map();
    }
    
    const data: Record<string, CachedYouTubeTrack> = JSON.parse(stored);
    const cache = new Map<string, Track>();
    
    // Convertir en Map et nettoyer les entrées trop anciennes (plus de 30 jours)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    Object.entries(data).forEach(([id, cached]) => {
      const cachedTime = new Date(cached.cachedAt).getTime();
      if (cachedTime > thirtyDaysAgo) {
        cache.set(id, cached.track);
      }
    });
    
    // Sauvegarder le cache nettoyé
    if (cache.size !== Object.keys(data).length) {
      saveYouTubeTracksCache(cache);
    }
    
    return cache;
  } catch (error) {
    console.error('[YouTube Track Cache] Erreur lors du chargement du cache:', error);
    if (inMemoryYouTubeCache) return inMemoryYouTubeCache;
    return new Map();
  }
}

/**
 * Récupère le cache des tracks YouTube (asynchrone avec Redis fallback)
 * Utilise Redis (L3) en cas d'absence dans localStorage
 */
export async function getYouTubeTracksCacheAsync(): Promise<Map<string, Track>> {
  // Use in-memory fallback in environments without window/localStorage
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    if (!inMemoryYouTubeCache) inMemoryYouTubeCache = new Map();
    return inMemoryYouTubeCache;
  }

  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) {
      // If there's an in-memory cache (tests or previous runtime), return it
      if (inMemoryYouTubeCache) return inMemoryYouTubeCache;
      
      // Try Redis as fallback
      try {
        const redisTracks = await redisCache.getTracks([]);
        if (redisTracks.length > 0) {
          const cache = new Map<string, Track>();
          redisTracks.forEach(track => cache.set(track.id, track));
          return cache;
        }
      } catch (e) {
        console.warn('[YouTubeTrackCache] Failed to get from Redis:', e);
      }
      
      return new Map();
    }
    
    const data: Record<string, CachedYouTubeTrack> = JSON.parse(stored);
    const cache = new Map<string, Track>();
    
    // Convertir en Map et nettoyer les entrées trop anciennes (plus de 30 jours)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    Object.entries(data).forEach(([id, cached]) => {
      const cachedTime = new Date(cached.cachedAt).getTime();
      if (cachedTime > thirtyDaysAgo) {
        cache.set(id, cached.track);
      }
    });
    
    // Sauvegarder le cache nettoyé
    if (cache.size !== Object.keys(data).length) {
      saveYouTubeTracksCache(cache);
    }
    
    return cache;
  } catch (error) {
    console.error('[YouTube Track Cache] Erreur lors de la récupération du cache:', error);
    return new Map();
  }
}

/**
 * Sauvegarde le cache des tracks YouTube (localStorage + Redis async)
 */
export function saveYouTubeTracksCache(cache: Map<string, Track>): void {
  // In node/ssr/test env, persist in-memory
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    inMemoryYouTubeCache = new Map(cache);
    // eslint-disable-next-line no-console
    console.debug('[YouTube Track Cache] Saving to inMemory cache keys:', Array.from(inMemoryYouTubeCache.keys()));
    return;
  }
  
  try {
    // Limiter la taille du cache
    const entries = Array.from(cache.entries());
    const limited = entries.slice(0, MAX_CACHE_SIZE);
    
    const data: Record<string, CachedYouTubeTrack> = {};
    limited.forEach(([id, track]) => {
      data[id] = {
        track,
        cachedAt: new Date().toISOString(),
      };
    });
    
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    // Also keep an in-memory mirror for environments where localStorage may not persist during tests
    inMemoryYouTubeCache = new Map(cache);

    // Save to Redis asynchronously (fire-and-forget)
    const tracksArray = limited.map(([, track]) => track);
    redisCache.setTracks(tracksArray).catch(e => {
      console.warn('[YouTube Track Cache] Failed to sync to Redis:', e);
    });

  } catch (error) {
    console.error('[YouTube Track Cache] Erreur lors de la sauvegarde du cache:', error);
  }
}

/**
 * Ajoute ou met à jour un track YouTube dans le cache (localStorage + Redis async)
 */
export function cacheYouTubeTrack(track: Track): void {
  if (track.mediaSource !== 'youtube') return;
  
  const cache = getYouTubeTracksCache();
  cache.set(track.id, track);
  saveYouTubeTracksCache(cache);
  
  // Also save individual track to Redis asynchronously
  redisCache.setTrack(track).catch(e => {
    console.warn('[YouTube Track Cache] Failed to cache individual track to Redis:', e);
  });
}

/**
 * Récupère un track YouTube depuis le cache
 */
export function getCachedYouTubeTrack(trackId: string): Track | null {
  const cache = getYouTubeTracksCache();
  // Direct match by stored key
  const direct = cache.get(trackId);
  if (direct) return direct;

  // Match by youtubeVideoId (common case if favorites store videoId or variant)
  for (const track of cache.values()) {
    if (track.youtubeVideoId === trackId) return track;
  }

  // Sometimes track ids are of the form 'youtube-audio-<videoId>' or 'youtube-<videoId>' or 'yt-track-<id>'
  // Strip known prefixes and try matching the remainder against youtubeVideoId
  let extractedId = trackId;
  if (trackId.startsWith('youtube-audio-')) {
    extractedId = trackId.substring('youtube-audio-'.length);
  } else if (trackId.startsWith('youtube-')) {
    extractedId = trackId.substring('youtube-'.length);
  } else if (trackId.startsWith('yt-track-')) {
    extractedId = trackId.substring('yt-track-'.length);
  }
  
  if (extractedId !== trackId) {
    for (const track of cache.values()) {
      if (track.youtubeVideoId === extractedId) return track;
    }
  }

  // No match
  return null;
}

/**
 * Récupère un track YouTube depuis le cache par videoId (youtubeVideoId)
 */
export function getCachedYouTubeTrackByVideoId(videoId: string): Track | null {
  const cache = getYouTubeTracksCache();
  for (const track of cache.values()) {
    if (track.youtubeVideoId === videoId) return track;
  }
  return null;
}

/**
 * Récupère plusieurs tracks YouTube depuis le cache
 */
export function getCachedYouTubeTracks(trackIds: string[]): Track[] {
  const cache = getYouTubeTracksCache();
  return trackIds
    .map(id => cache.get(id))
    .filter((t): t is Track => t !== null);
}
