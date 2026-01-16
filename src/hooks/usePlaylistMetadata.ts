import { useMemo } from "react";
import type { Playlist, Track } from "@/types/music";
import { getCoverUrl } from "@/lib/audio";
import { getTrackFromAllOrCache } from "@/lib/track-resolver";

export interface PlaylistMetadata {
  playlist: Playlist;
  trackCount: number;
  coverUrl: string | null;
  totalDuration: number;
  coverUrls: (string | null)[];
  primaryColor?: string;
  artists: string[];
}

/**
 * Enrichit les playlists avec des métadonnées calculées basées sur les tracks réels.
 *
 * 🔄 FLUX DE SYNCHRONISATION AVEC FIREBASE:
 * ==========================================
 * 1. Firebase → firebaseSyncService dispatche 'firebase-playlists-update'
 * 2. usePlaylists() écoute cet event et met à jour son état
 * 3. DesktopApp reçoit `playlists` de usePlaylists()
 * 4. DesktopApp passe `playlists` + `tracks` à PlaylistView et Sidebar
 * 5. usePlaylistMetadata() enrichit chaque playlist:
 *    - Récupère les vrais Track objects via les trackIds
 *    - Calcule: couvertures, durée totale, artistes uniques
 * 6. PlaylistView et Sidebar affichent les métadonnées enrichies
 *
 * 💾 SOURCE DE VÉRITÉ:
 * ====================
 * - **usePlaylists()** synchro avec Firebase (queueSync + event listening)
 * - **Sidebar & PlaylistView** reçoivent les données enrichies via props
 * - Les métadonnées visuelles (covers, durée) viennent des Tracks réels
 *
 * 🎨 DONNÉES ENRICHIES:
 * ======================
 * - coverUrl: Couverture du premier track (pour preview)
 * - coverUrls: Tableau des 4 premières couvertures (pour grille)
 * - totalDuration: Somme des durées en secondes
 * - artists: Tableau d'artistes uniques et triés
 * - trackCount: Nombre de tracks (même si 0)
 *
 * @param playlists - Playlists depuis Firebase (via usePlaylists)
 * @param tracks - Tracks depuis la bibliothèque locale
 * @returns Playlists enrichies avec métadonnées de présentation
 */
export function usePlaylistMetadata(
  playlists: Playlist[],
  tracks: Track[]
): PlaylistMetadata[] {
  return useMemo(() => {
    return playlists.map((playlist) => {
      // Trouver tous les tracks de la playlist
      const playlistTracks = playlist.trackIds
        .map((id) => getTrackFromAllOrCache(tracks, id))
        .filter((t): t is Track => !!t);

      // Première couverture pour la preview
      // Utiliser la coverUrl de la playlist si disponible (pour les playlists YouTube)
      // Sinon, utiliser la première track
      const coverUrl = playlist.coverUrl 
        ? getCoverUrl(playlist.coverUrl)
        : (playlistTracks.length > 0
          ? getCoverUrl(playlistTracks[0].coverUrl)
          : null);

      // Toutes les couvertures (pour grille)
      const coverUrls = playlistTracks
        .slice(0, 4)
        .map((t) => getCoverUrl(t.coverUrl));

      // Durée totale en secondes
      const totalDuration = playlistTracks.reduce(
        (acc, t) => acc + (t.duration || 0),
        0
      );

      // Artistes uniques
      const artists = Array.from(
        new Set(playlistTracks.map((t) => t.artist).filter(Boolean))
      ).sort();

      return {
        playlist,
        trackCount: playlistTracks.length,
        coverUrl,
        totalDuration,
        coverUrls,
        artists,
      };
    });
  }, [playlists, tracks]);
}
