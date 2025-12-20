/**
 * Service centralisé de gestion du localStorage
 * - Compression automatique pour grandes données
 * - Gestion des erreurs/quota
 * - Cache en mémoire pour accès fréquents
 * - Debounce pour écritures multiples
 */

interface StorageOptions {
  compress?: boolean; // Compresser les données volumineuses
  ttl?: number; // Time to live en millisecondes
  debounceMs?: number; // Debounce pour écritures multiples
}

class StorageService {
  private memoryCache = new Map<string, { data: any; timestamp: number; ttl?: number }>();
  private writeQueue = new Map<string, { data: any; timeout: NodeJS.Timeout }>();
  private readonly DEFAULT_DEBOUNCE_MS = 100;
  private readonly MAX_CACHE_SIZE = 1000; // Max entrées en cache mémoire

  /**
   * Compresse les données JSON si nécessaire
   */
  private compress(data: any): string {
    try {
      const json = JSON.stringify(data);
      // Pour des données > 10KB, utiliser compression simple (base64 + réduction)
      if (json.length > 10000) {
        // Compression simple: remplacer espaces multiples, retours à la ligne
        const compressed = json
          .replace(/\s+/g, ' ')
          .replace(/\n/g, '')
          .replace(/\r/g, '');
        return `compressed:${btoa(compressed)}`;
      }
      return json;
    } catch (error) {
      console.error('[StorageService] Compression error:', error);
      return JSON.stringify(data);
    }
  }

  /**
   * Décompresse les données si nécessaire
   */
  private decompress(compressed: string): any {
    try {
      if (compressed.startsWith('compressed:')) {
        const base64 = compressed.substring(11);
        const decompressed = atob(base64);
        return JSON.parse(decompressed);
      }
      return JSON.parse(compressed);
    } catch (error) {
      console.error('[StorageService] Decompression error:', error);
      return null;
    }
  }

  /**
   * Vérifie si une entrée est expirée
   */
  private isExpired(entry: { timestamp: number; ttl?: number }): boolean {
    if (!entry.ttl) return false;
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Nettoie le cache mémoire si trop plein
   */
  private cleanMemoryCache(): void {
    if (this.memoryCache.size <= this.MAX_CACHE_SIZE) return;

    // Supprimer les entrées expirées d'abord
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
      }
    }

    // Si toujours trop plein, supprimer les plus anciennes
    if (this.memoryCache.size > this.MAX_CACHE_SIZE) {
      const sorted = Array.from(this.memoryCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = sorted.slice(0, Math.floor(this.MAX_CACHE_SIZE * 0.1));
      toRemove.forEach(([key]) => this.memoryCache.delete(key));
    }
  }

