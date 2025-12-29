import type { Playlist, Track } from '@/types/music';
import type { YouTubeSuggestion } from '@/lib/youtube-suggestions';
import { youtubeVideoToTrack } from './youtube-to-track';
import type { YouTubeSearchResult } from '@/hooks/useYouTubeSearch';

/**
 * Ensure tracks referenced by playlists are present in the YouTube track cache.
 * - For playlists with mediaSource === 'youtube' and an externalId, fetch playlist videos and cache them
 * - For playlists containing trackIds, find matching tracks from allTracks and cache YouTube tracks
 */
export async function ensurePlaylistTracksCached(
  playlists: Playlist[] | null | undefined,
  allTracks: Track[],
  options?: { fetchYouTubePlaylistVideos?: (id: string, limit?: number) => Promise<YouTubeSuggestion[]>; cacheYouTubeTrack?: (t: Track) => void }
) {
  if (!playlists || playlists.length === 0) return;

  const fetchFn = options?.fetchYouTubePlaylistVideos || (async () => []);
  const cacheFn = options?.cacheYouTubeTrack || (() => {});

  const tasks: Promise<void>[] = [];

  for (const playlist of playlists) {
    // 1) If the playlist is a YouTube playlist with an externalId, fetch videos and cache
    if (playlist.mediaSource === 'youtube' && playlist.externalId) {
      const playlistId = playlist.externalId;
      if (!playlistId) continue;

      const task = (async () => {
        try {
          const videos = await fetchFn(playlistId, 200);
          if (Array.isArray(videos) && videos.length > 0) {
            for (const v of videos) {
              try {
                // Adapter YouTubeSuggestion -> YouTubeSearchResult compatible
                const durationSeconds = typeof v.duration === 'number' ? v.duration : 0;
                const hours = Math.floor(durationSeconds / 3600);
                const minutes = Math.floor((durationSeconds % 3600) / 60);
                const seconds = durationSeconds % 60;
                const durationISO = `PT${hours}H${minutes}M${seconds}S`;

                const adapter: YouTubeSearchResult = {
                  videoId: v.videoId,
                  title: v.title,
                  description: v.description || '',
                  thumbnailUrl: v.thumbnailUrl || '',
                  channelTitle: v.channelTitle || '',
                  publishedAt: v.publishedAt || new Date().toISOString(),
                  duration: durationISO,
                };

                const track = youtubeVideoToTrack(adapter);
                cacheFn(track);
              } catch (e) {
                // ignore per-track caching errors
              }
            }
          }
        } catch (e) {
          // ignore playlist fetch errors
        }
      })();
      tasks.push(task);
    }

    // 2) For persisted trackIds, try to find YouTube tracks in allTracks and cache them
    if (Array.isArray(playlist.trackIds) && playlist.trackIds.length > 0 && allTracks && allTracks.length > 0) {
      for (const id of playlist.trackIds) {
        const t = allTracks.find(tr => tr.id === id);
        if (t && t.mediaSource === 'youtube') {
          try {
            cacheFn(t);
          } catch (e) {
            // ignore per-track caching errors
          }
        }
      }
    }
  }

  await Promise.all(tasks);
}
