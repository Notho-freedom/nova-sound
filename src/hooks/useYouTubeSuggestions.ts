/**
 * Hook pour gérer les suggestions YouTube
 */

import { useState, useEffect, useCallback } from "react";
import { fetchYouTubeTrending, fetchYouTubeByCategory, fetchYouTubeRelated, youtubeSuggestionToVideo } from "@/lib/youtube-suggestions";
import type { Video } from "@/types/music";
import { extractYouTubeVideoId } from "@/lib/youtube";

export interface UseYouTubeSuggestionsReturn {
  trendingVideos: Video[];
  loadingTrending: boolean;
  errorTrending: string | null;
  loadTrending: () => Promise<void>;
  loadByCategory: (categoryId: string) => Promise<Video[]>;
  loadRelated: (videoId: string) => Promise<Video[]>;
}

/**
 * Hook pour récupérer et gérer les suggestions YouTube
 */
export function useYouTubeSuggestions(): UseYouTubeSuggestionsReturn {
  const [trendingVideos, setTrendingVideos] = useState<Video[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const [errorTrending, setErrorTrending] = useState<string | null>(null);

  const loadTrending = useCallback(async () => {
    setLoadingTrending(true);
    setErrorTrending(null);
    
    try {
      const suggestions = await fetchYouTubeTrending(25);
      const videos = suggestions.map(youtubeSuggestionToVideo);
      setTrendingVideos(videos);
    } catch (error) {
      console.error('Erreur lors du chargement des tendances:', error);
      setErrorTrending(error instanceof Error ? error.message : 'Erreur inconnue');
    } finally {
      setLoadingTrending(false);
    }
  }, []);

  const loadByCategory = useCallback(async (categoryId: string): Promise<Video[]> => {
    try {
      const suggestions = await fetchYouTubeByCategory(categoryId, 25);
      return suggestions.map(youtubeSuggestionToVideo);
    } catch (error) {
      console.error('Erreur lors du chargement par catégorie:', error);
      return [];
    }
  }, []);

  const loadRelated = useCallback(async (videoIdOrUrl: string): Promise<Video[]> => {
    try {
      // Extraire l'ID vidéo si c'est une URL
      const videoId = extractYouTubeVideoId(videoIdOrUrl) || videoIdOrUrl;
      const suggestions = await fetchYouTubeRelated(videoId, 10);
      return suggestions.map(youtubeSuggestionToVideo);
    } catch (error) {
      console.error('Erreur lors du chargement des vidéos similaires:', error);
      return [];
    }
  }, []);

  return {
    trendingVideos,
    loadingTrending,
    errorTrending,
    loadTrending,
    loadByCategory,
    loadRelated,
  };
}
