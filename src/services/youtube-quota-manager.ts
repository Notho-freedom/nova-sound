/**
 * Shim de compatibilité pour youtube-quota-manager
 * Redirige vers le service YouTube unifié
 */

import { youtubeQuota } from '@/services/youtube/quota';

export const youtubeQuotaManager = {
  canUseAPI: () => {
    const status = youtubeQuota.getStatus();
    return !status.exhausted && !status.circuitBreakerOpen;
  },
  canSearch: () => youtubeQuota.canMakeRequest('search'),
  canGetMetadata: (count: number = 1) => youtubeQuota.canMakeRequest('videoDetails'),
  recordSuccess: () => youtubeQuota.recordSuccess(),
  recordFailure: () => youtubeQuota.recordFailure(),
  consumeSearch: () => youtubeQuota.consumeQuota('search'),
  consumeMetadata: (count: number = 1) => youtubeQuota.consumeQuota('videoDetails'),
  getUXMessage: () => {
    const status = youtubeQuota.getStatus();
    if (status.exhausted) {
      return `Quota API épuisé (${status.used}/${status.limit}). La lecture fonctionne toujours ✅`;
    }
    return null;
  },
  getStatus: () => youtubeQuota.getStatus(),
};
