/**
 * Fonctions pour récupérer les playlists YouTube d'une chaîne
 */

import type { Track } from "@/types/music";
import { youtubeSuggestionsToTracks } from "./youtube-artist-search";
import type { YouTubeSuggestion } from "./youtube-suggestions";

/**
 * Récupère la clé API YouTube depuis localStorage ou env
 */
function getYouTubeApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  
  const fromStorage = localStorage.getItem("nexus-youtube-api-key");
  if (fromStorage) return fromStorage;
  
  return process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || null;
}

/**
 * Récupère l'ID de chaîne YouTube depuis un track
 * Retourne l'ID de chaîne si le track est un profil YouTube
 * Peut aussi retourner le nom d'artiste si on veut rechercher la chaîne par nom
 */
export function getChannelIdFromTrack(track: Track): { channelId: string | null; searchByArtist?: string } | null {
  console.log('[getChannelIdFromTrack] Analyse du track', {
    id: track.id,
    mediaSource: track.mediaSource,
    filePath: track.filePath,
    artist: track.artist,
    youtubeVideoId: track.youtubeVideoId,
  });

  if (track.mediaSource !== 'youtube' || !track.filePath) {
    console.log('[getChannelIdFromTrack] Track non-YouTube ou pas de filePath');
    return null;
  }
  
  // Importer dynamiquement pour éviter les dépendances circulaires
  const { extractYouTubeChannelId, extractYouTubeVideoId } = require('./youtube');
  
  // Si c'est une URL de chaîne (pas de vidéo)
  const channelId = extractYouTubeChannelId(track.filePath);
  const videoId = extractYouTubeVideoId(track.filePath);
  
  console.log('[getChannelIdFromTrack] Extraction', {
    channelId,
    videoId,
    isChannel: !!channelId && !videoId,
    youtubeVideoId: track.youtubeVideoId,
  });
  
  // Cas 1: URL de chaîne directe (profil YouTube)
  if (channelId && !videoId) {
    console.log(`[getChannelIdFromTrack] ✅ Profil YouTube détecté (URL): ${channelId}`);
    return { channelId };
  }
  
  // Cas 2: youtubeVideoId est undefined ou invalide, mais filePath ressemble à une URL de chaîne
  // Vérifier si le filePath contient des patterns de chaîne (notamment @username)
  if (!track.youtubeVideoId || track.youtubeVideoId === 'undefined' || track.youtubeVideoId.trim() === '') {
    // Si l'URL ressemble à une chaîne mais qu'on n'a pas pu extraire le channelId
    // Peut-être que c'est un profil stocké différemment
    if (track.filePath.includes('/channel/') || track.filePath.includes('/@') || track.filePath.includes('/c/') || track.filePath.includes('/user/')) {
      console.log('[getChannelIdFromTrack] ⚠️ URL ressemble à une chaîne mais channelId non extrait, tentative extraction');
      
      // Réessayer l'extraction (peut-être que extractYouTubeChannelId n'a pas fonctionné la première fois)
      const retryChannelId = extractYouTubeChannelId(track.filePath);
      if (retryChannelId) {
        console.log(`[getChannelIdFromTrack] ✅ ChannelId extrait au second essai: ${retryChannelId}`);
        return { channelId: retryChannelId };
      }
      
      // Si toujours pas de channelId, essayer de rechercher par nom d'artiste
      if (track.artist) {
        console.log(`[getChannelIdFromTrack] Recherche par nom d'artiste: ${track.artist}`);
        return { channelId: null, searchByArtist: track.artist };
      }
    }
    console.log('[getChannelIdFromTrack] Track avec youtubeVideoId undefined, pas un profil détectable');
    return null;
  }
  
  // Cas 3: Vérifier si la durée est nulle (0 ou très proche de 0) - indicateur d'un profil
  // Les profils YouTube ont généralement une durée de 0
  if (track.duration === 0 || (track.duration && track.duration < 1)) {
    // Vérifier si l'URL ressemble à une chaîne
    if (track.filePath && (track.filePath.includes('/channel/') || track.filePath.includes('/@') || track.filePath.includes('/c/') || track.filePath.includes('/user/'))) {
      const retryChannelId = extractYouTubeChannelId(track.filePath);
      if (retryChannelId) {
        console.log(`[getChannelIdFromTrack] ✅ Profil YouTube détecté (durée nulle + URL chaîne): ${retryChannelId}`);
        return { channelId: retryChannelId };
      }
      // Si pas de channelId mais durée nulle et URL de chaîne, rechercher par artiste
      if (track.artist) {
        console.log(`[getChannelIdFromTrack] Profil probable (durée nulle), recherche par artiste: ${track.artist}`);
        return { channelId: null, searchByArtist: track.artist };
      }
    }
  }
  
  // Cas 3: C'est une vidéo valide, mais on peut quand même chercher la chaîne par artiste
  // si l'utilisateur veut charger les playlists de l'artiste
  // Pour l'instant, on retourne null pour les vidéos normales
  console.log('[getChannelIdFromTrack] Track est une vidéo normale, pas un profil');
  return null;
}

