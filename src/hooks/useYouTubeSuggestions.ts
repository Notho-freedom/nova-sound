/**
 * Hook pour gérer les suggestions YouTube
 * Basé sur l'historique de l'utilisateur (audio local et vidéos YouTube)
 */

import { useState, useEffect, useCallback } from "react";
import { fetchYouTubeTrending, fetchYouTubeByCategory, fetchYouTubeRelated, fetchYouTubeSuggestionsFromHistory, youtubeSuggestionToVideo } from "@/lib/youtube-suggestions";
import type { Video, Track } from "@/types/music";
import { extractYouTubeVideoId } from "@/lib/youtube";
import type { HistoryEntry } from "./usePlayHistory";

export interface UseYouTubeSuggestionsReturn {
  trendingVideos: Video[];
  loadingTrending: boolean;
  errorTrending: string | null;
  loadTrending: () => Promise<void>;
  loadTrendingFromHistory: (audioHistory: HistoryEntry[], audioTracks: Track[], youtubeVideos: Video[]) => Promise<void>;
  loadByCategory: (categoryId: string) => Promise<Video[]>;
  loadRelated: (videoId: string) => Promise<Video[]>;
}

/**
 * Hook pour récupérer et gérer les suggestions YouTube
 * Les suggestions sont basées sur l'historique de l'utilisateur
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

  /**
   * Charge les suggestions basées sur l'historique de l'utilisateur
   */
  const loadTrendingFromHistory = useCallback(async (
    audioHistory: HistoryEntry[],
    audioTracks: Track[],
    youtubeVideos: Video[]
  ) => {
    setLoadingTrending(true);
    setErrorTrending(null);
    
    try {
      console.log('[YouTube Suggestions] Chargement basé sur l\'historique:', {
        audioHistoryCount: audioHistory.length,
        audioTracksCount: audioTracks.length,
        youtubeVideosCount: youtubeVideos.length,
      });
      
      const suggestions = await fetchYouTubeSuggestionsFromHistory(
        audioHistory,
        audioTracks,
        youtubeVideos,
        25
      );
      const videos = suggestions.map(youtubeSuggestionToVideo);
      setTrendingVideos(videos);
      
      console.log('[YouTube Suggestions] Suggestions générées:', videos.length);
    } catch (error) {
      console.error('[YouTube Suggestions] Erreur lors du chargement basé sur l\'historique:', error);
      setErrorTrending(error instanceof Error ? error.message : 'Erreur inconnue');
      
      // Fallback vers les tendances générales en cas d'erreur
      try {
        const fallbackSuggestions = await fetchYouTubeTrending(25);
        const fallbackVideos = fallbackSuggestions.map(youtubeSuggestionToVideo);
        setTrendingVideos(fallbackVideos);
      } catch (fallbackError) {
        console.error('[YouTube Suggestions] Erreur lors du fallback:', fallbackError);
      }
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
    loadTrendingFromHistory,
    loadByCategory,
    loadRelated,
  };
}
