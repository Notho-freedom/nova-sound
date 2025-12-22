/**
 * Cache unifié pour le système YouTube
 * Gère le cache mémoire et localStorage avec TTL
 */

import type { YouTubeVideo } from './types';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheConfig {
  memoryTTL: number;      // TTL mémoire en ms
  storageTTL: number;     // TTL localStorage en ms
  maxMemoryItems: number; // Limite d'items en mémoire
  maxStorageItems: number; // Limite d'items en storage
}

const DEFAULT_CONFIG: CacheConfig = {
  memoryTTL: 10 * 60 * 1000,       // 10 minutes (augmenté)
  storageTTL: 7 * 24 * 60 * 60 * 1000, // 7 jours (augmenté)
  maxMemoryItems: 200,             // Augmenté
  maxStorageItems: 1000,           // Augmenté
};

class YouTubeCache {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private config: CacheConfig;
  private readonly STORAGE_PREFIX = 'yt_cache_';

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cleanupExpired();
  }

  // ==================== RECHERCHE ====================

  getSearch(query: string): YouTubeVideo[] | null {
    const key = this.getSearchKey(query);
    return this.get<YouTubeVideo[]>(key);
  }

  setSearch(query: string, results: YouTubeVideo[]): void {
    const key = this.getSearchKey(query);
    this.set(key, results);
  }

  private getSearchKey(query: string): string {
    return `search:${query.toLowerCase().trim()}`;
  }

  // ==================== VIDÉO UNIQUE ====================

  getVideo(videoId: string): YouTubeVideo | null {
    const key = this.getVideoKey(videoId);
    return this.get<YouTubeVideo>(key);
  }

  setVideo(video: YouTubeVideo): void {
    if (!video.videoId) return;
    const key = this.getVideoKey(video.videoId);
    this.set(key, video);
  }

  private getVideoKey(videoId: string): string {
    return `video:${videoId}`;
  }

  // ==================== SUGGESTIONS ====================

  getSuggestions(videoId: string): YouTubeVideo[] | null {
    const key = this.getSuggestionsKey(videoId);
    return this.get<YouTubeVideo[]>(key);
  }

  setSuggestions(videoId: string, suggestions: YouTubeVideo[]): void {
    const key = this.getSuggestionsKey(videoId);
    this.set(key, suggestions);
  }

  private getSuggestionsKey(videoId: string): string {
    return `suggestions:${videoId}`;
  }

  // ==================== AUTOCOMPLETE ====================

  getAutocomplete(query: string): string[] | null {
    const key = this.getAutocompleteKey(query);
    return this.get<string[]>(key);
  }

  setAutocomplete(query: string, suggestions: string[]): void {
    const key = this.getAutocompleteKey(query);
    this.set(key, suggestions, { memoryOnly: true }); // Autocomplete en mémoire seulement
  }

  private getAutocompleteKey(query: string): string {
    return `autocomplete:${query.toLowerCase().trim()}`;
  }

  // ==================== POPULAR SUGGESTIONS ====================

  getPopularSuggestions(): string[] | null {
    return this.get<string[]>('popular_suggestions');
  }

  setPopularSuggestions(suggestions: string[]): void {
    this.set('popular_suggestions', suggestions, { storageTTL: 7 * 24 * 60 * 60 * 1000 }); // 7 jours
  }

  // ==================== MÉTHODES GÉNÉRIQUES ====================

  private get<T>(key: string): T | null {
    // 1. Vérifier le cache mémoire
    const memEntry = this.memoryCache.get(key);
    if (memEntry && Date.now() < memEntry.expiresAt) {
      return memEntry.data as T;
    }

    // 2. Vérifier localStorage
    try {
      const stored = localStorage.getItem(this.STORAGE_PREFIX + key);
      if (stored) {
        const entry: CacheEntry<T> = JSON.parse(stored);
        if (Date.now() < entry.expiresAt) {
          // Remettre en cache mémoire
          this.memoryCache.set(key, entry);
          return entry.data;
        } else {
          // Nettoyer l'entrée expirée
          localStorage.removeItem(this.STORAGE_PREFIX + key);
        }
      }
    } catch (e) {
      console.warn('[YouTubeCache] Erreur lecture localStorage:', e);
    }

    return null;
  }

  private set<T>(
    key: string, 
    data: T, 
    options?: { memoryOnly?: boolean; memoryTTL?: number; storageTTL?: number }
  ): void {
    const now = Date.now();
    const memoryTTL = options?.memoryTTL ?? this.config.memoryTTL;
    const storageTTL = options?.storageTTL ?? this.config.storageTTL;

    const memEntry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + memoryTTL,
    };

    // 1. Stocker en mémoire
    this.enforceMemoryLimit();
    this.memoryCache.set(key, memEntry);

    // 2. Stocker en localStorage (sauf si memoryOnly)
    if (!options?.memoryOnly) {
      try {
        const storageEntry: CacheEntry<T> = {
          data,
          timestamp: now,
          expiresAt: now + storageTTL,
        };
        this.enforceStorageLimit();
        localStorage.setItem(this.STORAGE_PREFIX + key, JSON.stringify(storageEntry));
      } catch (e) {
        console.warn('[YouTubeCache] Erreur écriture localStorage:', e);
      }
    }
  }

  private enforceMemoryLimit(): void {
    if (this.memoryCache.size >= this.config.maxMemoryItems) {
      // Supprimer les entrées les plus anciennes
      const entries = Array.from(this.memoryCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toDelete = entries.slice(0, Math.floor(this.config.maxMemoryItems * 0.2));
      toDelete.forEach(([key]) => this.memoryCache.delete(key));
    }
  }

  private enforceStorageLimit(): void {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.STORAGE_PREFIX)) {
          keys.push(key);
        }
      }

      if (keys.length >= this.config.maxStorageItems) {
        // Supprimer les plus anciennes
        const entries = keys.map(key => {
          try {
            const entry = JSON.parse(localStorage.getItem(key) || '{}');
            return { key, timestamp: entry.timestamp || 0 };
          } catch {
            return { key, timestamp: 0 };
          }
        });
        entries.sort((a, b) => a.timestamp - b.timestamp);
        const toDelete = entries.slice(0, Math.floor(this.config.maxStorageItems * 0.2));
        toDelete.forEach(({ key }) => localStorage.removeItem(key));
      }
    } catch (e) {
      console.warn('[YouTubeCache] Erreur gestion limite storage:', e);
    }
  }

  private cleanupExpired(): void {
    // Nettoyer mémoire
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now >= entry.expiresAt) {
        this.memoryCache.delete(key);
      }
    }

    // Nettoyer localStorage
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.STORAGE_PREFIX)) {
          try {
            const entry = JSON.parse(localStorage.getItem(key) || '{}');
            if (now >= entry.expiresAt) {
              localStorage.removeItem(key);
            }
          } catch {
            localStorage.removeItem(key);
          }
        }
      }
    } catch (e) {
      console.warn('[YouTubeCache] Erreur nettoyage localStorage:', e);
    }
  }

  clear(): void {
    this.memoryCache.clear();
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.warn('[YouTubeCache] Erreur clear localStorage:', e);
    }
  }

  getStats(): { memoryItems: number; storageItems: number } {
    let storageItems = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        if (localStorage.key(i)?.startsWith(this.STORAGE_PREFIX)) {
          storageItems++;
        }
      }
    } catch {}
    
    return {
      memoryItems: this.memoryCache.size,
      storageItems,
    };
  }
}

// Singleton
export const youtubeCache = new YouTubeCache();
export { YouTubeCache };
