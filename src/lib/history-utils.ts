import type { Track } from "@/types/music";
import type { HistoryEntry } from "@/hooks/usePlayHistory";
import { getCachedYouTubeTrackByVideoId } from "@/lib/youtube-track-cache";

export function mapHistoryEntriesToTracks(
  history: HistoryEntry[],
  allTracks: Track[],
  queueTracks: Track[],
  libraryTracks: Track[]
): Track[] {
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
      }

      // 3) Check the active queue
      const trackInQueue = queueTracks.find(t => t.id === h.trackId);
      if (trackInQueue) return trackInQueue;

      // 4) Fallback to library
      return libraryTracks.find(t => t.id === h.trackId);
    })
    .filter((t): t is Track => t !== undefined);

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
