import { youtubeSearch } from './youtube/search';
import { youtubePlayer } from './youtube/player';

/**
 * Compatibility shim for legacy imports `@/services/youtube-provider` or `../youtube-provider` used in tests.
 * The module provides a small surface that can be mocked by tests.
 */
export const youtubeProvider = {
  async getVideoMetadata(videoId: string) {
    // Return a shape similar to older provider: { success, metadata, source }
    const video = await youtubeSearch.getVideo(videoId);
    return {
      success: !!video,
      metadata: video || null,
      source: video ? 'api' as const : 'fallback' as const,
    };
  },

  canPlay(videoId: string) {
    // Delegate to youtubePlayer if available
    try {
      // Some player implementations expose canPlay
      // Fallback to true to keep behavior permissive
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyPlayer: any = youtubePlayer as any;
      if (typeof anyPlayer.canPlay === 'function') return anyPlayer.canPlay(videoId);
    } catch (e) {
      // ignore
    }
    return true;
  },

  getSystemStatus() {
    // Minimal shape; tests will typically mock this
    return {
      quotaState: 'OK' as const,
      canUseAPI: true,
      canPlay: true,
      message: null as string | null,
    };
  }
};
