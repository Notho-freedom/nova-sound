/**
 * Fonctions pour rechercher des vidéos YouTube par artiste/channel
 * Utilise le service YouTube unifié depuis src/services/youtube/
 */

import type { Track } from "@/types/music";
import type { YouTubeSuggestion } from "./youtube-suggestions";

/**
 * Recherche des vidéos YouTube par nom d'artiste
 * Utilise le service YouTube unifié avec cache et fallback automatiques
 */
export async function searchYouTubeByArtist(
  artistName: string,
  maxResults: number = 20
): Promise<YouTubeSuggestion[]> {
  try {
    const { YouTube } = await import('@/services/youtube');
    
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
    
    // Vérifier le quota avant d'appeler
    const quotaStatus = YouTube.getQuotaStatus();
    if (quotaStatus.exhausted || quotaStatus.circuitBreakerOpen) {
      console.log(`[YouTube Artist Search] Quota épuisé ou circuit breaker ouvert, pas d'appel pour: ${artistName}`);
      return [];
    }

    // Rechercher via le service unifié
    const result = await YouTube.search(artistName, maxResults);
    
    // Convertir en YouTubeSuggestion
    return result.videos.map(video => ({
      videoId: video.videoId,
      title: video.title,
      description: video.description,
      thumbnailUrl: video.thumbnailUrl,
      channelTitle: video.channelTitle,
      publishedAt: video.publishedAt || '',
      duration: video.duration,
      viewCount: video.viewCount,
    }));
  } catch (error) {
    console.error('[YouTube Artist Search] Erreur lors de la recherche:', error);
    return [];
  }
}

/**
 * Convertit des suggestions YouTube en Tracks pour le système audio
 */
export function youtubeSuggestionsToTracks(suggestions: YouTubeSuggestion[]): Track[] {
  return suggestions.map(suggestion => {
    // Extraire l'artiste et le titre depuis le titre YouTube
    const parseTitle = (title: string, channel?: string): { artist: string; trackTitle: string } => {
      const separators = [' - ', ' – ', ' — ', ' | ', ' • '];
      for (const sep of separators) {
        if (title.includes(sep)) {
          const parts = title.split(sep);
          if (parts.length === 2) {
            return {
              artist: parts[0].trim(),
              trackTitle: parts[1].trim(),
            };
          }
        }
      }
      return {
        artist: channel || 'Artiste inconnu',
        trackTitle: title,
      };
    };

    const { artist, trackTitle } = parseTitle(suggestion.title, suggestion.channelTitle);

    return {
      id: `youtube-audio-${suggestion.videoId}`,
      filePath: `https://www.youtube.com/watch?v=${suggestion.videoId}`,
      title: trackTitle,
      artist: artist,
      album: suggestion.channelTitle || 'YouTube',
      duration: suggestion.duration || 0,
      coverUrl: suggestion.thumbnailUrl || '',
      addedAt: new Date().toISOString(),
      mediaSource: 'youtube',
      youtubeVideoId: suggestion.videoId,
    };
  });
}
