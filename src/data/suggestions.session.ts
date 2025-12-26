/**
 * Session de données pour les suggestions YouTube
 * Cache mémoire + calculs lourds mis en cache
 */

import { YouTube } from '@/services/youtube';

interface YouTubeSuggestion {
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  // ... autres champs
}

let cachedSuggestions: YouTubeSuggestion[] | null = null;
let loadPromise: Promise<YouTubeSuggestion[]> | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes (suggestions changent moins souvent)

/**
 * Charge les suggestions avec cache mémoire
 * Les calculs lourds (analyse historique, etc.) sont mis en cache
 */
export async function getYouTubeSuggestions(): Promise<YouTubeSuggestion[]> {
  // Si le cache est valide, le retourner immédiatement
  if (cachedSuggestions !== null && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedSuggestions;
  }

  // Si un chargement est déjà en cours, attendre qu'il se termine
  if (loadPromise) {
    return loadPromise;
  }

  // Démarrer un nouveau chargement (calculs lourds)
  loadPromise = (async () => {
    try {
      // Utiliser le service YouTube unifié pour les suggestions
      const result = await YouTube.search('popular music', 20);
      
      // result est un YouTubeSearchResult, on accède à result.videos
      const videos = Array.isArray(result) ? result : (result as any).videos || [];
      
      const suggestions: YouTubeSuggestion[] = videos.map((video: { videoId: string; title: string; thumbnailUrl?: string }) => ({
        videoId: video.videoId,
        title: video.title,
        thumbnailUrl: video.thumbnailUrl,
      }));
      
      cachedSuggestions = suggestions;
      cacheTimestamp = Date.now();
      loadPromise = null;
      
      return suggestions;
    } catch (error) {
      loadPromise = null;
      throw error;
    }
  })();

  return loadPromise;
}

/**
 * Invalide le cache (après changement d'historique, etc.)
 */
export function invalidateSuggestionsCache(): void {
  cachedSuggestions = null;
  cacheTimestamp = 0;
  loadPromise = null;
}

/**
 * Obtient les suggestions depuis le cache uniquement (sans charger)
 */
export function getCachedSuggestions(): YouTubeSuggestion[] | null {
  if (cachedSuggestions !== null && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedSuggestions;
  }
  return null;
}
