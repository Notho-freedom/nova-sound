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
    console.log('[useYouTubeSimilarTracks] loadSimilar appelé', {
      trackId: track.id,
      mediaSource: track.mediaSource,
      artist: track.artist,
      youtubeVideoId: track.youtubeVideoId,
    });

    // Seulement pour les tracks YouTube
    if (track.mediaSource !== 'youtube') {
      console.log('[useYouTubeSimilarTracks] Track non-YouTube, retour vide');
      setSimilarTracks([]);
      return;
    }

    // Vérifier qu'on a un artiste pour la recherche
    if (!track.artist || track.artist.trim() === '') {
      console.log('[useYouTubeSimilarTracks] Pas d\'artiste, retour vide');
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
          const envKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
          if (envKey) YouTube.setApiKey(envKey);
        }
      }

      // Rechercher des vidéos de l'artiste via le service unifié
      console.log(`[useYouTubeSimilarTracks] Recherche pour l'artiste: ${track.artist}`);
      
      const result = await YouTube.search(`${track.artist} music`, 20);
      console.log(`[useYouTubeSimilarTracks] ${result.videos.length} vidéos trouvées (source: ${result.source})`);

      // Convertir en tracks
      const tracks = result.videos.map(youtubeVideoToTrack);

      // Exclure le track actuel si possible
      const filteredTracks = track.youtubeVideoId && track.youtubeVideoId !== 'undefined'
        ? tracks.filter(t => t.youtubeVideoId !== track.youtubeVideoId)
        : tracks;

      console.log(`[useYouTubeSimilarTracks] ✅ ${filteredTracks.length} tracks finaux`);
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
