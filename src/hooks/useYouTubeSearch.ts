import { useState, useCallback } from "react";
import { extractYouTubeVideoId, parseYouTubeUrl } from "@/lib/youtube";
import type { Video } from "@/types/music";

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
  channelTitle: string;
  publishedAt: string;
  duration?: string; // Format ISO 8601 (PT4M13S)
  viewCount?: string;
}

interface UseYouTubeSearchReturn {
  results: YouTubeSearchResult[];
  loading: boolean;
  error: string | null;
  search: (query: string) => Promise<void>;
  clearResults: () => void;
  convertToVideo: (result: YouTubeSearchResult) => Video;
}

/**
 * Hook pour rechercher des vidéos YouTube
 * Utilise l'API YouTube Data API v3 si une clé est disponible,
 * sinon utilise une méthode alternative
 */
export function useYouTubeSearch(): UseYouTubeSearchReturn {
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vérifier si une clé API YouTube est disponible
  const getYouTubeApiKey = (): string | null => {
    if (typeof window !== 'undefined') {
      // 1. Vérifier dans localStorage (priorité)
      const savedKey = localStorage.getItem("nexus-youtube-api-key");
      if (savedKey) return savedKey;
      
      // 2. Vérifier dans les variables d'environnement
      const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
      if (apiKey) return apiKey;
    }
    return null;
  };

  // Parse durée ISO 8601
  const parseDuration = (duration?: string): number | undefined => {
    if (!duration) return undefined;
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return undefined;
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  };

  // Recherche via YouTube Data API v3 (si clé disponible)
  // Utilise le cache multi-niveaux pour économiser le quota
  const searchWithApi = useCallback(async (query: string, apiKey: string) => {
    // 1. Vérifier le cache d'abord
    try {
      const { youtubeCacheService } = await import('@/services/youtube-cache');
      const cached = await youtubeCacheService.getSearch(query);
      
      if (cached && cached.results.length > 0) {
        console.log(`[useYouTubeSearch] Cache HIT pour: ${query}`);
        // Convertir en YouTubeSearchResult
        const results: YouTubeSearchResult[] = cached.results.map(v => ({
          videoId: v.videoId,
          title: v.title,
          description: v.description,
          thumbnailUrl: v.thumbnailUrl,
          channelTitle: v.channelTitle,
          publishedAt: v.publishedAt,
          duration: v.duration ? `PT${Math.floor(v.duration / 3600)}H${Math.floor((v.duration % 3600) / 60)}M${v.duration % 60}S` : undefined,
          viewCount: v.viewCount?.toString(),
        }));
        return results;
      }
    } catch (error) {
      console.warn('[useYouTubeSearch] Erreur cache:', error);
    }

    // 2. Vérifier le quota
    try {
      const { youtubeQuotaManager } = await import('@/services/youtube-quota-manager');
      if (!youtubeQuotaManager.canSearch()) {
        throw new Error(youtubeQuotaManager.getUXMessage() || "Quota de recherche épuisé pour aujourd'hui");
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Quota')) {
        throw error;
      }
      console.warn('[useYouTubeSearch] Erreur quota manager:', error);
    }
    
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?` +
        `part=snippet&` +
        `q=${encodeURIComponent(query)}&` +
        `type=video&` +
        `maxResults=20&` +
        `key=${apiKey}`
      );

      if (!response.ok) {
        // Détecter les erreurs de quota/403
        const isQuotaError = response.status === 403 || response.status === 429;
        
        if (isQuotaError) {
          // Enregistrer l'échec dans le quota manager
          try {
            const { youtubeQuotaManager } = await import('@/services/youtube-quota-manager');
            youtubeQuotaManager.recordFailure();
          } catch (error) {
            console.warn('[useYouTubeSearch] Erreur quota manager:', error);
          }
          
          // Lancer une erreur spéciale pour déclencher le fallback
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error?.message || 'Quota API YouTube épuisé';
          throw new Error(`QUOTA_ERROR:${errorMessage}`);
        }
        
        throw new Error(`Erreur API: ${response.status}`);
      }
      
      // Enregistrer le succès
      try {
        const { youtubeQuotaManager } = await import('@/services/youtube-quota-manager');
        youtubeQuotaManager.recordSuccess();
      } catch (error) {
        // Ignorer les erreurs silencieuses
      }

      const data = await response.json();
      
      // Récupérer les détails des vidéos (durée, vues, likes)
      const videoIds = data.items.map((item: any) => item.id.videoId).join(',');
      const detailsResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?` +
        `part=contentDetails,statistics&` +
        `id=${videoIds}&` +
        `key=${apiKey}`
      );

      const detailsData = await detailsResponse.json();
      const detailsMap = new Map<string, { 
        contentDetails?: { duration?: string }; 
        statistics?: { viewCount?: string; likeCount?: string } 
      }>(
        detailsData.items.map((item: any) => [item.id, item])
      );

      const searchResults: YouTubeSearchResult[] = data.items.map((item: any) => {
        const details = detailsMap.get(item.id.videoId);
        return {
          videoId: item.id.videoId,
          title: item.snippet.title,
          description: item.snippet.description,
          thumbnailUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default.url,
          channelTitle: item.snippet.channelTitle,
          publishedAt: item.snippet.publishedAt,
          duration: details?.contentDetails?.duration,
          viewCount: details?.statistics?.viewCount,
        };
      });

      // 3. Mettre en cache les résultats de recherche (sans les propriétés de cache, le service les ajoute)
      try {
        const { youtubeCacheService } = await import('@/services/youtube-cache');
        
        // Convertir les résultats en format pour setSearch (qui prend des videos partielles)
        // Récupérer likeCount depuis detailsData si disponible
        const videosForCache = searchResults.map(result => {
          const details = detailsMap.get(result.videoId);
          const likeCount = details?.statistics?.likeCount 
            ? parseInt(details.statistics.likeCount) 
            : undefined;
          
          // Construire l'objet sans undefined (sera filtré par removeUndefinedFields dans le cache)
          const video: any = {
            id: result.videoId,
            videoId: result.videoId,
            title: result.title,
            description: result.description,
            channelTitle: result.channelTitle,
            channelId: '', // Pas disponible dans search
            publishedAt: result.publishedAt,
            duration: result.duration ? parseDuration(result.duration) : undefined,
            viewCount: result.viewCount ? parseInt(result.viewCount) : undefined,
            likeCount: likeCount, // Peut être undefined
            thumbnailUrl: result.thumbnailUrl,
            thumbnailHighUrl: result.thumbnailUrl,
          };
          
          // Supprimer les undefined avant de retourner (le cache le fera aussi, mais c'est mieux ici)
          const cleaned: any = {};
          for (const [key, value] of Object.entries(video)) {
            if (value !== undefined) {
              cleaned[key] = value;
            }
          }
          return cleaned;
        });
        
        // setSearch accepte des vidéos partielles et ajoute les métadonnées de cache
        await youtubeCacheService.setSearch(query, videosForCache as any);
        
        // Consommer le quota (100 unités pour search.list)
        const { youtubeQuotaManager } = await import('@/services/youtube-quota-manager');
        youtubeQuotaManager.consumeSearch();
      } catch (error) {
        console.warn('[useYouTubeSearch] Erreur mise en cache:', error);
      }

      return searchResults;
    } catch (err: any) {
      console.error('Erreur recherche YouTube API:', err);
      
      // Si c'est une erreur de quota, lancer une erreur spéciale pour le fallback
      if (err.message && err.message.startsWith('QUOTA_ERROR:')) {
        throw err; // Relancer pour déclencher le fallback
      }
      
      throw err;
    }
  }, []);

  /**
   * Fallback intelligent : recherche dans l'historique et cache
   */
  const searchWithFallback = useCallback(async (query: string): Promise<YouTubeSearchResult[]> => {
    console.log(`[useYouTubeSearch] 🔄 Fallback activé pour: ${query}`);
    
    const results: YouTubeSearchResult[] = [];
    
    // 1. Chercher dans l'historique de recherche (recherches similaires)
    try {
      if (typeof window !== 'undefined') {
        const searchHistory = JSON.parse(localStorage.getItem('nexus-search-history') || '[]') as string[];
        const queryLower = query.toLowerCase();
        
        // Trouver des recherches similaires dans l'historique
        const similarSearches = searchHistory.filter(h => 
          h.toLowerCase().includes(queryLower) || queryLower.includes(h.toLowerCase())
        ).slice(0, 3);
        
        // Pour chaque recherche similaire, récupérer le cache
        for (const similarQuery of similarSearches) {
          try {
            const { youtubeCacheService } = await import('@/services/youtube-cache');
            const cached = await youtubeCacheService.getSearch(similarQuery);
            
            if (cached && cached.results.length > 0) {
              // Filtrer les résultats qui correspondent à la query actuelle
              const matchingResults = cached.results
                .filter(v => 
                  v.title.toLowerCase().includes(queryLower) ||
                  v.channelTitle.toLowerCase().includes(queryLower)
                )
                .map(v => ({
                  videoId: v.videoId,
                  title: v.title,
                  description: v.description,
                  thumbnailUrl: v.thumbnailUrl,
                  channelTitle: v.channelTitle,
                  publishedAt: v.publishedAt,
                  duration: v.duration ? `PT${Math.floor(v.duration / 3600)}H${Math.floor((v.duration % 3600) / 60)}M${v.duration % 60}S` : undefined,
                  viewCount: v.viewCount?.toString(),
                }));
              
              results.push(...matchingResults);
            }
          } catch (error) {
            console.warn(`[useYouTubeSearch] Erreur cache pour "${similarQuery}":`, error);
          }
        }
      }
    } catch (error) {
      console.warn('[useYouTubeSearch] Erreur fallback historique:', error);
    }
    
    // 2. Si pas assez de résultats, chercher dans tous les caches (recherches récentes)
    if (results.length < 5) {
      try {
        const { youtubeCacheService } = await import('@/services/youtube-cache');
        // On ne peut pas lister tous les caches facilement, donc on utilise l'historique
        // et on récupère les résultats les plus récents
        if (typeof window !== 'undefined') {
          const searchHistory = JSON.parse(localStorage.getItem('nexus-search-history') || '[]') as string[];
          const recentSearches = searchHistory.slice(0, 10); // 10 recherches les plus récentes
          
          for (const recentQuery of recentSearches) {
            if (results.length >= 20) break; // Limiter à 20 résultats
            
            try {
              const { youtubeCacheService } = await import('@/services/youtube-cache');
              const cached = await youtubeCacheService.getSearch(recentQuery);
              
              if (cached && cached.results.length > 0) {
                const queryLower = query.toLowerCase();
                const matchingResults = cached.results
                  .filter(v => 
                    !results.some(r => r.videoId === v.videoId) && // Éviter doublons
                    (v.title.toLowerCase().includes(queryLower) ||
                     v.channelTitle.toLowerCase().includes(queryLower) ||
                     v.description?.toLowerCase().includes(queryLower))
                  )
                  .slice(0, 5) // Max 5 par recherche
                  .map(v => ({
                    videoId: v.videoId,
                    title: v.title,
                    description: v.description,
                    thumbnailUrl: v.thumbnailUrl,
                    channelTitle: v.channelTitle,
                    publishedAt: v.publishedAt,
                    duration: v.duration ? `PT${Math.floor(v.duration / 3600)}H${Math.floor((v.duration % 3600) / 60)}M${v.duration % 60}S` : undefined,
                    viewCount: v.viewCount?.toString(),
                  }));
                
                results.push(...matchingResults);
              }
            } catch (error) {
              // Ignorer les erreurs individuelles
            }
          }
        }
      } catch (error) {
        console.warn('[useYouTubeSearch] Erreur fallback cache étendu:', error);
      }
    }
    
    // Dédupliquer par videoId
    const uniqueResults = Array.from(
      new Map(results.map(r => [r.videoId, r])).values()
    );
    
    console.log(`[useYouTubeSearch] ✅ Fallback: ${uniqueResults.length} résultats trouvés`);
    return uniqueResults.slice(0, 20); // Limiter à 20
  }, []);

  // Recherche alternative (sans clé API) - non disponible pour des raisons de conformité
  const searchWithoutApi = useCallback(async (query: string) => {
    // Pour des raisons de conformité avec les ToS YouTube, nous ne pouvons pas
    // scraper YouTube sans utiliser l'API officielle.
    // L'utilisateur doit fournir une clé API YouTube Data v3.
    throw new Error(
      'Clé API YouTube requise.\n\n' +
      'Pour rechercher sur YouTube, vous devez configurer une clé API YouTube Data v3.\n\n' +
      '1. Allez sur https://console.cloud.google.com/apis/credentials\n' +
      '2. Créez un projet (ou utilisez un existant)\n' +
      '3. Activez l\'API YouTube Data v3\n' +
      '4. Créez une clé API\n' +
      '5. Ajoutez-la dans les paramètres de Nexus (variable d\'environnement NEXT_PUBLIC_YOUTUBE_API_KEY)\n\n' +
      'Note: L\'utilisation de l\'API YouTube est gratuite jusqu\'à 10 000 unités/jour.'
    );
  }, []);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiKey = getYouTubeApiKey();
      let searchResults: YouTubeSearchResult[] = [];
      let usedFallback = false;

      if (apiKey) {
        try {
          // Utiliser l'API officielle
          searchResults = await searchWithApi(query, apiKey);
        } catch (err: any) {
          // Si erreur de quota (403/429), utiliser le fallback
          if (err.message && err.message.startsWith('QUOTA_ERROR:')) {
            console.log('[useYouTubeSearch] ⚠️ Quota épuisé, activation fallback');
            const { youtubeQuotaManager } = await import('@/services/youtube-quota-manager');
            const uxMessage = youtubeQuotaManager.getUXMessage();
            
            // Essayer le fallback
            try {
              searchResults = await searchWithFallback(query);
              usedFallback = true;
              
              // Afficher un message informatif mais pas d'erreur bloquante
              if (searchResults.length > 0) {
                setError(uxMessage || 'Résultats depuis le cache (quota API épuisé)');
              } else {
                setError(uxMessage || 'Aucun résultat en cache. Réessayez demain ou configurez une nouvelle clé API.');
              }
            } catch (fallbackError) {
              // Si le fallback échoue aussi, afficher l'erreur
              setError(uxMessage || 'Quota API YouTube épuisé. Réessayez demain.');
              searchResults = [];
            }
          } else {
            // Autre erreur (non-quota)
            throw err;
          }
        }
      } else {
        // Pas de clé API, essayer le fallback quand même
        try {
          searchResults = await searchWithFallback(query);
          usedFallback = true;
          
          if (searchResults.length === 0) {
            setError(
              'Pour rechercher sur YouTube, veuillez ajouter une clé API YouTube Data v3 dans les paramètres.\n' +
              'Obtenez votre clé sur: https://console.cloud.google.com/apis/credentials'
            );
          } else {
            setError('Résultats depuis le cache (clé API non configurée)');
          }
        } catch (fallbackError) {
          // Si l'alternative échoue, suggérer d'ajouter une clé API
          setError(
            'Pour rechercher sur YouTube, veuillez ajouter une clé API YouTube Data v3 dans les paramètres.\n' +
            'Obtenez votre clé sur: https://console.cloud.google.com/apis/credentials'
          );
        }
      }

      setResults(searchResults);
      
      // Si on a utilisé le fallback et qu'on a des résultats, c'est un succès partiel
      if (usedFallback && searchResults.length > 0) {
        console.log(`[useYouTubeSearch] ✅ Fallback réussi: ${searchResults.length} résultats`);
      }
    } catch (err: any) {
      console.error('[useYouTubeSearch] Erreur recherche:', err);
      setError(err.message || 'Erreur lors de la recherche YouTube');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchWithApi, searchWithoutApi, searchWithFallback]);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  // Convertir un résultat de recherche en Video
  const convertToVideo = useCallback((result: YouTubeSearchResult): Video => {
    // Convertir la durée ISO 8601 en secondes
    const parseDuration = (duration?: string): number => {
      if (!duration) return 0;
      // Format: PT4M13S (4 minutes 13 secondes)
      const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!match) return 0;
      const hours = parseInt(match[1] || '0', 10);
      const minutes = parseInt(match[2] || '0', 10);
      const seconds = parseInt(match[3] || '0', 10);
      return hours * 3600 + minutes * 60 + seconds;
    };

    return {
      id: `youtube-${result.videoId}`,
      filePath: `https://www.youtube.com/watch?v=${result.videoId}`,
      title: result.title,
      description: result.description,
      duration: parseDuration(result.duration),
      thumbnailUrl: result.thumbnailUrl,
      posterUrl: result.thumbnailUrl,
      fileSize: 0,
      addedAt: new Date().toISOString(),
      mediaSource: 'youtube',
      youtubeVideoId: result.videoId,
      type: 'music_video',
    };
  }, []);

  return {
    results,
    loading,
    error,
    search,
    clearResults,
    convertToVideo,
  };
}
