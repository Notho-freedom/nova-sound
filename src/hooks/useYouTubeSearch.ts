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

  // Recherche via YouTube Data API v3 (si clé disponible)
  const searchWithApi = useCallback(async (query: string, apiKey: string) => {
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
        throw new Error(`Erreur API: ${response.status}`);
      }

      const data = await response.json();
      
      // Récupérer les détails des vidéos (durée, vues)
      const videoIds = data.items.map((item: any) => item.id.videoId).join(',');
      const detailsResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?` +
        `part=contentDetails,statistics&` +
        `id=${videoIds}&` +
        `key=${apiKey}`
      );

      const detailsData = await detailsResponse.json();
      const detailsMap = new Map(
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

      return searchResults;
    } catch (err) {
      console.error('Erreur recherche YouTube API:', err);
      throw err;
    }
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
      let searchResults: YouTubeSearchResult[];

      if (apiKey) {
        // Utiliser l'API officielle
        searchResults = await searchWithApi(query, apiKey);
      } else {
        // Essayer la méthode alternative
        try {
          searchResults = await searchWithoutApi(query);
        } catch (altError) {
          // Si l'alternative échoue, suggérer d'ajouter une clé API
          throw new Error(
            'Pour rechercher sur YouTube, veuillez ajouter une clé API YouTube Data v3 dans les paramètres.\n' +
            'Obtenez votre clé sur: https://console.cloud.google.com/apis/credentials'
          );
        }
      }

      setResults(searchResults);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la recherche YouTube');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchWithApi, searchWithoutApi]);

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
