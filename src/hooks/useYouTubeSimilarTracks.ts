/**
 * Hook pour charger les tracks YouTube similaires basés sur le track actuel
 */

import { useState, useEffect, useCallback } from "react";
import type { Track } from "@/types/music";
import { searchYouTubeByArtist, youtubeSuggestionsToTracks } from "@/lib/youtube-artist-search";

interface UseYouTubeSimilarTracksReturn {
  similarTracks: Track[];
  loading: boolean;
  error: string | null;
  loadSimilar: (track: Track) => Promise<void>;
}

/**
 * Hook pour charger les tracks YouTube similaires
 * Se met à jour automatiquement quand le track change
 */
export function useYouTubeSimilarTracks(): UseYouTubeSimilarTracksReturn {
  const [similarTracks, setSimilarTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSimilar = useCallback(async (track: Track) => {
    // Seulement pour les tracks YouTube
    if (track.mediaSource !== 'youtube' || !track.artist) {
      setSimilarTracks([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const suggestions = await searchYouTubeByArtist(track.artist, 20);
      // Exclure le track actuel
      const filtered = suggestions.filter(s => s.videoId !== track.youtubeVideoId);
      const tracks = youtubeSuggestionsToTracks(filtered);
      setSimilarTracks(tracks);
    } catch (err) {
      console.error('[useYouTubeSimilarTracks] Erreur:', err);
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
