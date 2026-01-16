import type { Track } from '@/types/music';
import { getCachedYouTubeTrack } from './youtube-track-cache';
import { queueTrackRecovery } from './youtube-track-recovery';

/**
 * Try to find a Track by id in the provided `allTracks` list,
 * falling back to the local YouTube track cache if not found.
 * 
 * Si le track n'est pas trouvé et qu'il s'agit d'un track YouTube,
 * une récupération automatique en arrière-plan est lancée.
 */
export function getTrackFromAllOrCache(allTracks: Track[], trackId: string): Track | null {
  if (!trackId) return null;

  const direct = allTracks.find(t => t.id === trackId);
  if (direct) return direct;

  // Fallback to cache by track id
  const cached = getCachedYouTubeTrack(trackId);
  if (cached) return cached;

  // Si toujours pas trouvé et que c'est un track YouTube, 
  // lancer une récupération en arrière-plan
  if (isYouTubeTrackId(trackId)) {
    queueTrackRecovery([trackId]);
  }

  return null;
}

/**
 * Vérifie si un trackId correspond à un track YouTube
 */
function isYouTubeTrackId(trackId: string): boolean {
  if (!trackId) return false;
  
  return (
    trackId.startsWith('youtube-') ||
    trackId.startsWith('youtube_') ||
    trackId.startsWith('yt-') ||
    trackId.startsWith('yt_') ||
    trackId.includes('youtube.com') ||
    trackId.includes('youtu.be') ||
    (trackId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(trackId))
  );
}
