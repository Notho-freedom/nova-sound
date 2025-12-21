/**
 * Gestionnaire de cache pour les images d'artistes
 * Utilise localStorage avec compression et TTL
 */

import type { ArtistImage, CacheEntry } from '@/types/artist-image';

const CACHE_PREFIX = 'nexus_artist_image_';
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 jours

export class CacheManager {
  private ttl: number;
  private maxSize: number; // Taille max en MB

  constructor(ttl: number = DEFAULT_TTL, maxSize: number = 50) {
    this.ttl = ttl;
    this.maxSize = maxSize;
  }

  /**
   * Génère une clé de cache à partir d'une requête
   */
  private getCacheKey(query: string, source?: string): string {
    const normalizedQuery = query.toLowerCase().trim();
    const key = source 
      ? `${CACHE_PREFIX}${source}_${normalizedQuery}`
      : `${CACHE_PREFIX}${normalizedQuery}`;
    return key;
  }

  /**
   * Récupère une entrée du cache
   */
  get(query: string, source?: string): ArtistImage[] | null {
    try {
      const key = this.getCacheKey(query, source);
      const cached = localStorage.getItem(key);

      if (!cached) {
        return null;
      }

      const entry: CacheEntry = JSON.parse(cached);

      // Vérifier l'expiration
      if (new Date(entry.expiresAt) < new Date()) {
        localStorage.removeItem(key);
        return null;
      }

      return entry.images;
    } catch (error) {
      console.error('[CacheManager] Get error:', error);
      return null;
    }
  }

  /**
   * Stocke une entrée dans le cache
   */
  set(query: string, images: ArtistImage[], source: string): void {
    try {
      const key = this.getCacheKey(query, source);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.ttl);

      const entry: CacheEntry = {
        query,
        images,
        source: source as any,
        cachedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      // Vérifier la taille avant d'ajouter
      const entrySize = JSON.stringify(entry).length;
      const currentSize = this.getCacheSize();

      if (currentSize + entrySize > this.maxSize * 1024 * 1024) {
        // Nettoyer les entrées expirées
        this.cleanExpired();
        
        // Si toujours trop gros, supprimer les plus anciennes
        if (this.getCacheSize() + entrySize > this.maxSize * 1024 * 1024) {
          this.cleanOldest();
        }
      }

      localStorage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      console.error('[CacheManager] Set error:', error);
      // Si erreur de quota, nettoyer et réessayer
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.cleanExpired();
        this.cleanOldest();
      }
    }
  }

  /**
   * Calcule la taille actuelle du cache
   */
  private getCacheSize(): number {
    let size = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        const value = localStorage.getItem(key);
        if (value) {
          size += key.length + value.length;
        }
      }
    }
    return size;
  }

  /**
   * Nettoie les entrées expirées
   */
  private cleanExpired(): void {
    const now = new Date();
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        try {
          const entry: CacheEntry = JSON.parse(localStorage.getItem(key) || '{}');
          if (new Date(entry.expiresAt) < now) {
            keysToRemove.push(key);
          }
        } catch {
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }

  /**
   * Nettoie les entrées les plus anciennes
   */
  private cleanOldest(): void {
    const entries: Array<{ key: string; cachedAt: string }> = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        try {
          const entry: CacheEntry = JSON.parse(localStorage.getItem(key) || '{}');
          entries.push({ key, cachedAt: entry.cachedAt });
        } catch {
          // Ignorer les entrées invalides
        }
      }
    }

    // Trier par date (plus anciennes en premier)
    entries.sort((a, b) => 
      new Date(a.cachedAt).getTime() - new Date(b.cachedAt).getTime()
    );

    // Supprimer les 25% les plus anciennes
    const toRemove = Math.ceil(entries.length * 0.25);
    entries.slice(0, toRemove).forEach((entry) => {
      localStorage.removeItem(entry.key);
    });
  }

  /**
   * Vide tout le cache
   */
  clear(): void {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }
}

