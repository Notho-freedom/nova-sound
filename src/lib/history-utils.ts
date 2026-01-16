import type { Track } from "@/types/music";
import type { HistoryEntry } from "@/hooks/usePlayHistory";
import { getCachedYouTubeTrackByVideoId } from "@/lib/youtube-track-cache";
import { queueTrackRecovery } from "@/lib/youtube-track-recovery";

export function mapHistoryEntriesToTracks(
  history: HistoryEntry[],
  allTracks: Track[],
  queueTracks: Track[],
  libraryTracks: Track[]
): Track[] {
  // Collecter les tracks manquants pour récupération batch
  const missingYouTubeIds: string[] = [];
  
  const mapped = history
    .map(h => {
      // 1) Direct lookup by id in allTracks
      let found = allTracks.find(t => t.id === h.trackId);
      if (found) return found;

      // 2) Try to resolve by youtubeVideoId if present
      if (h.youtubeVideoId) {
        found = allTracks.find(t => t.youtubeVideoId === h.youtubeVideoId);
        if (found) return found;

        const cached = getCachedYouTubeTrackByVideoId(h.youtubeVideoId);
        if (cached) return cached;
        
        // Track YouTube manquant - ajouter pour récupération
        missingYouTubeIds.push(h.trackId);
      }

      // 3) Check the active queue
      const trackInQueue = queueTracks.find(t => t.id === h.trackId);
      if (trackInQueue) return trackInQueue;

      // 4) Fallback to library
      const libraryTrack = libraryTracks.find(t => t.id === h.trackId);
      
      // Si toujours pas trouvé, vérifier si c'est un track YouTube
      if (!libraryTrack && isYouTubeTrackId(h.trackId)) {
        missingYouTubeIds.push(h.trackId);
      }
      
      return libraryTrack;
    })
    .filter((t): t is Track => t !== undefined);

  // Lancer la récupération des tracks YouTube manquants en arrière-plan
  if (missingYouTubeIds.length > 0) {
    queueTrackRecovery(missingYouTubeIds);
  }

  // Remove duplicates preserving order
  const seen = new Set<string>();
  const unique: Track[] = [];
  for (const t of mapped) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      unique.push(t);
    }
  }
  return unique;
}

/**
 * Vérifie si un trackId correspond à un track YouTube
 */
function isYouTubeTrackId(trackId: string): boolean {
  if (!trackId) return false;
  
  return (
    trackId.startsWith('youtube-') ||
    trackId.startsWith('yt-') ||
    trackId.includes('youtube.com') ||
    trackId.includes('youtu.be') ||
    (trackId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(trackId))
  );
}

