/**
 * Fonctions pour rechercher des vidéos YouTube par artiste/channel
 */

import type { Track } from "@/types/music";
import { youtubeSuggestionToVideo } from "./youtube-suggestions";
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
 * Recherche des vidéos YouTube par nom d'artiste
 */
export async function searchYouTubeByArtist(
  artistName: string,
  maxResults: number = 20
): Promise<YouTubeSuggestion[]> {
  const apiKey = getYouTubeApiKey();
  
  if (!apiKey) {
    console.warn('[YouTube Artist Search] Clé API YouTube non configurée');
    return [];
  }

  try {
    // Rechercher des vidéos avec le nom de l'artiste
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("key", apiKey);
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("q", artistName);
    searchUrl.searchParams.set("maxResults", maxResults.toString());
    searchUrl.searchParams.set("order", "relevance");
    searchUrl.searchParams.set("fields", "items(id(videoId),snippet(title,description,channelTitle,publishedAt,thumbnails))");

    const response = await fetch(searchUrl.toString());
    
    if (!response.ok) {
      const isQuotaError = response.status === 403 || response.status === 429;
      
      if (isQuotaError) {
        console.warn('[YouTube Artist Search] Quota épuisé, fallback cache');
        // Enregistrer l'échec
        try {
          const { youtubeQuotaManager } = await import('@/services/youtube-quota-manager');
          youtubeQuotaManager.recordFailure();
        } catch (error) {
          // Ignorer
        }
        
        // Essayer de trouver dans le cache avec des recherches similaires
        try {
          const { youtubeCacheService } = await import('@/services/youtube-cache');
          // Chercher dans le cache avec le nom de l'artiste
          const cached = await youtubeCacheService.getSearch(artistName);
          if (cached && cached.results.length > 0) {
            console.log(`[YouTube Artist Search] Cache HIT (fallback): ${artistName}`);
            return cached.results.map(v => ({
              videoId: v.videoId,
              title: v.title,
              description: v.description,
              thumbnailUrl: v.thumbnailUrl,
              channelTitle: v.channelTitle,
              publishedAt: v.publishedAt,
              duration: v.duration,
              viewCount: v.viewCount,
            })).slice(0, maxResults);
          }
        } catch (error) {
          // Ignorer
        }
      }
      
      const errorData = await response.json().catch(() => ({}));
      console.error('[YouTube Artist Search] Erreur API:', response.status, errorData);
      return [];
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return [];
    }

    // Récupérer les durées des vidéos
    const videoIds = data.items.map((item: any) => item.id.videoId).join(',');
    const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    detailsUrl.searchParams.set("key", apiKey);
    detailsUrl.searchParams.set("part", "contentDetails,statistics");
    detailsUrl.searchParams.set("id", videoIds);
    detailsUrl.searchParams.set("fields", "items(id,contentDetails(duration),statistics(viewCount))");

    const detailsResponse = await fetch(detailsUrl.toString());
    const detailsData = detailsResponse.ok ? await detailsResponse.json() : { items: [] };
    const detailsMap = new Map<string, { duration?: string; viewCount?: string }>();
    
    if (detailsData.items) {
      detailsData.items.forEach((item: any) => {
        detailsMap.set(item.id, {
          duration: item.contentDetails?.duration,
          viewCount: item.statistics?.viewCount,
        });
      });
    }

    // Convertir en YouTubeSuggestion
    const suggestions: YouTubeSuggestion[] = data.items.map((item: any) => {
      const details = detailsMap.get(item.id.videoId) || {};
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
        videoId: item.id.videoId,
        title: item.snippet?.title || "",
        description: item.snippet?.description || "",
        thumbnailUrl: thumbnails.medium?.url || thumbnails.default?.url || "",
        channelTitle: item.snippet?.channelTitle || "",
        publishedAt: item.snippet?.publishedAt || "",
        duration: parseDuration(details.duration),
        viewCount: details.viewCount ? parseInt(details.viewCount, 10) : undefined,
      };
    });

    return suggestions;
  } catch (error) {
    console.error('[YouTube Artist Search] Erreur lors de la recherche:', error);
    return [];
  }
}

/**
 * Convertit des suggestions YouTube en Tracks pour le système audio
 */
export function youtubeSuggestionsToTracks(suggestions: YouTubeSuggestion[]): Track[] {
  return suggestions.map(suggestion => {
    // Extraire l'artiste et le titre depuis le titre YouTube
    const parseTitle = (title: string, channel?: string): { artist: string; trackTitle: string } => {
      const separators = [' - ', ' – ', ' — ', ' | ', ' • '];
      for (const sep of separators) {
        if (title.includes(sep)) {
          const parts = title.split(sep);
          if (parts.length === 2) {
            return {
              artist: parts[0].trim(),
              trackTitle: parts[1].trim(),
            };
          }
        }
      }
      return {
        artist: channel || 'Artiste inconnu',
        trackTitle: title,
      };
    };

    const { artist, trackTitle } = parseTitle(suggestion.title, suggestion.channelTitle);

    return {
      id: `youtube-audio-${suggestion.videoId}`,
      filePath: `https://www.youtube.com/watch?v=${suggestion.videoId}`,
      title: trackTitle,
      artist: artist,
      album: suggestion.channelTitle || 'YouTube',
      duration: suggestion.duration || 0,
      coverUrl: suggestion.thumbnailUrl || '',
      addedAt: new Date().toISOString(),
      mediaSource: 'youtube',
      youtubeVideoId: suggestion.videoId,
    };
  });
}
