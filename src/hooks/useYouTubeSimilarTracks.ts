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

    // Exclure les tracks sans videoId valide
    if (!track.youtubeVideoId || track.youtubeVideoId === 'undefined' || track.youtubeVideoId.trim() === '') {
      console.log('[useYouTubeSimilarTracks] ⚠️ Track sans videoId valide, exclusion');
      // Mais on peut quand même charger les playlists de l'artiste si on a un nom d'artiste
      if (!track.artist || track.artist.trim() === '') {
        console.log('[useYouTubeSimilarTracks] Pas d\'artiste non plus, retour vide');
        setSimilarTracks([]);
        return;
      }
      // On continue pour charger les playlists de l'artiste
      console.log('[useYouTubeSimilarTracks] Track sans videoId mais avec artiste, chargement playlists de l\'artiste');
    }

    setLoading(true);
    setError(null);

    try {
      // Pour les tracks YouTube, toujours charger les playlists de l'artiste depuis son profil Nexus
      // (même si c'est une vidéo normale, on charge les playlists de l'artiste)
      if (!track.artist || track.artist.trim() === '') {
        console.log('[useYouTubeSimilarTracks] Pas d\'artiste, impossible de charger les playlists');
        setSimilarTracks([]);
        return;
      }

      console.log(`[useYouTubeSimilarTracks] 🎵 Chargement playlists pour l'artiste Nexus: ${track.artist}`);
      
      // Vérifier d'abord si c'est un profil YouTube direct (URL de chaîne)
      const channelInfo = getChannelIdFromTrack(track);
      const channelId = channelInfo?.channelId;
      const searchByArtist = channelInfo?.searchByArtist || track.artist; // Utiliser l'artiste du track
      
      console.log('[useYouTubeSimilarTracks] Vérification profil YouTube', {
        channelInfo,
        channelId,
        searchByArtist,
        artistFromTrack: track.artist,
      });
      
      // Toujours rechercher la chaîne YouTube de l'artiste depuis son profil Nexus
      let actualChannelId = channelId;
      
      // Si on n'a pas de channelId direct, rechercher la chaîne par nom d'artiste (profil Nexus)
      if (!actualChannelId && searchByArtist) {
        console.log(`[useYouTubeSimilarTracks] 🔍 Recherche chaîne YouTube pour l'artiste Nexus: ${searchByArtist}`);
        
        try {
          // Rechercher la chaîne par nom d'artiste depuis le profil Nexus
          const apiKey = typeof window !== 'undefined' 
            ? (localStorage.getItem("nexus-youtube-api-key") || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || null)
            : null;
          
          if (apiKey) {
            // Vérifier le circuit breaker AVANT l'appel API
            try {
              const { youtubeQuotaManager } = await import('@/services/youtube-quota-manager');
              if (!youtubeQuotaManager.canUseAPI() || !youtubeQuotaManager.canSearch()) {
                console.log('[useYouTubeSimilarTracks] Circuit breaker ouvert ou quota recherche épuisé, skip API call');
                // Utiliser searchYouTubeByArtist qui gère déjà le circuit breaker
                const suggestions = await searchYouTubeByArtist(searchByArtist, 20);
                const tracks = youtubeSuggestionsToTracks(suggestions);
                setSimilarTracks(tracks);
                setLoading(false);
                return;
              }
            } catch (error) {
              // Continuer si le service n'est pas disponible
            }
            
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
                console.log(`[useYouTubeSimilarTracks] ✅ ChannelId trouvé pour l'artiste Nexus "${searchByArtist}": ${actualChannelId}`);
              } else {
                console.log(`[useYouTubeSimilarTracks] ❌ Aucune chaîne YouTube trouvée pour l'artiste Nexus: ${searchByArtist}`);
                actualChannelId = null;
              }
            } else {
              const isQuotaError = searchResponse.status === 403 || searchResponse.status === 429;
              if (isQuotaError) {
                console.warn(`[useYouTubeSimilarTracks] ⚠️ Quota épuisé lors de la recherche de chaîne pour ${searchByArtist}`);
                try {
                  const { youtubeQuotaManager } = await import('@/services/youtube-quota-manager');
                  youtubeQuotaManager.recordFailure();
                } catch (error) {
                  // Ignorer
                }
              }
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
      
      // Charger les playlists de la chaîne YouTube de l'artiste
      if (actualChannelId) {
        console.log(`[useYouTubeSimilarTracks] ✅ Chargement des playlists YouTube pour l'artiste Nexus "${track.artist}" (channelId: ${actualChannelId})`);
        
        const playlists = await fetchYouTubeChannelPlaylists(actualChannelId, 20);
        console.log(`[useYouTubeSimilarTracks] ${playlists.length} playlists trouvées pour l'artiste "${track.artist}"`, playlists.map(p => ({ id: p.videoId, title: p.title })));
        
        if (playlists.length > 0) {
          // Charger les vidéos de chaque playlist (limiter à 5 vidéos par playlist pour éviter trop d'appels)
          const allVideos: any[] = [];
          
          for (const playlist of playlists.slice(0, 10)) { // Limiter à 10 playlists
            try {
              console.log(`[useYouTubeSimilarTracks] Chargement vidéos playlist: ${playlist.title} (${playlist.videoId})`);
              const videos = await fetchYouTubePlaylistVideos(playlist.videoId, 5); // 5 vidéos par playlist
              console.log(`[useYouTubeSimilarTracks] ${videos.length} vidéos chargées de la playlist ${playlist.title}`);
              
              // Filtrer les vidéos sans videoId valide
              const validVideos = videos.filter(v => v.videoId && v.videoId !== 'undefined' && v.videoId.trim() !== '');
              console.log(`[useYouTubeSimilarTracks] ${validVideos.length} vidéos valides après filtrage (sur ${videos.length})`);
              allVideos.push(...validVideos);
            } catch (err) {
              console.warn(`[useYouTubeSimilarTracks] ❌ Erreur chargement playlist ${playlist.videoId}:`, err);
            }
          }
          
          console.log(`[useYouTubeSimilarTracks] Total: ${allVideos.length} vidéos valides chargées de toutes les playlists`);
          
          // Convertir en tracks
          const tracks = youtubeSuggestionsToTracks(allVideos);
          console.log(`[useYouTubeSimilarTracks] ${tracks.length} tracks convertis`);
          
          // Dédupliquer par ID
          const uniqueTracks = Array.from(
            new Map(tracks.map(t => [t.id, t])).values()
          );
          console.log(`[useYouTubeSimilarTracks] ${uniqueTracks.length} tracks uniques après déduplication`);
          
          const finalTracks = uniqueTracks.slice(0, 50); // Limiter à 50 tracks
          console.log(`[useYouTubeSimilarTracks] ✅ ${finalTracks.length} tracks finaux à afficher depuis les playlists de l'artiste`);
          setSimilarTracks(finalTracks);
        } else {
          // Pas de playlists, essayer de charger des vidéos de l'artiste
          console.log(`[useYouTubeSimilarTracks] Aucune playlist trouvée pour l'artiste "${track.artist}", fallback sur recherche vidéos`);
          const suggestions = await searchYouTubeByArtist(track.artist, 20);
          console.log(`[useYouTubeSimilarTracks] ${suggestions.length} suggestions trouvées`);
          
          // Filtrer les suggestions sans videoId valide
          const validSuggestions = suggestions.filter(s => s.videoId && s.videoId !== 'undefined' && s.videoId.trim() !== '');
          console.log(`[useYouTubeSimilarTracks] ${validSuggestions.length} suggestions valides après filtrage`);
          
          const tracks = youtubeSuggestionsToTracks(validSuggestions);
          // Exclure le track actuel s'il a un videoId valide
          const filteredTracks = track.youtubeVideoId && track.youtubeVideoId !== 'undefined'
            ? tracks.filter(t => t.youtubeVideoId !== track.youtubeVideoId)
            : tracks;
          console.log(`[useYouTubeSimilarTracks] ✅ ${filteredTracks.length} tracks finaux à afficher`);
          setSimilarTracks(filteredTracks);
        }
      } else {
        // Impossible de trouver le channelId de l'artiste, fallback sur recherche vidéos
        console.log(`[useYouTubeSimilarTracks] Impossible de trouver channelId pour l'artiste "${track.artist}", fallback sur recherche vidéos`);
        const suggestions = await searchYouTubeByArtist(track.artist, 20);
        console.log(`[useYouTubeSimilarTracks] ${suggestions.length} suggestions trouvées`);
        
        // Filtrer les suggestions sans videoId valide
        const validSuggestions = suggestions.filter(s => s.videoId && s.videoId !== 'undefined' && s.videoId.trim() !== '');
        console.log(`[useYouTubeSimilarTracks] ${validSuggestions.length} suggestions valides après filtrage`);
        
        const tracks = youtubeSuggestionsToTracks(validSuggestions);
        // Exclure le track actuel s'il a un videoId valide
        const filteredTracks = track.youtubeVideoId && track.youtubeVideoId !== 'undefined'
          ? tracks.filter(t => t.youtubeVideoId !== track.youtubeVideoId)
          : tracks;
        console.log(`[useYouTubeSimilarTracks] ✅ ${filteredTracks.length} tracks finaux à afficher`);
        setSimilarTracks(filteredTracks);
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