/**
 * Récupère les playlists publiques d'une chaîne YouTube
 */
export async function fetchYouTubeChannelPlaylists(
  channelId: string,
  maxResults: number = 50
): Promise<YouTubeSuggestion[]> {
  const apiKey = getYouTubeApiKey();
  
  if (!apiKey) {
    console.warn('[YouTube Playlists] Clé API YouTube non configurée');
    return [];
  }

  // Vérifier le circuit breaker AVANT tout appel API
  try {
    const { youtubeQuotaManager } = await import('@/services/youtube-quota-manager');
    if (!youtubeQuotaManager.canUseAPI() || !youtubeQuotaManager.canSearch()) {
      console.log('[YouTube Playlists] Circuit breaker ouvert ou quota recherche épuisé, retour vide');
      return [];
    }
  } catch (error) {
    // Continuer si le service n'est pas disponible
  }

  try {
    // Si channelId commence par @, on doit d'abord récupérer l'ID de chaîne réel
    let actualChannelId = channelId;
    
    if (channelId.startsWith('@')) {
      // Rechercher la chaîne par nom d'utilisateur
      const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
      searchUrl.searchParams.set("key", apiKey);
      searchUrl.searchParams.set("part", "snippet");
      searchUrl.searchParams.set("type", "channel");
      searchUrl.searchParams.set("q", channelId);
      searchUrl.searchParams.set("maxResults", "1");
      
      const searchResponse = await fetch(searchUrl.toString());
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.items && searchData.items.length > 0) {
          actualChannelId = searchData.items[0].id.channelId;
        } else {
          console.warn(`[YouTube Playlists] Chaîne non trouvée: ${channelId}`);
          return [];
        }
      } else {
        console.warn(`[YouTube Playlists] Erreur recherche chaîne: ${searchResponse.status}`);
        return [];
      }
    } else if (channelId.startsWith('c/') || channelId.startsWith('user/')) {
      // Pour les anciens formats, on ne peut pas les convertir directement
      // On retourne un tableau vide pour l'instant
      console.warn(`[YouTube Playlists] Format de chaîne non supporté: ${channelId}`);
      return [];
    }
    
    // Récupérer les playlists de la chaîne
    const playlistsUrl = new URL("https://www.googleapis.com/youtube/v3/playlists");
    playlistsUrl.searchParams.set("key", apiKey);
    playlistsUrl.searchParams.set("part", "snippet,contentDetails");
    playlistsUrl.searchParams.set("channelId", actualChannelId);
    playlistsUrl.searchParams.set("maxResults", maxResults.toString());
    playlistsUrl.searchParams.set("fields", "items(id,snippet(title,description,publishedAt,thumbnails,channelTitle),contentDetails(itemCount))");

    const response = await fetch(playlistsUrl.toString());
    
    if (!response.ok) {
      const isQuotaError = response.status === 403 || response.status === 429;
      
      if (isQuotaError) {
        console.warn('[YouTube Playlists] Quota épuisé');
        try {
          const { youtubeQuotaManager } = await import('@/services/youtube-quota-manager');
          youtubeQuotaManager.recordFailure();
        } catch (error) {
          // Ignorer
        }
      }
      
      const errorData = await response.json().catch(() => ({}));
      console.error('[YouTube Playlists] Erreur API:', response.status, errorData);
      return [];
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      console.log(`[fetchYouTubeChannelPlaylists] Aucune playlist trouvée pour ${actualChannelId}`);
      return [];
    }

    console.log(`[fetchYouTubeChannelPlaylists] ✅ ${data.items.length} playlists trouvées`);

    // Convertir les playlists en YouTubeSuggestion
    const suggestions: YouTubeSuggestion[] = data.items.map((item: any) => {
      const thumbnails = item.snippet?.thumbnails || {};
      
      return {
        videoId: item.id, // Utiliser l'ID de playlist comme videoId pour la compatibilité
        title: item.snippet?.title || "",
        description: item.snippet?.description || "",
        thumbnailUrl: thumbnails.medium?.url || thumbnails.default?.url || "",
        channelTitle: item.snippet?.channelTitle || "",
        publishedAt: item.snippet?.publishedAt || "",
        duration: 0, // Les playlists n'ont pas de durée
        viewCount: item.contentDetails?.itemCount ? parseInt(item.contentDetails.itemCount, 10) : undefined,
      };
    });

    console.log(`[fetchYouTubeChannelPlaylists] ✅ ${suggestions.length} suggestions créées`);
    return suggestions;
  } catch (error) {
    console.error('[fetchYouTubeChannelPlaylists] ❌ Erreur lors de la récupération:', error);
    return [];
  }
}

