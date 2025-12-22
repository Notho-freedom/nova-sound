/**
 * Shim de compatibilité pour youtube-cache
 * Redirige vers le service YouTube unifié
 */

import { youtubeCache, type YouTubeVideo } from '@/services/youtube';

export const youtubeCacheService = {
  getSearch: (query: string) => {
    const results = youtubeCache.getSearch(query);
    return results ? { results } : null;
  },
  setSearch: (query: string, videos: YouTubeVideo[]) => {
    youtubeCache.setSearch(query, videos);
  },
  getVideo: (videoId: string) => youtubeCache.getVideo(videoId),
  setVideo: (video: YouTubeVideo) => youtubeCache.setVideo(video),
  clear: () => youtubeCache.clear(),
  getStats: () => youtubeCache.getStats(),
};
