/**
 * Hook pour charger les playlists YouTube d'un artiste
 * Utilise le service YouTube unifié avec mise en cache
 */

import { useState, useEffect, useCallback } from "react";
import { YouTube, type YouTubePlaylist, type YouTubeVideo, youtubeVideoToTrack } from "@/services/youtube";
import type { Track } from "@/types/music";

interface UseArtistPlaylistsOptions {
  artistName: string;
  enabled?: boolean;
  maxPlaylists?: number;
}

interface UseArtistPlaylistsReturn {
  playlists: YouTubePlaylist[];
  loading: boolean;
  error: string | null;
  loadPlaylistVideos: (playlistId: string) => Promise<Track[]>;
  loadingPlaylistId: string | null;
  refresh: () => Promise<void>;
}

export function useArtistPlaylists({
  artistName,
  enabled = true,
  maxPlaylists = 10,
}: UseArtistPlaylistsOptions): UseArtistPlaylistsReturn {
  const [playlists, setPlaylists] = useState<YouTubePlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPlaylistId, setLoadingPlaylistId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialiser la clé API
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem("nexus-youtube-api-key");
      if (savedKey) {
        YouTube.setApiKey(savedKey);
      } else {
        const envKey = process.env.YOUTUBE_API_KEY;
        if (envKey) YouTube.setApiKey(envKey);
      }
    }
  }, []);

  // Charger les playlists de l'artiste
  const loadPlaylists = useCallback(async (forceRefresh = false) => {
    if (!artistName?.trim() || !enabled) return;

    setLoading(true);
    setError(null);

    try {
      console.log(`[useArtistPlaylists] Chargement des playlists pour: ${artistName}`);
      
      const result = await YouTube.searchArtistPlaylists(artistName, {
        forceRefresh,
        maxResults: maxPlaylists,
      });

      console.log(`[useArtistPlaylists] ${result.playlists.length} playlists trouvées (source: ${result.source})`);
      setPlaylists(result.playlists);
    } catch (err) {
      console.error('[useArtistPlaylists] Erreur:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  }, [artistName, enabled, maxPlaylists]);

  // Charger au montage et quand l'artiste change
  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  // Charger les vidéos d'une playlist et les convertir en tracks
  const loadPlaylistVideos = useCallback(async (playlistId: string): Promise<Track[]> => {
    if (!playlistId) return [];

    setLoadingPlaylistId(playlistId);

    try {
      console.log(`[useArtistPlaylists] Chargement des vidéos de la playlist: ${playlistId}`);
      
      const videos = await YouTube.getPlaylistVideos(playlistId);
      
      console.log(`[useArtistPlaylists] ${videos.length} vidéos chargées`);
      
      // Convertir en tracks
      const tracks: Track[] = videos.map((video: YouTubeVideo) => youtubeVideoToTrack(video));
      
      return tracks;
    } catch (err) {
      console.error('[useArtistPlaylists] Erreur chargement vidéos playlist:', err);
      return [];
    } finally {
      setLoadingPlaylistId(null);
    }
  }, []);

  // Fonction de rafraîchissement manuel
  const refresh = useCallback(async () => {
    await loadPlaylists(true);
  }, [loadPlaylists]);

  return {
    playlists,
    loading,
    error,
    loadPlaylistVideos,
    loadingPlaylistId,
    refresh,
  };
}
