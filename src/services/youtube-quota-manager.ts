/**
 * Gestionnaire de quota YouTube API - Nexus Engine
 * Circuit breaker avec états OK/LOW/EXHAUSTED
 * Watchdog journalier + backoff exponentiel
 */

export enum QuotaState {
  OK = 'OK',
  LOW = 'LOW',
  EXHAUSTED = 'EXHAUSTED',
}

interface QuotaBudget {
  daily: number;
  search: number;
  metadata: number;
  used: number;
  usedSearch: number;
  usedMetadata: number;
  resetAt: Date;
  // Circuit breaker
  consecutiveFailures: number;
  lastFailureAt: Date | null;
  circuitBreakerOpen: boolean;
}

class YouTubeQuotaManager {
  private readonly DAILY_QUOTA = 10_000; // Quota quotidien par défaut
  private readonly SEARCH_BUDGET = 1_000; // Budget pour les recherches (100 unités par search)
  private readonly METADATA_BUDGET = 8_000; // Budget pour les métadonnées (1 unité par video)
  private readonly BATCH_BUDGET = 1_000; // Budget pour les batch calls
  
  // Circuit breaker thresholds
  private readonly LOW_THRESHOLD = 0.8; // 80% utilisé = LOW
  private readonly EXHAUSTED_THRESHOLD = 0.95; // 95% utilisé = EXHAUSTED
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private readonly CIRCUIT_BREAKER_RESET_MS = 5 * 60 * 1000; // 5 minutes
  
  private budget: QuotaBudget;
  private readonly STORAGE_KEY = 'nexus-youtube-quota-budget';
  
