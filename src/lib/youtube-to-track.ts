/**
 * Utilitaires pour convertir des vidéos YouTube en Tracks audio
 */

import type { Track } from "@/types/music";
import type { YouTubeSearchResult } from "@/hooks/useYouTubeSearch";
import { extractYouTubeVideoId } from "./youtube";

/**
 * Convertit une vidéo YouTube en Track pour le système audio
 */
export function youtubeVideoToTrack(
  result: YouTubeSearchResult,
  channelTitle?: string
): Track {
  // Parser la durée ISO 8601 en secondes
  const parseDuration = (duration?: string): number => {
    if (!duration) return 0;
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  };

  // Extraire l'artiste et le titre depuis le titre YouTube
  // Format typique: "Artiste - Titre" ou "Titre - Artiste"
  const parseTitle = (title: string, channel?: string): { artist: string; trackTitle: string } => {
    // Essayer de détecter un séparateur commun
    const separators = [' - ', ' – ', ' — ', ' | ', ' • '];
    for (const sep of separators) {
      if (title.includes(sep)) {
        const parts = title.split(sep);
        if (parts.length === 2) {
          // Prendre la première partie comme artiste, la seconde comme titre
          return {
            artist: parts[0].trim(),
            trackTitle: parts[1].trim(),
          };
        }
      }
    }
    
    // Si pas de séparateur, utiliser le channel comme artiste
    return {
      artist: channel || 'Artiste inconnu',
      trackTitle: title,
    };
  };

  const { artist, trackTitle } = parseTitle(result.title, channelTitle || result.channelTitle);
  const videoId = extractYouTubeVideoId(result.videoId) || result.videoId;
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

  return {
    id: `youtube-audio-${videoId}`,
    filePath: youtubeUrl,
    title: trackTitle,
    artist: artist,
    album: result.channelTitle || 'YouTube',
    duration: parseDuration(result.duration),
    coverUrl: result.thumbnailUrl || '',
    addedAt: new Date().toISOString(),
    // Métadonnées YouTube
    mediaSource: 'youtube',
    youtubeVideoId: videoId,
  };
}