/**
 * Récupère les vidéos d'une playlist YouTube
 */
export async function fetchYouTubePlaylistVideos(
  playlistId: string,
  maxResults: number = 50
): Promise<YouTubeSuggestion[]> {
  const apiKey = getYouTubeApiKey();
  
  if (!apiKey) {
    console.warn('[YouTube Playlists] Clé API YouTube non configurée');
    return [];
  }

  // Vérifier le circuit breaker AVANT tout appel API
  try {
    const { youtubeQuotaManager } = await import('@/services/youtube-quota-manager');
    if (!youtubeQuotaManager.canUseAPI()) {
      console.log('[YouTube Playlists] Circuit breaker ouvert, retour vide');
      return [];
    }
  } catch (error) {
    // Continuer si le service n'est pas disponible
  }

  try {
    // Récupérer les vidéos de la playlist
    const playlistItemsUrl = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    playlistItemsUrl.searchParams.set("key", apiKey);
    playlistItemsUrl.searchParams.set("part", "snippet,contentDetails");
    playlistItemsUrl.searchParams.set("playlistId", playlistId);
    playlistItemsUrl.searchParams.set("maxResults", maxResults.toString());
    playlistItemsUrl.searchParams.set("fields", "items(snippet(title,description,publishedAt,thumbnails,channelTitle),contentDetails(videoId))");

    const response = await fetch(playlistItemsUrl.toString());
    
    if (!response.ok) {
      const isQuotaError = response.status === 403 || response.status === 429;
      
      if (isQuotaError) {
        console.warn('[YouTube Playlists] Quota épuisé');
        try {
          const { youtubeQuotaManager } = await import('@/services/youtube-quota-manager');
          youtubeQuotaManager.recordFailure();
        } catch (error) {
          // Ignorer
        }
      }
      
      const errorData = await response.json().catch(() => ({}));
      console.error('[YouTube Playlists] Erreur API:', response.status, errorData);
      return [];
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      console.log(`[fetchYouTubePlaylistVideos] Aucune vidéo trouvée dans la playlist ${playlistId}`);
      return [];
    }

    console.log(`[fetchYouTubePlaylistVideos] ${data.items.length} items trouvés dans la playlist`);

    // Récupérer les détails des vidéos (durée, vues)
    const videoIds = data.items.map((item: any) => item.contentDetails?.videoId).filter(Boolean).join(',');
    
    if (!videoIds) {
      console.warn(`[fetchYouTubePlaylistVideos] Aucun videoId valide trouvé`);
      return [];
    }
    
    console.log(`[fetchYouTubePlaylistVideos] Récupération détails pour ${videoIds.split(',').length} vidéos`);
    
    const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    videosUrl.searchParams.set("key", apiKey);
    videosUrl.searchParams.set("part", "contentDetails,statistics");
    videosUrl.searchParams.set("id", videoIds);
    videosUrl.searchParams.set("fields", "items(id,contentDetails(duration),statistics(viewCount))");

    const videosResponse = await fetch(videosUrl.toString());
    const videosData = videosResponse.ok ? await videosResponse.json() : { items: [] };
    const videosMap = new Map<string, { duration?: string; viewCount?: string }>();
    
    if (videosData.items) {
      videosData.items.forEach((item: any) => {
        videosMap.set(item.id, {
          duration: item.contentDetails?.duration,
          viewCount: item.statistics?.viewCount,
        });
      });
    }

    // Convertir en YouTubeSuggestion et filtrer les items sans videoId valide
    const suggestions: YouTubeSuggestion[] = data.items
      .filter((item: any) => {
        const videoId = item.contentDetails?.videoId;
        return videoId && videoId !== 'undefined' && videoId.trim() !== '';
      })
      .map((item: any) => {
        const videoId = item.contentDetails?.videoId;
        const videoDetails = videosMap.get(videoId) || {};
        const thumbnails = item.snippet?.thumbnails || {};
        
        // Parser la durée ISO 8601 en secondes
        const parseDuration = (duration?: string): number => {
          if (!duration) return 0;
          const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
          if (!match) return 0;
          const hours = parseInt(match[1] || '0', 10);
          const minutes = parseInt(match[2] || '0', 10);
          const seconds = parseInt(match[3] || '0', 10);
          return hours * 3600 + minutes * 60 + seconds;
        };

        return {
          videoId: videoId || '',
          title: item.snippet?.title || "",
          description: item.snippet?.description || "",
          thumbnailUrl: thumbnails.medium?.url || thumbnails.default?.url || "",
          channelTitle: item.snippet?.channelTitle || "",
          publishedAt: item.snippet?.publishedAt || "",
          duration: parseDuration(videoDetails.duration),
          viewCount: videoDetails.viewCount ? parseInt(videoDetails.viewCount, 10) : undefined,
        };
      });

    console.log(`[fetchYouTubePlaylistVideos] ✅ ${suggestions.length} suggestions créées pour la playlist ${playlistId}`);
    return suggestions;
  } catch (error) {
    console.error('[fetchYouTubePlaylistVideos] ❌ Erreur lors de la récupération des vidéos:', error);
    return [];
  }
}

