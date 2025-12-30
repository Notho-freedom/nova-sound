/**
 * Fonctions pour récupérer des suggestions YouTube (tendances, vidéos populaires, etc.)
 * Basées sur l'historique de l'utilisateur (audio local et vidéos YouTube)
 */

import type { Video, Track } from "@/types/music";
import { extractYouTubeVideoId } from "./youtube";
import type { HistoryEntry } from "@/hooks/usePlayHistory";

export interface YouTubeSuggestion {
  videoId: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
  channelTitle: string;
  publishedAt: string;
  duration?: number; // en secondes
  viewCount?: number;
}

/**
 * Récupère la clé API YouTube depuis localStorage ou env
 */
function getYouTubeApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  
  // Priorité: localStorage > env
  const fromStorage = localStorage.getItem("nexus-youtube-api-key");
  if (fromStorage) return fromStorage;
  
  return process.env.YOUTUBE_API_KEY || null;
}

/**
 * Récupère les vidéos tendances YouTube
 */
export async function fetchYouTubeTrending(
  maxResults: number = 25,
  regionCode: string = 'FR'
): Promise<YouTubeSuggestion[]> {
  const apiKey = getYouTubeApiKey();
  
  if (!apiKey) {
    console.warn('Clé API YouTube non configurée pour les suggestions');
    return [];
  }

  // Vérifier le circuit breaker AVANT d'appeler l'API
  try {
    const { youtubeQuotaManager } = await import('@/services/youtube-quota-manager');
    if (!youtubeQuotaManager.canUseAPI()) {
      console.warn('[YouTube Suggestions] Quota épuisé pour tendances, retour vide');
      return [];
    }
  } catch (error) {
    // Continuer si le service n'est pas disponible
  }

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("part", "snippet,contentDetails,statistics");
    url.searchParams.set("chart", "mostPopular");
    url.searchParams.set("maxResults", maxResults.toString());
    url.searchParams.set("regionCode", regionCode);
    url.searchParams.set("fields", "items(id,snippet(title,description,channelTitle,publishedAt,thumbnails),contentDetails(duration),statistics(viewCount))");

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const isQuotaError = response.status === 403 || response.status === 429;
      
      if (isQuotaError) {
        // Enregistrer l'échec dans le quota manager
        try {
          const { youtubeQuotaManager } = await import('@/services/youtube-quota-manager');
          youtubeQuotaManager.recordFailure();
        } catch (error) {
          // Ignorer
        }
        
        const errorData = await response.json().catch(() => ({}));
        console.warn('[YouTube Suggestions] Quota épuisé pour tendances, retour vide');
        if (errorData.error?.message) {
          console.warn('[YouTube Suggestions] Message d\'erreur:', errorData.error.message);
        }
        return []; // Retourner vide au lieu de planter
      }
      
      const errorData = await response.json().catch(() => ({}));
      console.error('[YouTube Suggestions] Erreur API tendances:', response.status, errorData);
      if (errorData.error?.message) {
        console.error('[YouTube Suggestions] Message d\'erreur:', errorData.error.message);
      }
      return [];
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return [];
    }

    return data.items.map((item: any) => {
      // Parser la durée ISO 8601
      const durationMatch = item.contentDetails?.duration?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      let duration = 0;
      if (durationMatch) {
        const hours = parseInt(durationMatch[1] || "0", 10);
        const minutes = parseInt(durationMatch[2] || "0", 10);
        const seconds = parseInt(durationMatch[3] || "0", 10);
        duration = hours * 3600 + minutes * 60 + seconds;
      }

      const thumbnails = item.snippet?.thumbnails || {};
      const thumbnailUrl = thumbnails.medium?.url || thumbnails.default?.url || "";

      return {
        videoId: item.id,
        title: item.snippet?.title || "",
        description: item.snippet?.description || "",
        thumbnailUrl,
        channelTitle: item.snippet?.channelTitle || "",
        publishedAt: item.snippet?.publishedAt || "",
        duration,
        viewCount: item.statistics?.viewCount ? parseInt(item.statistics.viewCount, 10) : undefined,
      };
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des tendances YouTube:", error);
    return [];
  }
}

