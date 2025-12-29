import type { Track } from '@/types/music';
import { getCachedYouTubeTrack } from './youtube-track-cache';

/**
 * Try to find a Track by id in the provided `allTracks` list,
 * falling back to the local YouTube track cache if not found.
 */
export function getTrackFromAllOrCache(allTracks: Track[], trackId: string): Track | null {
  if (!trackId) return null;

  const direct = allTracks.find(t => t.id === trackId);
  if (direct) return direct;

  // Fallback to cache by track id
  const cached = getCachedYouTubeTrack(trackId);
  if (cached) return cached;

  return null;
}