/**
 * Recherche des playlists YouTube par requête
 */
export async function searchYouTubePlaylists(
  query: string,
  maxResults: number = 20
): Promise<YouTubeSuggestion[]> {
  const apiKey = getYouTubeApiKey();
  
  if (!apiKey) {
    console.warn('[YouTube Playlists] Clé API YouTube non configurée');
    return [];
  }

  // Vérifier le circuit breaker AVANT tout appel API
  try {
    const { youtubeQuotaManager } = await import('@/services/youtube-quota-manager');
    if (!youtubeQuotaManager.canUseAPI() || !youtubeQuotaManager.canSearch()) {
      console.log('[YouTube Playlists] Circuit breaker ouvert ou quota recherche épuisé, retour vide');
      return [];
    }
  } catch (error) {
    // Continuer si le service n'est pas disponible
  }

  try {
    // Rechercher des playlists
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("key", apiKey);
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "playlist");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("maxResults", maxResults.toString());
    searchUrl.searchParams.set("fields", "items(id(playlistId),snippet(title,description,publishedAt,thumbnails,channelTitle))");

    const response = await fetch(searchUrl.toString());
    
    if (!response.ok) {
      const isQuotaError = response.status === 403 || response.status === 429;
      
      if (isQuotaError) {
        console.warn('[YouTube Playlists] Quota épuisé');
        try {
          const { youtubeQuotaManager } = await import('@/services/youtube-quota-manager');
          youtubeQuotaManager.recordFailure();
        } catch (error) {
          // Ignorer
        }
      }
      
      const errorData = await response.json().catch(() => ({}));
      console.error('[YouTube Playlists] Erreur API:', response.status, errorData);
      return [];
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      console.log(`[searchYouTubePlaylists] Aucune playlist trouvée pour "${query}"`);
      return [];
    }

    console.log(`[searchYouTubePlaylists] ✅ ${data.items.length} playlists trouvées`);

    // Récupérer les détails des playlists (nombre de vidéos)
    const playlistIds = data.items.map((item: any) => item.id.playlistId).join(',');
    const playlistsUrl = new URL("https://www.googleapis.com/youtube/v3/playlists");
    playlistsUrl.searchParams.set("key", apiKey);
    playlistsUrl.searchParams.set("part", "contentDetails");
    playlistsUrl.searchParams.set("id", playlistIds);
    playlistsUrl.searchParams.set("fields", "items(id,contentDetails(itemCount))");

    const playlistsResponse = await fetch(playlistsUrl.toString());
    const playlistsData = playlistsResponse.ok ? await playlistsResponse.json() : { items: [] };
    const playlistsMap = new Map<string, number>();
    
    if (playlistsData.items) {
      playlistsData.items.forEach((item: any) => {
        playlistsMap.set(item.id, item.contentDetails?.itemCount ? parseInt(item.contentDetails.itemCount, 10) : 0);
      });
    }

    // Convertir en YouTubeSuggestion
    const suggestions: YouTubeSuggestion[] = data.items.map((item: any) => {
      const thumbnails = item.snippet?.thumbnails || {};
      const playlistId = item.id?.playlistId || '';
      
      return {
        videoId: playlistId, // Utiliser l'ID de playlist comme videoId pour la compatibilité
        title: item.snippet?.title || "",
        description: item.snippet?.description || "",
        thumbnailUrl: thumbnails.medium?.url || thumbnails.default?.url || "",
        channelTitle: item.snippet?.channelTitle || "",
        publishedAt: item.snippet?.publishedAt || "",
        duration: 0, // Les playlists n'ont pas de durée
        viewCount: playlistsMap.get(playlistId)?.toString(),
      };
    });

    console.log(`[searchYouTubePlaylists] ✅ ${suggestions.length} suggestions créées`);
    return suggestions;
  } catch (error) {
    console.error('[searchYouTubePlaylists] ❌ Erreur lors de la recherche:', error);
    return [];
  }
}