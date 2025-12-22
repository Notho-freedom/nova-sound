/**
 * Gestionnaire de quota YouTube unifié
 * Gère les limites API quotidiennes avec circuit breaker
 */

interface QuotaBudget {
  dailyLimit: number;
  used: number;
  lastReset: number;
  consecutiveFailures: number;
  lastFailureAt: number | null;
  circuitBreakerOpen: boolean;
}

interface QuotaConfig {
  dailyLimit: number;                 // Limite quotidienne
  circuitBreakerThreshold: number;    // Nombre d'échecs avant ouverture
  circuitBreakerResetTime: number;    // Temps avant tentative de fermeture (ms)
  quotaCosts: Record<string, number>; // Coût par opération
}

const DEFAULT_CONFIG: QuotaConfig = {
  dailyLimit: 10000,
  circuitBreakerThreshold: 3,          // Réduit pour réaction plus rapide
  circuitBreakerResetTime: 30 * 1000,  // 30 secondes (plus rapide)
  quotaCosts: {
    search: 100,
    videoDetails: 1,
    channelDetails: 1,
    playlistItems: 1,
    captions: 50,
  },
};

const STORAGE_KEY = 'yt_quota_budget';

class YouTubeQuotaManager {
  private config: QuotaConfig;
  private budget: QuotaBudget;

  constructor(config: Partial<QuotaConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.budget = this.loadBudget();
    this.checkDailyReset();
  }

  // ==================== API PRINCIPALE ====================

  /**
   * Vérifie si le quota permet une opération
   */
  canMakeRequest(operation: string = 'search'): boolean {
    this.checkDailyReset();
    
    // Vérifier le circuit breaker
    if (this.isCircuitBreakerOpen()) {
      return false;
    }

    const cost = this.config.quotaCosts[operation] || 1;
    return this.budget.used + cost <= this.budget.dailyLimit;
  }

  /**
   * Consomme du quota pour une opération
   */
  consumeQuota(operation: string = 'search'): boolean {
    if (!this.canMakeRequest(operation)) {
      return false;
    }

    const cost = this.config.quotaCosts[operation] || 1;
    this.budget.used += cost;
    this.saveBudget();
    return true;
  }

  /**
   * Enregistre un succès (réinitialise le circuit breaker)
   */
  recordSuccess(): void {
    this.budget.consecutiveFailures = 0;
    this.budget.circuitBreakerOpen = false;
    this.budget.lastFailureAt = null;
    this.saveBudget();
  }

  /**
   * Enregistre un échec (peut déclencher le circuit breaker)
   */
  recordFailure(): void {
    this.budget.consecutiveFailures++;
    this.budget.lastFailureAt = Date.now();

    if (this.budget.consecutiveFailures >= this.config.circuitBreakerThreshold) {
      this.budget.circuitBreakerOpen = true;
      console.warn('[YouTubeQuota] Circuit breaker OUVERT après', this.budget.consecutiveFailures, 'échecs');
    }

    this.saveBudget();
  }

  /**
   * Force le passage en mode fallback (quota épuisé)
   */
  forceQuotaExhausted(): void {
    this.budget.used = this.budget.dailyLimit;
    this.saveBudget();
  }

  // ==================== ÉTAT ====================

  isQuotaExhausted(): boolean {
    this.checkDailyReset();
    return this.budget.used >= this.budget.dailyLimit;
  }

  isCircuitBreakerOpen(): boolean {
    if (!this.budget.circuitBreakerOpen) {
      return false;
    }

    // Vérifier si on peut tenter une réouverture
    if (this.budget.lastFailureAt) {
      const elapsed = Date.now() - this.budget.lastFailureAt;
      if (elapsed >= this.config.circuitBreakerResetTime) {
        // Permettre une tentative (half-open state)
        return false;
      }
    }

    return true;
  }

  getRemainingQuota(): number {
    this.checkDailyReset();
    return Math.max(0, this.budget.dailyLimit - this.budget.used);
  }

  getQuotaPercentage(): number {
    return Math.min(100, (this.budget.used / this.budget.dailyLimit) * 100);
  }

  getStatus(): {
    remaining: number;
    used: number;
    limit: number;
    percentage: number;
    exhausted: boolean;
    circuitBreakerOpen: boolean;
    consecutiveFailures: number;
  } {
    this.checkDailyReset();
    return {
      remaining: this.getRemainingQuota(),
      used: this.budget.used,
      limit: this.budget.dailyLimit,
      percentage: this.getQuotaPercentage(),
      exhausted: this.isQuotaExhausted(),
      circuitBreakerOpen: this.isCircuitBreakerOpen(),
      consecutiveFailures: this.budget.consecutiveFailures,
    };
  }

  // ==================== GESTION INTERNE ====================

  private checkDailyReset(): void {
    const now = Date.now();
    const lastResetDate = new Date(this.budget.lastReset);
    const today = new Date();

    // Reset si nouveau jour (minuit UTC)
    if (
      lastResetDate.getUTCDate() !== today.getUTCDate() ||
      lastResetDate.getUTCMonth() !== today.getUTCMonth() ||
      lastResetDate.getUTCFullYear() !== today.getUTCFullYear()
    ) {
      this.budget = this.createNewBudget();
      this.saveBudget();
      console.log('[YouTubeQuota] Quota quotidien réinitialisé');
    }
  }

  private createNewBudget(): QuotaBudget {
    return {
      dailyLimit: this.config.dailyLimit,
      used: 0,
      lastReset: Date.now(),
      consecutiveFailures: 0,
      lastFailureAt: null,
      circuitBreakerOpen: false,
    };
  }

  private loadBudget(): QuotaBudget {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // S'assurer que toutes les propriétés existent
        return {
          ...this.createNewBudget(),
          ...parsed,
        };
      }
    } catch (e) {
      console.warn('[YouTubeQuota] Erreur chargement budget:', e);
    }
    return this.createNewBudget();
  }

  private saveBudget(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.budget));
    } catch (e) {
      console.warn('[YouTubeQuota] Erreur sauvegarde budget:', e);
    }
  }

  reset(): void {
    this.budget = this.createNewBudget();
    this.saveBudget();
  }
}

// Singleton
export const youtubeQuota = new YouTubeQuotaManager();
export { YouTubeQuotaManager };
