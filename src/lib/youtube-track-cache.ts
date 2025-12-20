/**
 * Cache pour les tracks YouTube complets
 * Permet de préserver les métadonnées YouTube (mediaSource, youtubeVideoId, etc.)
 * même quand le track est ajouté aux favoris ou à l'historique
 */

import type { Track } from "@/types/music";

const CACHE_KEY = "nexus-youtube-tracks-cache";
const MAX_CACHE_SIZE = 500; // Limiter la taille du cache

interface CachedYouTubeTrack {
  track: Track;
  cachedAt: string;
}

/**
 * Récupère le cache des tracks YouTube
 */
export function getYouTubeTracksCache(): Map<string, Track> {
  if (typeof window === 'undefined') return new Map();
  
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) return new Map();
    
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
 * Sauvegarde le cache des tracks YouTube
 */
export function saveYouTubeTracksCache(cache: Map<string, Track>): void {
  if (typeof window === 'undefined') return;
  
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
  } catch (error) {
    console.error('[YouTube Track Cache] Erreur lors de la sauvegarde du cache:', error);
  }
}

/**
 * Ajoute ou met à jour un track YouTube dans le cache
 */
export function cacheYouTubeTrack(track: Track): void {
  if (track.mediaSource !== 'youtube') return;
  
  const cache = getYouTubeTracksCache();
  cache.set(track.id, track);
  saveYouTubeTracksCache(cache);
}

/**
 * Récupère un track YouTube depuis le cache
 */
export function getCachedYouTubeTrack(trackId: string): Track | null {
  const cache = getYouTubeTracksCache();
  return cache.get(trackId) || null;
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
