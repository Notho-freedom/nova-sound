/**
 * Minimal shim for youtube-prefetch service used in tests.
 * Provides a `youtubePrefetchService` object which tests can spy-on or mock.
 */
export const youtubePrefetchService = {
  async prefetchTrending(maxResults: number = 25) {
    // No-op shim: real implementation lives elsewhere.
    return { success: true, fetched: 0, attempted: maxResults };
  }
};

export default youtubePrefetchService;
