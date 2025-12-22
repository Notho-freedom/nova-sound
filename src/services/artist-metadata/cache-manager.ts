/**
 * Gestionnaire de cache pour les métadonnées d'artistes/albums
 * Utilise localStorage avec compression et TTL
 */

import type { ArtistMetadata, AlbumMetadata, TrackMetadata, CacheEntry } from '@/types/artist-metadata';

const CACHE_PREFIX = 'nexus_artist_metadata_';
const DEFAULT_TTL = 30 * 24 * 60 * 60 * 1000; // 30 jours

export class MetadataCacheManager {
  private ttl: number;
  private maxSize: number; // Taille max en MB

  constructor(ttl: number = DEFAULT_TTL, maxSize: number = 100) {
    this.ttl = ttl;
    this.maxSize = maxSize;
  }

  /**
   * Génère une clé de cache à partir d'une requête
   */
  private getCacheKey(query: string, type: 'artist' | 'album' | 'track', source?: string): string {
    const normalizedQuery = query.toLowerCase().trim();
    const key = source 
      ? `${CACHE_PREFIX}${type}_${source}_${normalizedQuery}`
      : `${CACHE_PREFIX}${type}_${normalizedQuery}`;
    return key;
  }

  /**
   * Récupère une entrée du cache
   */
  get<T extends ArtistMetadata | AlbumMetadata | TrackMetadata>(
    query: string,
    type: 'artist' | 'album' | 'track',
    source?: string
  ): T | null {
    try {
      const key = this.getCacheKey(query, type, source);
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

      // Retourner les données (peuvent être un tableau ou un objet unique)
      const data = Array.isArray(entry.data) ? entry.data[0] : entry.data;
      return data as T;
    } catch (error) {
      console.error('[MetadataCacheManager] Get error:', error);
      return null;
    }
  }

  /**
   * Stocke une entrée dans le cache
   */
  set(
    query: string,
    data: ArtistMetadata | AlbumMetadata | TrackMetadata | (ArtistMetadata | AlbumMetadata | TrackMetadata)[],
    type: 'artist' | 'album' | 'track',
    source: string
  ): void {
    try {
      const key = this.getCacheKey(query, type, source);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.ttl);

      const entry: CacheEntry = {
        query,
        type,
        data,
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
      console.error('[MetadataCacheManager] Set error:', error);
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

