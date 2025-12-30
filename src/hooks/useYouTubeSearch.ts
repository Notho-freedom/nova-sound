/**
 * Hook pour rechercher des vidéos YouTube
 * Utilise le service YouTube unifié depuis src/services/youtube/
 */

import { useState, useCallback } from "react";
import { YouTube, type YouTubeVideo } from "@/services/youtube";
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
 * Convertit une YouTubeVideo du service unifié en YouTubeSearchResult
 */
function videoToSearchResult(video: YouTubeVideo): YouTubeSearchResult {
  // Convertir la durée en format ISO 8601
  const formatDurationISO = (seconds?: number): string | undefined => {
    if (!seconds) return undefined;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `PT${hours > 0 ? hours + 'H' : ''}${minutes}M${secs}S`;
  };

  return {
    videoId: video.videoId,
    title: video.title,
    description: video.description,
    thumbnailUrl: video.thumbnailUrl,
    channelTitle: video.channelTitle,
    publishedAt: video.publishedAt || new Date().toISOString(),
    duration: formatDurationISO(video.duration),
    viewCount: video.viewCount?.toString(),
  };
}

/**
 * Parse durée ISO 8601 en secondes
 */
function parseDurationISO(duration?: string): number {
  if (!duration) return 0;
  if (typeof duration === 'number') return duration;
  
  const match = String(duration).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Hook pour rechercher des vidéos YouTube
 * Utilise le service YouTube unifié avec cache et fallback automatiques
 */
export function useYouTubeSearch(): UseYouTubeSearchReturn {
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialiser la clé API si disponible
  const initApiKey = useCallback(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem("nexus-youtube-api-key");
      if (savedKey) {
        YouTube.setApiKey(savedKey);
        return;
      }
      
      const envKey = process.env.YOUTUBE_API_KEY;
      if (envKey) {
        YouTube.setApiKey(envKey);
      }
    }
  }, []);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Initialiser la clé API
      initApiKey();

      // Utiliser le service unifié
      const result = await YouTube.search(query, 20);
      
      // Convertir les résultats
      const searchResults = result.videos.map(videoToSearchResult);
      setResults(searchResults);

      // Vérifier si on a utilisé le cache et le signaler
      if (result.fromCache && result.source === 'cache') {
        const quotaStatus = YouTube.getQuotaStatus();
        if (quotaStatus.exhausted) {
          setError('Résultats depuis le cache (quota API épuisé)');
        }
      }
    } catch (err: any) {
      console.error('[useYouTubeSearch] Erreur recherche:', err);
      setError(err.message || 'Erreur lors de la recherche YouTube');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [initApiKey]);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  const convertToVideo = useCallback((result: YouTubeSearchResult): Video => {
    return {
      id: `youtube-${result.videoId}`,
      filePath: `https://www.youtube.com/watch?v=${result.videoId}`,
      title: result.title,
      description: result.description,
      duration: parseDurationISO(result.duration),
      thumbnailUrl: result.thumbnailUrl,
      posterUrl: result.thumbnailUrl,
      channelTitle: result.channelTitle,
      fileSize: 0,
      addedAt: new Date().toISOString(),
      mediaSource: 'youtube' as const,
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
