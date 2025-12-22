/**
 * Shim de compatibilité pour youtube-batch
 * Les fonctionnalités batch sont maintenant dans le service unifié
 */

export const youtubeBatchService = {
  batchGetVideos: async (videoIds: string[]) => {
    const { youtubeSearch } = await import('@/services/youtube/search');
    return youtubeSearch.getVideoDetails(videoIds);
  },
};
