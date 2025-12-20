/**
 * Gestionnaire de quota YouTube API
 * Budget quotidien intelligent avec fallback UX
 */

interface QuotaBudget {
  daily: number;
  search: number;
  metadata: number;
  used: number;
  usedSearch: number;
  usedMetadata: number;
  resetAt: Date;
}

class YouTubeQuotaManager {
  private readonly DAILY_QUOTA = 10_000; // Quota quotidien par défaut
  private readonly SEARCH_BUDGET = 1_000; // Budget pour les recherches (100 unités par search)
  private readonly METADATA_BUDGET = 8_000; // Budget pour les métadonnées (1 unité par video)
  private readonly BATCH_BUDGET = 1_000; // Budget pour les batch calls
  
  private budget: QuotaBudget;
  private readonly STORAGE_KEY = 'nexus-youtube-quota-budget';

  constructor() {
    this.budget = this.loadBudget();
    this.checkReset();
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
      console.log('[QuotaManager] Reset quotidien du budget');
      this.budget = this.createNewBudget();
      this.saveBudget();
    }
  }

  /**
   * Vérifie si on peut faire une recherche (100 unités)
   */
  canSearch(): boolean {
    this.checkReset();
    return this.budget.usedSearch < this.budget.search;
  }

  /**
   * Vérifie si on peut récupérer des métadonnées
   */
  canGetMetadata(count: number = 1): boolean {
    this.checkReset();
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
    const remaining = this.getRemainingBudget();
    
    if (remaining.percentage >= 90) {
      return "Quota API proche de la limite. Résultats enrichis demain. Nexus apprend encore 🧠";
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
