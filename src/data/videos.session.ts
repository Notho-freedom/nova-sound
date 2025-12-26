/**
 * Session de données pour les vidéos
 * Cache mémoire + promesse partagée pour éviter les rechargements multiples
 */

import type { Video } from "@/types/music";

let cachedVideos: Video[] | null = null;
let loadPromise: Promise<Video[]> | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Charge les vidéos avec cache mémoire
 * Retourne immédiatement si le cache est valide
 * Partage la promesse si un chargement est déjà en cours
 */
export async function getVideos(): Promise<Video[]> {
  // Si le cache est valide, le retourner immédiatement
  if (cachedVideos !== null && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedVideos;
  }

  // Si un chargement est déjà en cours, attendre qu'il se termine
  if (loadPromise) {
    return loadPromise;
  }

  // Démarrer un nouveau chargement
  const isElectron = typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';
  if (!isElectron || !window.electronAPI) {
    return [];
  }

  loadPromise = window.electronAPI.getVideos().then((videos) => {
    cachedVideos = videos || [];
    cacheTimestamp = Date.now();
    loadPromise = null;
    return cachedVideos;
  }).catch((err) => {
    loadPromise = null;
    throw err;
  });

  return loadPromise;
}

/**
 * Invalide le cache (après scan, ajout, etc.)
 */
export function invalidateVideosCache(): void {
  cachedVideos = null;
  cacheTimestamp = 0;
  loadPromise = null;
}

/**
 * Met à jour le cache avec de nouvelles vidéos
 */
export function updateVideosCache(videos: Video[]): void {
  cachedVideos = videos;
  cacheTimestamp = Date.now();
}

/**
 * Obtient les vidéos depuis le cache uniquement (sans charger)
 */
export function getCachedVideos(): Video[] | null {
  if (cachedVideos !== null && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedVideos;
  }
  return null;
}

