/**
 * Fonctions pour récupérer des suggestions YouTube (tendances, vidéos populaires, etc.)
 */

import type { Video } from "@/types/music";
import { extractYouTubeVideoId } from "./youtube";

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
  
  return process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || null;
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
      const errorData = await response.json().catch(() => ({}));
      console.error('Erreur API YouTube tendances:', errorData);
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
    const detailsMap = new Map(detailsData.items.map((item: any) => [item.id, item]));

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
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("relatedToVideoId", videoId);
    url.searchParams.set("maxResults", maxResults.toString());
    url.searchParams.set("fields", "items(id(videoId),snippet(title,description,channelTitle,publishedAt,thumbnails))");

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return [];
    }

    return data.items.map((item: any) => {
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
  } catch (error) {
    console.error("Erreur lors de la récupération des vidéos similaires:", error);
    return [];
  }
}

/**
 * Convertit une suggestion YouTube en Video pour Nexus
 */
export function youtubeSuggestionToVideo(suggestion: YouTubeSuggestion): Video {
  const youtubeUrl = `https://www.youtube.com/watch?v=${suggestion.videoId}`;
  
  return {
    id: `youtube-${suggestion.videoId}`,
    title: suggestion.title || 'Vidéo YouTube sans titre',
    filePath: youtubeUrl,
    thumbnailUrl: suggestion.thumbnailUrl || '',
    duration: suggestion.duration || 0,
    mediaSource: 'youtube',
    youtubeVideoId: suggestion.videoId,
    // Métadonnées supplémentaires
    metadata: {
      description: suggestion.description || '',
      channel: suggestion.channelTitle || '',
      viewCount: suggestion.viewCount,
      publishedAt: suggestion.publishedAt || '',
    },
    addedAt: new Date().toISOString(),
    watchProgress: {
      currentTime: 0,
      watched: false,
    },
  };
}