  /**
   * Récupère une valeur depuis le storage
   */
  get<T = any>(key: string, options: StorageOptions = {}): T | null {
    if (typeof window === 'undefined') return null;

    // Vérifier le cache mémoire d'abord
    const cached = this.memoryCache.get(key);
    if (cached) {
      if (this.isExpired(cached)) {
        this.memoryCache.delete(key);
      } else {
        return cached.data as T;
      }
    }

    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;

      const data = options.compress ? this.decompress(stored) : JSON.parse(stored);
      
      // Mettre en cache mémoire
      this.memoryCache.set(key, {
        data,
        timestamp: Date.now(),
        ttl: options.ttl,
      });
      this.cleanMemoryCache();

      return data as T;
    } catch (error) {
      console.error(`[StorageService] Error reading key "${key}":`, error);
      return null;
    }
  }

  /**
   * Sauvegarde une valeur dans le storage (avec debounce)
   */
  set(key: string, value: any, options: StorageOptions = {}): boolean {
    if (typeof window === 'undefined') return false;

    const debounceMs = options.debounceMs ?? this.DEFAULT_DEBOUNCE_MS;

    // Annuler l'écriture précédente en attente
    const existing = this.writeQueue.get(key);
    if (existing) {
      clearTimeout(existing.timeout);
    }

    // Programmer l'écriture avec debounce
    const timeout = setTimeout(() => {
      try {
        const serialized = options.compress 
          ? this.compress(value)
          : JSON.stringify(value);

        // Vérifier la taille (localStorage limite ~5-10MB)
        if (serialized.length > 5000000) { // 5MB
          console.warn(`[StorageService] Data too large for key "${key}" (${serialized.length} bytes)`);
          this.writeQueue.delete(key);
          return;
        }

        localStorage.setItem(key, serialized);
        
        // Mettre à jour le cache mémoire
        this.memoryCache.set(key, {
          data: value,
          timestamp: Date.now(),
          ttl: options.ttl,
        });
        this.cleanMemoryCache();

        this.writeQueue.delete(key);
      } catch (error: any) {
        // Gérer les erreurs de quota
        if (error.name === 'QuotaExceededError' || error.code === 22) {
          console.error(`[StorageService] Quota exceeded for key "${key}". Clearing old entries...`);
          // Nettoyer les anciennes entrées
          this.clearOldEntries();
          // Réessayer une fois
          try {
            localStorage.setItem(key, options.compress ? this.compress(value) : JSON.stringify(value));
          } catch (retryError) {
            console.error(`[StorageService] Failed to save after cleanup:`, retryError);
          }
        } else {
          console.error(`[StorageService] Error writing key "${key}":`, error);
        }
        this.writeQueue.delete(key);
      }
    }, debounceMs);

    this.writeQueue.set(key, { data: value, timeout });
    return true;
  }

  /**
   * Supprime une clé du storage
   */
  remove(key: string): void {
    if (typeof window === 'undefined') return;

    // Annuler toute écriture en attente
    const existing = this.writeQueue.get(key);
    if (existing) {
      clearTimeout(existing.timeout);
      this.writeQueue.delete(key);
    }

    // Supprimer du cache mémoire
    this.memoryCache.delete(key);

    // Supprimer du localStorage
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`[StorageService] Error removing key "${key}":`, error);
    }
  }

  /**
   * Nettoie les anciennes entrées pour libérer de l'espace
   */
  private clearOldEntries(): void {
    try {
      const keys = Object.keys(localStorage);
      const now = Date.now();
      
      // Supprimer les entrées avec préfixe "nexus-" qui sont anciennes
      for (const key of keys) {
        if (key.startsWith('nexus-')) {
          try {
            const value = localStorage.getItem(key);
            if (value) {
              // Vérifier si c'est une entrée avec timestamp
              const parsed = JSON.parse(value);
              if (parsed._timestamp && (now - parsed._timestamp > 30 * 24 * 60 * 60 * 1000)) {
                // Plus de 30 jours
                localStorage.removeItem(key);
              }
            }
          } catch {
            // Ignorer les erreurs de parsing
          }
        }
      }
    } catch (error) {
      console.error('[StorageService] Error clearing old entries:', error);
    }
  }

  /**
   * Vide tout le cache mémoire
   */
  clearMemoryCache(): void {
    this.memoryCache.clear();
  }

  /**
   * Force l'écriture immédiate de toutes les valeurs en attente
   */
  flush(): void {
    for (const [key, { data, timeout }] of this.writeQueue.entries()) {
      clearTimeout(timeout);
      const options: StorageOptions = {}; // Utiliser options par défaut
      this.set(key, data, { ...options, debounceMs: 0 });
    }
  }

  /**
   * Récupère toutes les clés avec un préfixe
   */
  getKeys(prefix: string): string[] {
    if (typeof window === 'undefined') return [];
    
    const keys: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keys.push(key);
        }
      }
    } catch (error) {
      console.error(`[StorageService] Error getting keys with prefix "${prefix}":`, error);
    }
    return keys;
  }

  /**
   * Récupère la taille approximative utilisée
   */
  getSize(): number {
    if (typeof window === 'undefined') return 0;
    
    let total = 0;
    try {
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          total += localStorage.getItem(key)?.length || 0;
          total += key.length;
        }
      }
    } catch (error) {
      console.error('[StorageService] Error calculating size:', error);
    }
    return total;
  }
}

// Export singleton
export const storageService = new StorageService();
