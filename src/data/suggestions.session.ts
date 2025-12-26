/**
 * Session de données pour les suggestions YouTube
 * Cache mémoire + calculs lourds mis en cache
 */

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
      // Import dynamique pour éviter de charger si pas nécessaire
      const { generateYouTubeSuggestions } = await import('@/services/youtube-suggestions');
      const suggestions = await generateYouTubeSuggestions();
      
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