/**
 * Récupère des vidéos YouTube par catégorie
 */
export async function fetchYouTubeByCategory(
  categoryId: string,
  maxResults: number = 25
): Promise<YouTubeSuggestion[]> {
  const apiKey = getYouTubeApiKey();
  
  if (!apiKey) {
    return [];
  }

  try {
    // D'abord, récupérer les vidéos de la catégorie
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("key", apiKey);
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("videoCategoryId", categoryId);
    searchUrl.searchParams.set("maxResults", maxResults.toString());
    searchUrl.searchParams.set("order", "viewCount");
    searchUrl.searchParams.set("fields", "items(id(videoId),snippet(title,description,channelTitle,publishedAt,thumbnails))");

    const searchResponse = await fetch(searchUrl.toString());
    
    if (!searchResponse.ok) {
      return [];
    }

    const searchData = await searchResponse.json();
    
    if (!searchData.items || searchData.items.length === 0) {
      return [];
    }

    // Récupérer les détails complets (durée, vues, etc.)
    const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
    
    const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    detailsUrl.searchParams.set("key", apiKey);
    detailsUrl.searchParams.set("part", "contentDetails,statistics");
    detailsUrl.searchParams.set("id", videoIds);
    detailsUrl.searchParams.set("fields", "items(id,contentDetails(duration),statistics(viewCount))");

    const detailsResponse = await fetch(detailsUrl.toString());
    
    if (!detailsResponse.ok) {
      // Retourner au moins les données de base
      return searchData.items.map((item: any) => {
        const thumbnails = item.snippet?.thumbnails || {};
        return {
          videoId: item.id.videoId,
          title: item.snippet?.title || "",
          description: item.snippet?.description || "",
          thumbnailUrl: thumbnails.medium?.url || thumbnails.default?.url || "",
          channelTitle: item.snippet?.channelTitle || "",
          publishedAt: item.snippet?.publishedAt || "",
        };
      });
    }

    const detailsData = await detailsResponse.json();
    const detailsMap = new Map<string, { contentDetails?: { duration?: string }; statistics?: { viewCount?: string } }>(
      detailsData.items.map((item: any) => [item.id, item])
    );

    return searchData.items.map((item: any) => {
      const details = detailsMap.get(item.id.videoId);
      
      // Parser la durée
      let duration = 0;
      if (details?.contentDetails?.duration) {
        const durationMatch = details.contentDetails.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (durationMatch) {
          const hours = parseInt(durationMatch[1] || "0", 10);
          const minutes = parseInt(durationMatch[2] || "0", 10);
          const seconds = parseInt(durationMatch[3] || "0", 10);
          duration = hours * 3600 + minutes * 60 + seconds;
        }
      }

      const thumbnails = item.snippet?.thumbnails || {};
      return {
        videoId: item.id.videoId,
        title: item.snippet?.title || "",
        description: item.snippet?.description || "",
        thumbnailUrl: thumbnails.medium?.url || thumbnails.default?.url || "",
        channelTitle: item.snippet?.channelTitle || "",
        publishedAt: item.snippet?.publishedAt || "",
        duration,
        viewCount: details?.statistics?.viewCount ? parseInt(details.statistics.viewCount, 10) : undefined,
      };
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des vidéos par catégorie:", error);
    return [];
  }
}

/**
 * Récupère des vidéos similaires à une vidéo YouTube donnée
 * Note: relatedToVideoId est déprécié depuis 2015, on utilise une approche alternative
 */
export async function fetchYouTubeRelated(
  videoId: string,
  maxResults: number = 10
): Promise<YouTubeSuggestion[]> {
  const apiKey = getYouTubeApiKey();
  
  if (!apiKey) {
    return [];
  }

  try {
    // Étape 1: Récupérer les détails de la vidéo pour obtenir le titre, la chaîne, et les tags
    const videoDetailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    videoDetailsUrl.searchParams.set("key", apiKey);
    videoDetailsUrl.searchParams.set("part", "snippet");
    videoDetailsUrl.searchParams.set("id", videoId);
    videoDetailsUrl.searchParams.set("fields", "items(snippet(title,channelTitle,tags))");

    const videoDetailsResponse = await fetch(videoDetailsUrl.toString());
    
    if (!videoDetailsResponse.ok) {
      return [];
    }

    const videoDetailsData = await videoDetailsResponse.json();
    
    if (!videoDetailsData.items || videoDetailsData.items.length === 0) {
      return [];
    }

    const videoSnippet = videoDetailsData.items[0].snippet;
    const channelTitle = videoSnippet.channelTitle || '';
    const tags = videoSnippet.tags || [];
    
    // Étape 2: Utiliser le titre et les tags pour rechercher des vidéos similaires
    // Prendre les 2-3 premiers mots du titre ou les premiers tags
    let searchQuery = '';
    if (tags.length > 0) {
      // Utiliser les premiers tags
      searchQuery = tags.slice(0, 2).join(' ');
    } else if (videoSnippet.title) {
      // Utiliser les premiers mots du titre
      const titleWords = videoSnippet.title.split(' ').slice(0, 3);
      searchQuery = titleWords.join(' ');
    }

    if (!searchQuery) {
      // Fallback: utiliser le nom de la chaîne
      searchQuery = channelTitle;
    }

    if (!searchQuery) {
      return [];
    }

    // Étape 3: Rechercher des vidéos avec cette requête, en excluant la vidéo originale
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("key", apiKey);
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("q", searchQuery);
    searchUrl.searchParams.set("maxResults", (maxResults + 1).toString()); // +1 pour exclure l'original
    searchUrl.searchParams.set("order", "relevance");
    searchUrl.searchParams.set("fields", "items(id(videoId),snippet(title,description,channelTitle,publishedAt,thumbnails))");

    const searchResponse = await fetch(searchUrl.toString());
    
    if (!searchResponse.ok) {
      return [];
    }

    const searchData = await searchResponse.json();

    if (!searchData.items || searchData.items.length === 0) {
      return [];
    }

    // Filtrer la vidéo originale et limiter les résultats
    const relatedVideos = searchData.items
      .filter((item: any) => item.id.videoId !== videoId)
      .slice(0, maxResults)
      .map((item: any) => {
        const thumbnails = item.snippet?.thumbnails || {};
        return {
          videoId: item.id.videoId,
          title: item.snippet?.title || "",
          description: item.snippet?.description || "",
          thumbnailUrl: thumbnails.medium?.url || thumbnails.default?.url || "",
          channelTitle: item.snippet?.channelTitle || "",
          publishedAt: item.snippet?.publishedAt || "",
        };
      });

    return relatedVideos;
  } catch (error) {
    console.error("Erreur lors de la récupération des vidéos similaires:", error);
    return [];
  }
}

/**
 * Génère des suggestions YouTube basées sur l'historique de l'utilisateur
 * Combine l'historique audio local, l'historique vidéo YouTube, et l'historique de recherche
 */
export async function fetchYouTubeSuggestionsFromHistory(
  audioHistory: HistoryEntry[],
  audioTracks: Track[],
  youtubeVideos: Video[],
  searchHistory: string[] = [],
  maxResults: number = 25
): Promise<YouTubeSuggestion[]> {
  const apiKey = getYouTubeApiKey();
  
  if (!apiKey) {
    console.warn('[YouTube Suggestions] Clé API YouTube non configurée');
    return [];
  }

  // Extraire les artistes et genres les plus écoutés de l'historique audio
  const artistCounts = new Map<string, number>();
  const genreCounts = new Map<string, number>();
  const trackTitles = new Set<string>();

  audioHistory.forEach((entry) => {
    const track = audioTracks.find(t => t.id === entry.trackId);
    if (track) {
      // Compter les artistes (pondéré par le nombre de fois écouté)
      const count = artistCounts.get(track.artist) || 0;
      artistCounts.set(track.artist, count + (entry.playCount || 1));
      
      // Compter les genres
      if (track.genre) {
        const genreCount = genreCounts.get(track.genre) || 0;
        genreCounts.set(track.genre, genreCount + (entry.playCount || 1));
      }
      
      // Collecter les titres
      trackTitles.add(track.title);
    }
  });

  // Extraire les vidéos YouTube de l'historique
  const youtubeVideoIds: string[] = [];
  youtubeVideos.forEach((video) => {
    if (video.youtubeVideoId) {
      youtubeVideoIds.push(video.youtubeVideoId);
    }
  });

  // Vérifier le circuit breaker EN PREMIER (avant toute logique de recherche)
  let canUseAPI = true;
  try {
    const { youtubeQuotaManager } = await import('@/services/youtube-quota-manager');
    canUseAPI = youtubeQuotaManager.canUseAPI();
    
    // Si circuit breaker ouvert ET on a des vidéos dans l'historique, retourner directement
    if (!canUseAPI && youtubeVideos.length > 0) {
      console.log(`[YouTube Suggestions] ⚠️ Circuit breaker ouvert - Retour direct de ${youtubeVideos.length} vidéos de l'historique`);
      const historySuggestions: YouTubeSuggestion[] = [];
      const seenIds = new Set<string>();
      
      for (const video of youtubeVideos.slice(0, maxResults)) {
        const videoId = video.youtubeVideoId || extractYouTubeVideoId(video.filePath || '');
        if (!videoId || seenIds.has(videoId)) continue;
        
        seenIds.add(videoId);
        historySuggestions.push({
          videoId,
          title: video.title || `Vidéo YouTube ${videoId}`,
          description: video.description || '',
          thumbnailUrl: video.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/default.jpg`,
          channelTitle: (video as any).channelTitle || video.director || '',
          publishedAt: video.addedAt || video.lastPlayedAt || new Date().toISOString(),
          duration: video.duration,
          viewCount: undefined,
        });
      }
      
      if (historySuggestions.length > 0) {
        console.log(`[YouTube Suggestions] ✅ ${historySuggestions.length} suggestions depuis l'historique (circuit breaker ouvert)`);
        return historySuggestions;
      }
    }
    
    if (!canUseAPI) {
      console.log('[YouTube Suggestions] Circuit breaker ouvert mais pas de vidéos dans l\'historique, retour vide');
      return [];
    }
  } catch (error) {
    // Ignorer si le service n'est pas disponible
  }

  // Créer des requêtes de recherche basées sur les préférences (seulement si API disponible)
  const searchQueries: string[] = [];
  
  // Top 3 artistes les plus écoutés
  const topArtists = Array.from(artistCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([artist]) => artist);
  topArtists.forEach(artist => searchQueries.push(artist));

  // Top 2 genres les plus écoutés
  const topGenres = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([genre]) => genre);
  topGenres.forEach(genre => searchQueries.push(genre));

  // Ajouter les recherches précédentes (priorité aux plus récentes)
  // Prendre les 3 recherches les plus récentes qui ne sont pas déjà dans les queries
  const recentSearches = searchHistory
    .filter(term => {
      const termLower = term.toLowerCase();
      // Exclure les termes qui sont déjà dans les artistes/genres
      return !topArtists.some(a => a.toLowerCase() === termLower) &&
             !topGenres.some(g => g.toLowerCase() === termLower) &&
             term.trim().length > 0;
    })
    .slice(0, 3);
  recentSearches.forEach(search => searchQueries.push(search));

  // Si pas assez de données, utiliser les tendances générales comme fallback
  if (searchQueries.length === 0 && youtubeVideoIds.length === 0) {
    console.log('[YouTube Suggestions] Pas assez d\'historique, utilisation des tendances générales');
    return fetchYouTubeTrending(maxResults);
  }

  // Rechercher des vidéos pour chaque requête
  const allSuggestions: YouTubeSuggestion[] = [];
  const seenVideoIds = new Set<string>();

  // Rechercher basée sur les artistes/genres (en parallèle pour performance maximale)
  const searchPromises = searchQueries.slice(0, 3).map(async (query) => {
    try {
      // Vérifier le cache d'abord (TOUJOURS, même si API disponible)
      const { youtubeCacheService } = await import('@/services/youtube-cache');
      const cached = await youtubeCacheService.getSearch(query);
      if (cached && cached.results.length > 0) {
        console.log(`[YouTube Suggestions] Cache HIT pour: ${query}`);
        return cached.results.map(v => ({
          videoId: v.videoId,
          title: v.title,
          description: v.description,
          thumbnailUrl: v.thumbnailUrl,
          channelTitle: v.channelTitle,
          publishedAt: v.publishedAt,
          duration: v.duration,
          viewCount: v.viewCount,
        }));
      }

      // Si circuit breaker ouvert, ne pas appeler l'API
      if (!canUseAPI) {
        console.log(`[YouTube Suggestions] Circuit breaker ouvert, pas d'appel API pour: ${query}`);
        return [];
      }

      const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
      searchUrl.searchParams.set("key", apiKey);
      searchUrl.searchParams.set("part", "snippet");
      searchUrl.searchParams.set("type", "video");
      searchUrl.searchParams.set("q", query);
      searchUrl.searchParams.set("maxResults", Math.ceil(maxResults / searchQueries.length).toString());
      searchUrl.searchParams.set("order", "relevance");
      searchUrl.searchParams.set("fields", "items(id(videoId),snippet(title,description,channelTitle,publishedAt,thumbnails))");

      const response = await fetch(searchUrl.toString());
      
      // Gérer les erreurs 403/429 (quota épuisé)
      if (!response.ok) {
        const isQuotaError = response.status === 403 || response.status === 429;
        if (isQuotaError) {
          console.warn(`[YouTube Suggestions] Quota épuisé pour recherche: ${query}`);
          // Enregistrer l'échec
          try {
            const { youtubeQuotaManager } = await import('@/services/youtube-quota-manager');
            youtubeQuotaManager.recordFailure();
          } catch (error) {
            // Ignorer
          }
          return []; // Retourner vide au lieu de planter
        }
        console.warn(`[YouTube Suggestions] Erreur API ${response.status} pour: ${query}`);
        return [];
      }
      
      if (response.ok) {
        const data = await response.json();
        if (data.items && data.items.length > 0) {
          // Récupérer les IDs pour batch request
          const videoIds = data.items.map((item: any) => item.id.videoId);
          
          // Utiliser batch service pour récupérer les détails (durée, vues) en une seule requête
          try {
            const { youtubeBatchService } = await import('@/services/youtube-batch');
            const batchVideos = await youtubeBatchService.batchGetVideos(videoIds);
            
            // Mapper les résultats avec les détails complets
            return data.items.map((item: any) => {
              const videoId = item.id.videoId;
              const batchVideo = batchVideos.find((v: any) => v.id === videoId || v.videoId === videoId);
              const thumbnails = item.snippet?.thumbnails || {};
              
              return {
                videoId,
                title: item.snippet?.title || "",
                description: item.snippet?.description || "",
                thumbnailUrl: thumbnails.medium?.url || thumbnails.default?.url || "",
                channelTitle: item.snippet?.channelTitle || "",
                publishedAt: item.snippet?.publishedAt || "",
                duration: batchVideo?.duration || undefined,
                viewCount: batchVideo?.viewCount || undefined,
              };
            });
          } catch (batchError) {
            // Fallback si batch échoue
            console.warn(`[YouTube Suggestions] Batch failed for ${query}, using basic data:`, batchError);
            return data.items.map((item: any) => {
              const videoId = item.id.videoId;
              const thumbnails = item.snippet?.thumbnails || {};
              return {
                videoId,
                title: item.snippet?.title || "",
                description: item.snippet?.description || "",
                thumbnailUrl: thumbnails.medium?.url || thumbnails.default?.url || "",
                channelTitle: item.snippet?.channelTitle || "",
                publishedAt: item.snippet?.publishedAt || "",
              };
            });
          }
        }
      }
      return [];
    } catch (error) {
      console.error(`[YouTube Suggestions] Erreur lors de la recherche pour "${query}":`, error);
      return [];
    }
  });

  // Exécuter toutes les recherches en parallèle pour performance maximale
  const searchResults = await Promise.all(searchPromises);
  
  // Combiner les résultats
  searchResults.flat().forEach((suggestion) => {
    if (!seenVideoIds.has(suggestion.videoId) && !youtubeVideoIds.includes(suggestion.videoId)) {
      seenVideoIds.add(suggestion.videoId);
      allSuggestions.push(suggestion);
    }
  });

  // FALLBACK SECONDAIRE: Si pas assez de résultats même avec API, compléter avec l'historique
  if (canUseAPI && allSuggestions.length < maxResults && youtubeVideos.length > 0) {
    console.log(`[YouTube Suggestions] Complément avec ${youtubeVideos.length} vidéos de l'historique local`);
    
    // Convertir les vidéos YouTube de l'historique en suggestions
    for (const video of youtubeVideos) {
      if (allSuggestions.length >= maxResults) break;
      
      const videoId = video.youtubeVideoId || extractYouTubeVideoId(video.filePath || '');
      if (!videoId || seenVideoIds.has(videoId)) continue;
      
      seenVideoIds.add(videoId);
      allSuggestions.push({
        videoId,
        title: video.title || `Vidéo YouTube ${videoId}`,
        description: video.description || '',
        thumbnailUrl: video.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/default.jpg`,
        channelTitle: (video as any).channelTitle || video.director || '',
        publishedAt: video.addedAt || video.lastPlayedAt || new Date().toISOString(),
        duration: video.duration,
        viewCount: undefined,
      });
    }
  }

  // Si on a des vidéos YouTube dans l'historique, chercher des vidéos similaires (seulement si API disponible)
  if (canUseAPI && youtubeVideoIds.length > 0 && allSuggestions.length < maxResults) {
    const videoIdToUse = youtubeVideoIds[0]; // Utiliser la vidéo la plus récente
    try {
      const related = await fetchYouTubeRelated(videoIdToUse, maxResults - allSuggestions.length);
      related.forEach(suggestion => {
        if (!seenVideoIds.has(suggestion.videoId) && !youtubeVideoIds.includes(suggestion.videoId)) {
          seenVideoIds.add(suggestion.videoId);
          allSuggestions.push(suggestion);
        }
      });
    } catch (error) {
      console.error('[YouTube Suggestions] Erreur lors de la récupération des vidéos similaires:', error);
    }
  }

  // Si on n'a toujours pas assez de suggestions, compléter avec des tendances (seulement si API disponible)
  if (canUseAPI && allSuggestions.length < maxResults) {
    try {
      const trending = await fetchYouTubeTrending(maxResults - allSuggestions.length);
      trending.forEach(suggestion => {
        if (!seenVideoIds.has(suggestion.videoId)) {
          seenVideoIds.add(suggestion.videoId);
          allSuggestions.push(suggestion);
        }
      });
    } catch (error) {
      console.error('[YouTube Suggestions] Erreur lors du complément avec tendances:', error);
    }
  }

  return allSuggestions.slice(0, maxResults);
}

/**
 * Parse la durée ISO 8601 en secondes
 */
function parseDuration(duration?: string): number | undefined {
  if (!duration) return undefined;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return undefined;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Convertit une suggestion YouTube en Video pour Nexus
 */
export function youtubeSuggestionToVideo(suggestion: YouTubeSuggestion): Video {
  const youtubeUrl = `https://www.youtube.com/watch?v=${suggestion.videoId}`;
  
  return {
    id: `youtube-${suggestion.videoId}`,
    title: suggestion.title || 'Vidéo YouTube sans titre',
    description: suggestion.description || '',
    filePath: youtubeUrl,
    thumbnailUrl: suggestion.thumbnailUrl || '',
    duration: suggestion.duration || 0,
    fileSize: 0,
    mediaSource: 'youtube',
    youtubeVideoId: suggestion.videoId,
    addedAt: new Date().toISOString(),
    watchProgress: {
      videoId: suggestion.videoId,
      currentTime: 0,
      duration: suggestion.duration || 0,
      percentage: 0,
      lastWatchedAt: new Date().toISOString(),
      completed: false,
    },
  };
}
