/**
 * Shim de compatibilité pour youtube-quota-manager
 * Redirige vers le service YouTube unifié
 */

import { youtubeQuota } from '@/services/youtube/quota';

export enum QuotaState {
  OK = 'OK',
  LOW = 'LOW',
  EXHAUSTED = 'EXHAUSTED',
}

const SEARCH_BUDGET_KEY = 'yt_quota_search_used';
const SEARCH_BUDGET_TOTAL = 1000; // 10 searches * 100 units

let searchUsedCache = 0;
function readSearchUsed(): number {
  try {
    const v = localStorage.getItem(SEARCH_BUDGET_KEY);
    if (v !== null && v !== undefined) {
      const parsed = parseInt(v, 10);
      if (!Number.isNaN(parsed)) {
        searchUsedCache = parsed;
        return parsed;
      }
    }
  } catch (e) {
    // ignore
  }
  return searchUsedCache;
}

function writeSearchUsed(n: number) {
  try {
    localStorage.setItem(SEARCH_BUDGET_KEY, String(n));
  } catch (e) {
    // ignore storage write errors in tests
  }
  searchUsedCache = n;
}

export const youtubeQuotaManager = {
  canUseAPI: () => {
    const status = youtubeQuota.getStatus();
    return !status.exhausted && !status.circuitBreakerOpen;
  },
  canSearch: () => {
    // Search is allowed if both the global quota and search budget allow it
    const status = youtubeQuota.getStatus();
    if (status.exhausted || status.circuitBreakerOpen) return false;
    const searchUsed = readSearchUsed();
    return searchUsed < SEARCH_BUDGET_TOTAL;
  },
  canGetMetadata: (count: number = 1) => youtubeQuota.canMakeRequest('videoDetails'),
  recordSuccess: () => youtubeQuota.recordSuccess(),
  recordFailure: () => youtubeQuota.recordFailure(),
  consumeSearch: () => {
    // Consume the global daily quota (100 units) and track per-search budget
    const success = youtubeQuota.consumeQuota('search');
    if (success) {
      const used = readSearchUsed();
      writeSearchUsed(used + 100);
    }
    return success;
  },
  consumeMetadata: (count: number = 1) => {
    // Consume 'count' units from global metadata (each unit = 1)
    let success = true;
    for (let i = 0; i < count; i++) {
      success = youtubeQuota.consumeQuota('videoDetails') && success;
    }
    return success;
  },
  getUXMessage: () => {
    const status = youtubeQuota.getStatus();
    if (status.exhausted) {
      return `Quota API épuisé (${status.used}/${status.limit}). La lecture fonctionne toujours ✅`;
    }
    return null;
  },
  getStatus: () => youtubeQuota.getStatus(),
  // New helper expected by tests
  getState: (): QuotaState => {
    const status = youtubeQuota.getStatus();
    const pct = status.percentage;
    if (pct >= 95 || status.exhausted) return QuotaState.EXHAUSTED;
    if (pct >= 80) return QuotaState.LOW;
    return QuotaState.OK;
  },
  getRemainingBudget: () => {
    const status = youtubeQuota.getStatus();
    const searchUsed = readSearchUsed();
    return {
      daily: status.remaining,
      search: Math.max(0, SEARCH_BUDGET_TOTAL - searchUsed),
      metadata: status.remaining, // metadata measured in same units as daily
      percentage: status.percentage,
    };
  },
  getRemainingBudgetRaw: () => ({ // for debugging
    _quotaStatus: youtubeQuota.getStatus(),
    searchUsed: readSearchUsed(),
  }),
  getStatusVerbose: () => youtubeQuota.getStatus(),
  reset: () => {
    try { (youtubeQuota as any).reset(); } catch (e) { /* ignore */ }
    try { localStorage.removeItem(SEARCH_BUDGET_KEY); } catch (e) {}
    searchUsedCache = 0;
  },
};