  // Watchdog pour reset automatique
  private watchdogInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.budget = this.loadBudget();
    this.checkReset();
    this.startWatchdog();
  }

  /**
   * Démarre le watchdog pour reset automatique
   */
  private startWatchdog(): void {
    if (typeof window === 'undefined') return;
    
    // Vérifier toutes les heures
    this.watchdogInterval = setInterval(() => {
      this.checkReset();
      this.checkCircuitBreaker();
    }, 60 * 60 * 1000);
  }

  /**
   * Arrête le watchdog
   */
  private stopWatchdog(): void {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
  }

  private loadBudget(): QuotaBudget {
    if (typeof window === 'undefined') {
      return this.createNewBudget();
    }

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...parsed,
          resetAt: new Date(parsed.resetAt),
        };
      }
    } catch (error) {
      console.error('[QuotaManager] Erreur chargement budget:', error);
    }

    return this.createNewBudget();
  }

  private createNewBudget(): QuotaBudget {
    const now = new Date();
    const resetAt = new Date(now);
    resetAt.setHours(24, 0, 0, 0); // Minuit prochain
    
    return {
      daily: this.DAILY_QUOTA,
      search: this.SEARCH_BUDGET,
      metadata: this.METADATA_BUDGET,
      used: 0,
      usedSearch: 0,
      usedMetadata: 0,
      resetAt,
    };
  }

  private saveBudget(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.budget));
    } catch (error) {
      console.error('[QuotaManager] Erreur sauvegarde budget:', error);
    }
  }

  private checkReset(): void {
    const now = new Date();
    if (now >= this.budget.resetAt) {
      console.log('[QuotaManager] 🔄 Reset quotidien du budget');
      this.budget = this.createNewBudget();
      this.saveBudget();
    }
  }

  /**
   * Vérifie et réinitialise le circuit breaker si nécessaire
   */
  private checkCircuitBreaker(): void {
    if (!this.budget.circuitBreakerOpen) return;
    
    if (this.budget.lastFailureAt) {
      const timeSinceFailure = Date.now() - this.budget.lastFailureAt.getTime();
      if (timeSinceFailure > this.CIRCUIT_BREAKER_RESET_MS) {
        console.log('[QuotaManager] 🔓 Circuit breaker réinitialisé');
        this.budget.circuitBreakerOpen = false;
        this.budget.consecutiveFailures = 0;
        this.budget.lastFailureAt = null;
        this.saveBudget();
      }
    }
  }

  /**
   * Enregistre un échec API (pour circuit breaker)
   */
  recordFailure(): void {
    this.budget.consecutiveFailures++;
    this.budget.lastFailureAt = new Date();
    
    if (this.budget.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      console.warn('[QuotaManager] ⚠️ Circuit breaker ouvert (trop d\'échecs)');
      this.budget.circuitBreakerOpen = true;
    }
    
    this.saveBudget();
  }

  /**
   * Enregistre un succès API (reset circuit breaker)
   */
  recordSuccess(): void {
    if (this.budget.consecutiveFailures > 0) {
      this.budget.consecutiveFailures = 0;
      this.budget.lastFailureAt = null;
      if (this.budget.circuitBreakerOpen) {
        console.log('[QuotaManager] ✅ Circuit breaker fermé (succès)');
        this.budget.circuitBreakerOpen = false;
      }
      this.saveBudget();
    }
  }

  /**
   * Retourne l'état actuel du quota
   */
  getState(): QuotaState {
    this.checkReset();
    this.checkCircuitBreaker();
    
    // Circuit breaker ouvert = EXHAUSTED
    if (this.budget.circuitBreakerOpen) {
      return QuotaState.EXHAUSTED;
    }
    
    const percentage = (this.budget.used / this.budget.daily) * 100;
    
    if (percentage >= this.EXHAUSTED_THRESHOLD * 100) {
      return QuotaState.EXHAUSTED;
    }
    
    if (percentage >= this.LOW_THRESHOLD * 100) {
      return QuotaState.LOW;
    }
    
    return QuotaState.OK;
  }

  /**
   * Vérifie si l'API YouTube peut être utilisée
   */
  canUseAPI(): boolean {
    const state = this.getState();
    return state !== QuotaState.EXHAUSTED;
  }

  /**
   * Vérifie si on peut faire une recherche (100 unités)
   */
  canSearch(): boolean {
    this.checkReset();
    this.checkCircuitBreaker();
    
    if (!this.canUseAPI()) {
      return false;
    }
    
    return this.budget.usedSearch < this.budget.search;
  }

  /**
   * Vérifie si on peut récupérer des métadonnées
   */
  canGetMetadata(count: number = 1): boolean {
    this.checkReset();
    this.checkCircuitBreaker();
    
    if (!this.canUseAPI()) {
      return false;
    }
    
    return (this.budget.usedMetadata + count) <= this.budget.metadata;
  }

  /**
   * Vérifie si on peut faire un batch call
   */
  canBatch(count: number = 1): boolean {
    this.checkReset();
    // Batch = 1 unité par vidéo, max 50 par call
    const cost = Math.min(count, 50);
    return (this.budget.usedMetadata + cost) <= this.budget.metadata;
  }

  /**
   * Consomme du quota pour une recherche
   */
  consumeSearch(): boolean {
    this.checkReset();
    
    if (!this.canSearch()) {
      return false;
    }
    
    this.budget.usedSearch += 100; // search.list = 100 unités
    this.budget.used += 100;
    this.saveBudget();
    
    console.log(`[QuotaManager] Search consommé. Restant: ${this.budget.search - this.budget.usedSearch}`);
    return true;
  }

  /**
   * Consomme du quota pour des métadonnées
   */
  consumeMetadata(count: number = 1): boolean {
    this.checkReset();
    
    if (!this.canGetMetadata(count)) {
      return false;
    }
    
    this.budget.usedMetadata += count;
    this.budget.used += count;
    this.saveBudget();
    
    return true;
  }

  /**
   * Consomme du quota pour un batch
   */
  consumeBatch(count: number): boolean {
    this.checkReset();
    
    const cost = Math.min(count, 50); // Max 50 par call
    if (!this.canBatch(cost)) {
      return false;
    }
    
    this.budget.usedMetadata += cost;
    this.budget.used += cost;
    this.saveBudget();
    
    return true;
  }

  /**
   * Retourne le budget restant
   */
  getRemainingBudget(): {
    daily: number;
    search: number;
    metadata: number;
    percentage: number;
  } {
    this.checkReset();
    
    return {
      daily: this.budget.daily - this.budget.used,
      search: this.budget.search - this.budget.usedSearch,
      metadata: this.budget.metadata - this.budget.usedMetadata,
      percentage: (this.budget.used / this.budget.daily) * 100,
    };
  }

  /**
   * Retourne un message UX intelligent selon le budget
   */
  getUXMessage(): string | null {
    const state = this.getState();
    const remaining = this.getRemainingBudget();
    
    if (state === QuotaState.EXHAUSTED) {
      return "Quota API épuisé. Mode lecture optimisé activé - la lecture fonctionne toujours ✅";
    }
    
    if (state === QuotaState.LOW) {
      return "Quota API limité. Résultats enrichis demain. Nexus apprend encore 🧠";
    }
    
    if (remaining.search <= 0) {
      return "Recherches limitées aujourd'hui. Utilisez le cache et l'historique pour continuer.";
    }
    
    if (remaining.metadata <= 100) {
      return "Métadonnées limitées. Mode lecture optimisé activé.";
    }
    
    return null;
  }

  /**
   * Force un reset (pour tests)
   */
  reset(): void {
    this.budget = this.createNewBudget();
    this.saveBudget();
  }
}

// Export singleton
export const youtubeQuotaManager = new YouTubeQuotaManager();
