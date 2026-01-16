/**
 * Hook pour charger les tracks YouTube similaires basés sur le track actuel
 * Utilise le service YouTube unifié depuis src/services/youtube/
 */

import { useState, useCallback } from "react";
import type { Track } from "@/types/music";
import { YouTube, type YouTubeVideo } from "@/services/youtube";

interface UseYouTubeSimilarTracksReturn {
  similarTracks: Track[];
  loading: boolean;
  error: string | null;
  loadSimilar: (track: Track) => Promise<void>;
}

/**
 * Convertit une YouTubeVideo en Track
 */
function youtubeVideoToTrack(video: YouTubeVideo): Track {
  return {
    id: `youtube-${video.videoId}`,
    title: video.title,
    artist: video.artist || video.channelTitle,
    album: video.channelTitle,
    duration: video.duration || 0,
    filePath: `https://www.youtube.com/watch?v=${video.videoId}`,
    coverUrl: video.thumbnailUrl,
    mediaSource: 'youtube' as const,
    youtubeVideoId: video.videoId,
  };
}

/**
 * Hook pour charger les tracks YouTube similaires
 * Recherche par artiste via le service YouTube unifié
 */
export function useYouTubeSimilarTracks(): UseYouTubeSimilarTracksReturn {
  const [similarTracks, setSimilarTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSimilar = useCallback(async (track: Track) => {
    // Seulement pour les tracks YouTube
    if (track.mediaSource !== 'youtube') {
      setSimilarTracks([]);
      return;
    }

    // Vérifier qu'on a un artiste pour la recherche
    if (!track.artist || track.artist.trim() === '') {
      setSimilarTracks([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Initialiser la clé API si disponible
      if (typeof window !== 'undefined') {
        const savedKey = localStorage.getItem("nexus-youtube-api-key");
        if (savedKey) {
          YouTube.setApiKey(savedKey);
        } else {
          const envKey = process.env.YOUTUBE_API_KEY;
          if (envKey) YouTube.setApiKey(envKey);
        }
      }

      // Rechercher des vidéos de l'artiste via le service unifié
      const result = await YouTube.search(`${track.artist} music`, 20);

      // Convertir en tracks
      const tracks = result.videos.map(youtubeVideoToTrack);

      // Exclure le track actuel si possible
      const filteredTracks = track.youtubeVideoId && track.youtubeVideoId !== 'undefined'
        ? tracks.filter(t => t.youtubeVideoId !== track.youtubeVideoId)
        : tracks;

      setSimilarTracks(filteredTracks);
    } catch (err) {
      console.error('[useYouTubeSimilarTracks] ❌ Erreur:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      setSimilarTracks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    similarTracks,
    loading,
    error,
    loadSimilar,
  };
}
