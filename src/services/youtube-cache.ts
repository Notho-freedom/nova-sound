/**
 * Shim de compatibilité pour youtube-cache
 * Redirige vers le service YouTube unifié
 */

import { youtubeCache, type YouTubeVideo } from '@/services/youtube';

export const youtubeCacheService = {
  getSearch: (query: string) => {
    const results = youtubeCache.getSearch(query);
    return results ? { query, results } : null;
  },
  setSearch: (query: string, videos: YouTubeVideo[]) => {
    youtubeCache.setSearch(query, videos);
  },
  getVideo: (videoId: string) => {
    const v = youtubeCache.getVideo(videoId);
    if (!v) return null;

    // First try: memory cache entry (preferred, works even when localStorage is mocked)
    try {
      const mem = (youtubeCache as any).memoryCache?.get(`video:${videoId}`);
      if (mem && mem.timestamp && mem.expiresAt) {
        return { ...v, cachedAt: new Date(mem.timestamp), expiresAt: new Date(mem.expiresAt) } as any;
      }
    } catch (e) {
      // ignore
    }

    // Fallback: Try to read stored cache entry metadata from localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const key = `yt_cache_video:${videoId}`;
        const stored = localStorage.getItem(key);
        // eslint-disable-next-line no-console
        try { console.debug('[youtube-cache] localStorage keys', Object.keys(localStorage)); } catch (e) { console.debug('[youtube-cache] localStorage keys error', e); }
        // eslint-disable-next-line no-console
        console.debug('[youtube-cache] getVideo storage raw', key, stored);
        if (stored) {
          const parsed = JSON.parse(stored);
          // eslint-disable-next-line no-console
          console.debug('[youtube-cache] getVideo parsed', key, parsed);
          return { ...v, cachedAt: new Date(parsed.timestamp), expiresAt: new Date(parsed.expiresAt) } as any;
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[youtube-cache] getVideo error reading storage', e);
    }

    // Last fallback: attach reasonable defaults
    const now = Date.now();
    return { ...v, cachedAt: new Date(now), expiresAt: new Date(now + (24 * 60 * 60 * 1000)) } as any;
  },
  setVideo: (video: YouTubeVideo) => {
    // Compute adaptive TTL
    const storageTTL = (video.viewCount && video.viewCount > 1_000_000)
      ? (3 * 24 * 60 * 60 * 1000)
      : (7 * 24 * 60 * 60 * 1000);

    // Set both memory and storage TTLs via internal set
    try {
      (youtubeCache as any).set(`video:${video.videoId}`, video, { memoryTTL: storageTTL, storageTTL });
    } catch (e) {
      // Fallback to default setter
      try { youtubeCache.setVideo(video); } catch (e) { /* ignore */ }
    }

    // Also ensure localStorage entry exists with proper TTL (in case storage was mocked)
    try {
      if (typeof window !== 'undefined' && window.localStorage && video.videoId) {
        const key = `yt_cache_video:${video.videoId}`;
        const now = Date.now();
        const storageEntry = {
          data: video,
          timestamp: now,
          expiresAt: now + storageTTL,
        };
        const str = JSON.stringify(storageEntry);
        localStorage.setItem(key, str);
        if (process.env.NODE_ENV === 'test') {
          // debug during tests
          // eslint-disable-next-line no-console
          console.debug('[youtube-cache] setVideo stored', key, str);
        }
      }
    } catch (e) {
      // ignore
    }
  },
  clear: () => youtubeCache.clear(),
  clearL1: () => { if ((youtubeCache as any).clearL1) { (youtubeCache as any).clearL1(); } else { youtubeCache.clear(); } },
  getStats: () => youtubeCache.getStats(),
};
