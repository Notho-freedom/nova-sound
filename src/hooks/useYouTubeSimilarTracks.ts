/**
 * Hook pour charger les tracks YouTube similaires basés sur le track actuel
 * Détecte si le track est un profil YouTube et charge ses playlists
 */

import { useState, useEffect, useCallback } from "react";
import type { Track } from "@/types/music";
import { searchYouTubeByArtist, youtubeSuggestionsToTracks } from "@/lib/youtube-artist-search";
import { getChannelIdFromTrack, fetchYouTubeChannelPlaylists, fetchYouTubePlaylistVideos } from "@/lib/youtube-playlists";
import { isYouTubeChannelUrl } from "@/lib/youtube";

interface UseYouTubeSimilarTracksReturn {
  similarTracks: Track[];
  loading: boolean;
  error: string | null;
  loadSimilar: (track: Track) => Promise<void>;
}

/**
 * Hook pour charger les tracks YouTube similaires
 * Se met à jour automatiquement quand le track change
 * Si le track est un profil YouTube, charge ses playlists
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
      filePath: track.filePath,
      youtubeVideoId: track.youtubeVideoId,
    });

    // Seulement pour les tracks YouTube
    if (track.mediaSource !== 'youtube') {
      console.log('[useYouTubeSimilarTracks] Track non-YouTube, retour vide');
      setSimilarTracks([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Vérifier si c'est un profil YouTube (chaîne)
      const channelInfo = getChannelIdFromTrack(track);
      const channelId = channelInfo?.channelId;
      const searchByArtist = channelInfo?.searchByArtist;
      const isChannel = channelId !== null || (track.filePath && isYouTubeChannelUrl(track.filePath));
      
      console.log('[useYouTubeSimilarTracks] Vérification profil YouTube', {
        channelInfo,
        channelId,
        searchByArtist,
        isChannel,
        filePath: track.filePath,
        isChannelUrl: track.filePath ? isYouTubeChannelUrl(track.filePath) : false,
      });
      
      // Si on a un channelId ou qu'on doit rechercher par artiste
      if ((isChannel && channelId) || searchByArtist) {
        // C'est un profil YouTube, charger ses playlists
        let actualChannelId = channelId;
        
        // Si on doit rechercher par artiste, d'abord trouver le channelId
        if (searchByArtist && !channelId) {
          console.log(`[useYouTubeSimilarTracks] 🔍 Recherche chaîne par nom d'artiste: ${searchByArtist}`);
          
          try {
            // Rechercher la chaîne par nom d'artiste
            const apiKey = typeof window !== 'undefined' 
              ? (localStorage.getItem("nexus-youtube-api-key") || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || null)
              : null;
            
            if (apiKey) {
              const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
              searchUrl.searchParams.set("key", apiKey);
              searchUrl.searchParams.set("part", "snippet");
              searchUrl.searchParams.set("type", "channel");
              searchUrl.searchParams.set("q", searchByArtist);
              searchUrl.searchParams.set("maxResults", "1");
              
              const searchResponse = await fetch(searchUrl.toString());
              if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                if (searchData.items && searchData.items.length > 0) {
                  actualChannelId = searchData.items[0].id.channelId;
                  console.log(`[useYouTubeSimilarTracks] ✅ ChannelId trouvé pour ${searchByArtist}: ${actualChannelId}`);
                } else {
                  console.log(`[useYouTubeSimilarTracks] ❌ Aucune chaîne trouvée pour ${searchByArtist}`);
                  // Fallback sur recherche par artiste normale
                  actualChannelId = null;
                }
              } else {
                console.warn(`[useYouTubeSimilarTracks] ❌ Erreur recherche chaîne: ${searchResponse.status}`);
                actualChannelId = null;
              }
            } else {
              console.warn('[useYouTubeSimilarTracks] Pas de clé API pour rechercher la chaîne');
              actualChannelId = null;
            }
          } catch (err) {
            console.error('[useYouTubeSimilarTracks] Erreur recherche chaîne par artiste:', err);
            actualChannelId = null;
          }
        }
        
        if (actualChannelId) {
          console.log(`[useYouTubeSimilarTracks] ✅ Détection profil YouTube: ${actualChannelId}`);
          console.log(`[useYouTubeSimilarTracks] Chargement des playlists pour la chaîne: ${actualChannelId}`);
          
          const playlists = await fetchYouTubeChannelPlaylists(actualChannelId, 20);
          console.log(`[useYouTubeSimilarTracks] ${playlists.length} playlists trouvées`, playlists.map(p => ({ id: p.videoId, title: p.title })));
          
          if (playlists.length > 0) {
          // Charger les vidéos de chaque playlist (limiter à 5 vidéos par playlist pour éviter trop d'appels)
          const allVideos: any[] = [];
          
          for (const playlist of playlists.slice(0, 10)) { // Limiter à 10 playlists
            try {
              console.log(`[useYouTubeSimilarTracks] Chargement vidéos playlist: ${playlist.title} (${playlist.videoId})`);
              const videos = await fetchYouTubePlaylistVideos(playlist.videoId, 5); // 5 vidéos par playlist
              console.log(`[useYouTubeSimilarTracks] ${videos.length} vidéos chargées de la playlist ${playlist.title}`);
              allVideos.push(...videos);
            } catch (err) {
              console.warn(`[useYouTubeSimilarTracks] ❌ Erreur chargement playlist ${playlist.videoId}:`, err);
            }
          }
          
          console.log(`[useYouTubeSimilarTracks] Total: ${allVideos.length} vidéos chargées de toutes les playlists`);
          
          // Convertir en tracks
          const tracks = youtubeSuggestionsToTracks(allVideos);
          console.log(`[useYouTubeSimilarTracks] ${tracks.length} tracks convertis`);
          
          // Dédupliquer par ID
          const uniqueTracks = Array.from(
            new Map(tracks.map(t => [t.id, t])).values()
          );
          console.log(`[useYouTubeSimilarTracks] ${uniqueTracks.length} tracks uniques après déduplication`);
          
            const finalTracks = uniqueTracks.slice(0, 50); // Limiter à 50 tracks
            console.log(`[useYouTubeSimilarTracks] ✅ ${finalTracks.length} tracks finaux à afficher`);
            setSimilarTracks(finalTracks);
          } else {
            // Pas de playlists, essayer de charger des vidéos de la chaîne
            console.log('[useYouTubeSimilarTracks] Aucune playlist trouvée, fallback sur recherche par artiste');
            if (track.artist) {
              console.log(`[useYouTubeSimilarTracks] Recherche vidéos pour artiste: ${track.artist}`);
              const suggestions = await searchYouTubeByArtist(track.artist, 20);
              console.log(`[useYouTubeSimilarTracks] ${suggestions.length} suggestions trouvées`);
              const tracks = youtubeSuggestionsToTracks(suggestions);
              setSimilarTracks(tracks);
            } else {
              console.log('[useYouTubeSimilarTracks] Pas d\'artiste, retour vide');
              setSimilarTracks([]);
            }
          }
        } else {
          // Impossible de trouver le channelId, fallback sur recherche par artiste
          console.log('[useYouTubeSimilarTracks] Impossible de trouver channelId, fallback sur recherche par artiste');
          if (track.artist) {
            console.log(`[useYouTubeSimilarTracks] Recherche vidéos pour artiste: ${track.artist}`);
            const suggestions = await searchYouTubeByArtist(track.artist, 20);
            console.log(`[useYouTubeSimilarTracks] ${suggestions.length} suggestions trouvées`);
            const tracks = youtubeSuggestionsToTracks(suggestions);
            setSimilarTracks(tracks);
          } else {
            console.log('[useYouTubeSimilarTracks] Pas d\'artiste, retour vide');
            setSimilarTracks([]);
          }
        }
      } else {
        // C'est une vidéo normale, charger des vidéos similaires par artiste
        console.log('[useYouTubeSimilarTracks] Track vidéo normale (pas un profil)');
        if (!track.artist) {
          console.log('[useYouTubeSimilarTracks] Pas d\'artiste, retour vide');
          setSimilarTracks([]);
          return;
        }
        
        console.log(`[useYouTubeSimilarTracks] Recherche vidéos similaires pour artiste: ${track.artist}`);
        const suggestions = await searchYouTubeByArtist(track.artist, 20);
        console.log(`[useYouTubeSimilarTracks] ${suggestions.length} suggestions trouvées`);
        
        // Exclure le track actuel
        const filtered = suggestions.filter(s => s.videoId !== track.youtubeVideoId);
        console.log(`[useYouTubeSimilarTracks] ${filtered.length} suggestions après exclusion du track actuel`);
        
        const tracks = youtubeSuggestionsToTracks(filtered);
        console.log(`[useYouTubeSimilarTracks] ✅ ${tracks.length} tracks finaux à afficher`);
        setSimilarTracks(tracks);
      }
    } catch (err) {
      console.error('[useYouTubeSimilarTracks] ❌ Erreur:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      setSimilarTracks([]);
    } finally {
      setLoading(false);
      console.log('[useYouTubeSimilarTracks] Chargement terminé');
    }
  }, []);

  return {
    similarTracks,
    loading,
    error,
    loadSimilar,
  };
}
