/**
 * Service de cache multi-niveaux pour YouTube API
 * Architecture QUOTA-FIRST : L1 (mémoire) + L2 (Firebase)
 * 
 * Principe : L'API YouTube ne doit JAMAIS être appelée directement par l'utilisateur final.
 * Tout passe par le cache.
 */

import { getDb } from './firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  Timestamp,
  serverTimestamp 
} from 'firebase/firestore';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface CachedYouTubeVideo {
  id: string;
  videoId: string;
  title: string;
  description?: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  duration?: number;
  viewCount?: number;
  likeCount?: number;
  thumbnailUrl: string;
  thumbnailHighUrl?: string;
  tags?: string[];
  categoryId?: string;
  // Métadonnées de cache
  cachedAt: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessed: Date;
}

export interface CachedYouTubeSearch {
  id: string; // hash de la query
  query: string;
  results: CachedYouTubeVideo[];
  cachedAt: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessed: Date;
}

export interface CachedYouTubeChannel {
  id: string;
  channelId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  videoCount?: number;
  subscriberCount?: number;
  cachedAt: Date;
  expiresAt: Date;
}

// ============================================
// L1 CACHE (Mémoire - RAM)
// ============================================

class L1Cache {
  private videoCache = new Map<string, CachedYouTubeVideo>();
  private searchCache = new Map<string, CachedYouTubeSearch>();
  private channelCache = new Map<string, CachedYouTubeChannel>();
  
  // TTL par type (en millisecondes)
  private readonly TTL_VIDEO = 12 * 60 * 60 * 1000; // 12h
  private readonly TTL_SEARCH = 7 * 24 * 60 * 60 * 1000; // 7 jours
  private readonly TTL_CHANNEL = 24 * 60 * 60 * 1000; // 24h
  
  // Max size pour éviter la surcharge mémoire
  private readonly MAX_VIDEOS = 1000;
  private readonly MAX_SEARCHES = 500;
  private readonly MAX_CHANNELS = 200;

  getVideo(videoId: string): CachedYouTubeVideo | null {
    const cached = this.videoCache.get(videoId);
    if (!cached) return null;
    
    // Vérifier expiration
    if (new Date() > cached.expiresAt) {
      this.videoCache.delete(videoId);
      return null;
    }
    
    // Mettre à jour les stats
    cached.accessCount++;
    cached.lastAccessed = new Date();
    
    return cached;
  }

  setVideo(video: CachedYouTubeVideo): void {
    // Nettoyer si trop plein
    if (this.videoCache.size >= this.MAX_VIDEOS) {
      // Supprimer les moins utilisés
      const sorted = Array.from(this.videoCache.entries())
        .sort((a, b) => a[1].accessCount - b[1].accessCount);
      sorted.slice(0, Math.floor(this.MAX_VIDEOS * 0.1)).forEach(([id]) => {
        this.videoCache.delete(id);
      });
    }
    
    this.videoCache.set(video.videoId, video);
  }

  getSearch(queryHash: string): CachedYouTubeSearch | null {
    const cached = this.searchCache.get(queryHash);
    if (!cached) return null;
    
    if (new Date() > cached.expiresAt) {
      this.searchCache.delete(queryHash);
      return null;
    }
    
    cached.accessCount++;
    cached.lastAccessed = new Date();
    
    return cached;
  }

  setSearch(queryHash: string, search: CachedYouTubeSearch): void {
    if (this.searchCache.size >= this.MAX_SEARCHES) {
      const sorted = Array.from(this.searchCache.entries())
        .sort((a, b) => a[1].accessCount - b[1].accessCount);
      sorted.slice(0, Math.floor(this.MAX_SEARCHES * 0.1)).forEach(([id]) => {
        this.searchCache.delete(id);
      });
    }
    
    this.searchCache.set(queryHash, search);
  }

  getChannel(channelId: string): CachedYouTubeChannel | null {
    const cached = this.channelCache.get(channelId);
    if (!cached) return null;
    
    if (new Date() > cached.expiresAt) {
      this.channelCache.delete(channelId);
      return null;
    }
    
    return cached;
  }

  setChannel(channel: CachedYouTubeChannel): void {
    if (this.channelCache.size >= this.MAX_CHANNELS) {
      const sorted = Array.from(this.channelCache.entries())
        .sort((a, b) => {
          const aExp = a[1].expiresAt.getTime();
          const bExp = b[1].expiresAt.getTime();
          return aExp - bExp;
        });
      sorted.slice(0, Math.floor(this.MAX_CHANNELS * 0.1)).forEach(([id]) => {
        this.channelCache.delete(id);
      });
    }
    
    this.channelCache.set(channel.channelId, channel);
  }

  clear(): void {
    this.videoCache.clear();
    this.searchCache.clear();
    this.channelCache.clear();
  }
}

// ============================================
// L2 CACHE (Firebase Firestore)
// ============================================

class L2Cache {
  private readonly COLLECTION_VIDEOS = 'youtube_cache_videos';
  private readonly COLLECTION_SEARCHES = 'youtube_cache_searches';
  private readonly COLLECTION_CHANNELS = 'youtube_cache_channels';
  
  // TTL par type (en millisecondes)
  private readonly TTL_VIDEO = 72 * 60 * 60 * 1000; // 72h
  private readonly TTL_SEARCH = 30 * 24 * 60 * 60 * 1000; // 30 jours
  private readonly TTL_CHANNEL = 48 * 60 * 60 * 1000; // 48h

  private getDb() {
    const db = getDb();
    if (!db) {
      throw new Error('Firebase not initialized');
    }
    return db;
  }

  async getVideo(videoId: string): Promise<CachedYouTubeVideo | null> {
    try {
      const db = this.getDb();
      const docRef = doc(db, this.COLLECTION_VIDEOS, videoId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) return null;
      
      const data = docSnap.data();
      const expiresAt = data.expiresAt?.toDate();
      
      // Vérifier expiration
      if (expiresAt && new Date() > expiresAt) {
        // Supprimer le document expiré
        await setDoc(docRef, { expired: true }, { merge: true });
        return null;
      }
      
      // Convertir en CachedYouTubeVideo
      const video: CachedYouTubeVideo = {
        id: data.id,
        videoId: data.videoId,
        title: data.title,
        description: data.description,
        channelTitle: data.channelTitle,
        channelId: data.channelId,
        publishedAt: data.publishedAt,
        duration: data.duration,
        viewCount: data.viewCount,
        likeCount: data.likeCount,
        thumbnailUrl: data.thumbnailUrl,
        thumbnailHighUrl: data.thumbnailHighUrl,
        tags: data.tags,
        categoryId: data.categoryId,
        cachedAt: data.cachedAt?.toDate() || new Date(),
        expiresAt: expiresAt || new Date(),
        accessCount: (data.accessCount || 0) + 1,
        lastAccessed: new Date(),
      };
      
      // Mettre à jour les stats
      await setDoc(docRef, {
        accessCount: video.accessCount,
        lastAccessed: serverTimestamp(),
      }, { merge: true });
      
      return video;
    } catch (error) {
      console.error('[L2Cache] Erreur getVideo:', error);
      return null;
    }
  }

  /**
   * Supprime les champs undefined d'un objet (Firestore n'accepte pas undefined)
   */
  private removeUndefinedFields(obj: any): any {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  async setVideo(video: CachedYouTubeVideo): Promise<void> {
    try {
      const db = this.getDb();
      const docRef = doc(db, this.COLLECTION_VIDEOS, video.videoId);
      
      // Compresser les données volumineuses (description, tags) pour économiser l'espace Firestore
      const dataToSave: any = {
        id: video.id,
        videoId: video.videoId,
        title: video.title,
        description: video.description && video.description.length > 500 
          ? video.description.substring(0, 500) + '...' // Tronquer descriptions longues
          : video.description,
        channelTitle: video.channelTitle,
        channelId: video.channelId,
        publishedAt: video.publishedAt,
        duration: video.duration,
        viewCount: video.viewCount,
        likeCount: video.likeCount, // Peut être undefined
        thumbnailUrl: video.thumbnailUrl,
        thumbnailHighUrl: video.thumbnailHighUrl,
        tags: video.tags && video.tags.length > 10 
          ? video.tags.slice(0, 10) // Limiter tags à 10
          : video.tags,
        categoryId: video.categoryId,
        cachedAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(video.expiresAt),
        lastAccessed: serverTimestamp(),
        accessCount: video.accessCount || 0,
      };
      
      // Supprimer les champs undefined (Firestore ne les accepte pas)
      const cleanedData = this.removeUndefinedFields(dataToSave);
      
      await setDoc(docRef, cleanedData);
    } catch (error) {
      console.error('[L2Cache] Erreur setVideo:', error);
    }
  }

  async getSearch(queryHash: string): Promise<CachedYouTubeSearch | null> {
    try {
      const db = this.getDb();
      const docRef = doc(db, this.COLLECTION_SEARCHES, queryHash);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) return null;
      
      const data = docSnap.data();
      const expiresAt = data.expiresAt?.toDate();
      
      if (expiresAt && new Date() > expiresAt) {
        return null;
      }
      
      const search: CachedYouTubeSearch = {
        id: data.id,
        query: data.query,
        results: data.results || [],
        cachedAt: data.cachedAt?.toDate() || new Date(),
        expiresAt: expiresAt || new Date(),
        accessCount: (data.accessCount || 0) + 1,
        lastAccessed: new Date(),
      };
      
      await setDoc(docRef, {
        accessCount: search.accessCount,
        lastAccessed: serverTimestamp(),
      }, { merge: true });
      
      return search;
    } catch (error) {
      console.error('[L2Cache] Erreur getSearch:', error);
      return null;
    }
  }

  async setSearch(queryHash: string, search: CachedYouTubeSearch): Promise<void> {
    try {
      const db = this.getDb();
      const docRef = doc(db, this.COLLECTION_SEARCHES, queryHash);
      
      // Compresser les résultats: limiter à 50 vidéos max et tronquer descriptions
      // ET supprimer les champs undefined de chaque vidéo
      const compressedResults = search.results.slice(0, 50).map(video => {
        const cleaned = {
          id: video.id,
          videoId: video.videoId,
          title: video.title,
          description: video.description && video.description.length > 200 
            ? video.description.substring(0, 200) + '...'
            : video.description,
          channelTitle: video.channelTitle,
          channelId: video.channelId,
          publishedAt: video.publishedAt,
          duration: video.duration,
          viewCount: video.viewCount,
          likeCount: video.likeCount,
          thumbnailUrl: video.thumbnailUrl,
          thumbnailHighUrl: video.thumbnailHighUrl,
          tags: video.tags,
          categoryId: video.categoryId,
        };
        // Supprimer les undefined
        return this.removeUndefinedFields(cleaned);
      });
      
      const dataToSave = {
        id: search.id,
        query: search.query,
        results: compressedResults, // Résultats compressés et nettoyés
        cachedAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(search.expiresAt),
        lastAccessed: serverTimestamp(),
        accessCount: search.accessCount || 0,
      };
      
      // Supprimer les undefined au niveau racine aussi
      const cleanedData = this.removeUndefinedFields(dataToSave);
      
      await setDoc(docRef, cleanedData);
    } catch (error) {
      console.error('[L2Cache] Erreur setSearch:', error);
    }
  }

  async getChannel(channelId: string): Promise<CachedYouTubeChannel | null> {
    try {
      const db = this.getDb();
      const docRef = doc(db, this.COLLECTION_CHANNELS, channelId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) return null;
      
      const data = docSnap.data();
      const expiresAt = data.expiresAt?.toDate();
      
      if (expiresAt && new Date() > expiresAt) {
        return null;
      }
      
      return {
        id: data.id,
        channelId: data.channelId,
        title: data.title,
        description: data.description,
        thumbnailUrl: data.thumbnailUrl,
        videoCount: data.videoCount,
        subscriberCount: data.subscriberCount,
        cachedAt: data.cachedAt?.toDate() || new Date(),
        expiresAt: expiresAt || new Date(),
      };
    } catch (error) {
      console.error('[L2Cache] Erreur getChannel:', error);
      return null;
    }
  }

  async setChannel(channel: CachedYouTubeChannel): Promise<void> {
    try {
      const db = this.getDb();
      const docRef = doc(db, this.COLLECTION_CHANNELS, channel.channelId);
      
      const dataToSave = {
        id: channel.id,
        channelId: channel.channelId,
        title: channel.title,
        description: channel.description,
        thumbnailUrl: channel.thumbnailUrl,
        videoCount: channel.videoCount,
        subscriberCount: channel.subscriberCount,
        cachedAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(channel.expiresAt),
      };
      
      // Supprimer les undefined
      const cleanedData = this.removeUndefinedFields(dataToSave);
      
      await setDoc(docRef, cleanedData);
    } catch (error) {
      console.error('[L2Cache] Erreur setChannel:', error);
    }
  }
}

// ============================================
// SERVICE PRINCIPAL
// ============================================

class YouTubeCacheService {
  private l1Cache = new L1Cache();
  private l2Cache = new L2Cache();
  
  // TTL par défaut
  private readonly TTL_VIDEO = 12 * 60 * 60 * 1000; // 12h
  private readonly TTL_SEARCH = 7 * 24 * 60 * 60 * 1000; // 7 jours
  private readonly TTL_CHANNEL = 24 * 60 * 60 * 1000; // 24h
  
  /**
   * TTL adaptatif selon popularité (viewCount)
   * Vidéos populaires = TTL long (7 jours)
   * Vidéos rares = TTL court (12h)
   */
  private getAdaptiveTTL(viewCount?: number): number {
    if (!viewCount) return this.TTL_VIDEO;
    
    // Seuils de popularité
    const POPULAR_THRESHOLD = 1_000_000; // 1M vues = populaire
    const VERY_POPULAR_THRESHOLD = 10_000_000; // 10M vues = très populaire
    
    if (viewCount >= VERY_POPULAR_THRESHOLD) {
      return 7 * 24 * 60 * 60 * 1000; // 7 jours
    } else if (viewCount >= POPULAR_THRESHOLD) {
      return 3 * 24 * 60 * 60 * 1000; // 3 jours
    } else {
      return this.TTL_VIDEO; // 12h par défaut
    }
  }

  /**
   * Hash une query pour l'utiliser comme clé de cache (optimisé avec crypto.subtle si disponible)
   */
  private async hashQuery(query: string): Promise<string> {
    // Normaliser la query (lowercase, trim)
    const normalized = query.toLowerCase().trim();
    
    // Utiliser crypto.subtle si disponible (plus performant et sécurisé)
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(normalized);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return `search_${hashHex.substring(0, 16)}`; // Utiliser les 16 premiers caractères
      } catch (error) {
        // Fallback si crypto.subtle échoue
        console.warn('[YouTubeCache] crypto.subtle failed, using simple hash:', error);
      }
    }
    
    // Fallback: Simple hash (compatible partout)
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `search_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Récupère une vidéo depuis le cache (L1 puis L2)
   */
  async getVideo(videoId: string): Promise<CachedYouTubeVideo | null> {
    // L1 Cache (mémoire)
    const l1Result = this.l1Cache.getVideo(videoId);
    if (l1Result) {
      console.log(`[YouTubeCache] L1 HIT: ${videoId}`);
      return l1Result;
    }
    
    // L2 Cache (Firebase)
    const l2Result = await this.l2Cache.getVideo(videoId);
    if (l2Result) {
      console.log(`[YouTubeCache] L2 HIT: ${videoId}`);
      // Mettre en L1 pour accès rapide
      this.l1Cache.setVideo(l2Result);
      return l2Result;
    }
    
    console.log(`[YouTubeCache] MISS: ${videoId}`);
    return null;
  }

  /**
   * Met en cache une vidéo (L1 et L2)
   */
  async setVideo(video: Omit<CachedYouTubeVideo, 'cachedAt' | 'expiresAt' | 'accessCount' | 'lastAccessed'>): Promise<void> {
    const now = new Date();
    // TTL adaptatif selon popularité
    const ttl = this.getAdaptiveTTL(video.viewCount);
    const cached: CachedYouTubeVideo = {
      ...video,
      cachedAt: now,
      expiresAt: new Date(now.getTime() + ttl),
      accessCount: 0,
      lastAccessed: now,
    };
    
    // Mettre en L1 et L2 en parallèle
    this.l1Cache.setVideo(cached);
    await this.l2Cache.setVideo(cached);
  }

  /**
   * Récupère une recherche depuis le cache
   */
  async getSearch(query: string): Promise<CachedYouTubeSearch | null> {
    const queryHash = await this.hashQuery(query);
    
    // L1
    const l1Result = this.l1Cache.getSearch(queryHash);
    if (l1Result) {
      console.log(`[YouTubeCache] L1 HIT search: ${query}`);
      return l1Result;
    }
    
    // L2
    const l2Result = await this.l2Cache.getSearch(queryHash);
    if (l2Result) {
      console.log(`[YouTubeCache] L2 HIT search: ${query}`);
      this.l1Cache.setSearch(queryHash, l2Result);
      return l2Result;
    }
    
    console.log(`[YouTubeCache] MISS search: ${query}`);
    return null;
  }

  /**
   * Met en cache une recherche (optimisé: cache les vidéos individuellement aussi)
   */
  async setSearch(query: string, results: CachedYouTubeVideo[]): Promise<void> {
    const queryHash = await this.hashQuery(query);
    
    // Mettre en cache les vidéos individuellement aussi (pour réutilisation future)
    // Cela permet de réutiliser les vidéos dans d'autres recherches sans appeler l'API
    const videoPromises = results.map(video => 
      this.setVideo(video).catch(err => {
        console.warn(`[YouTubeCache] Failed to cache individual video ${video.videoId}:`, err);
      })
    );
    // Ne pas attendre la fin pour continuer
    Promise.all(videoPromises).catch(() => {
      // Ignorer les erreurs individuelles
    });
    const now = new Date();
    
    const cached: CachedYouTubeSearch = {
      id: queryHash,
      query,
      results,
      cachedAt: now,
      expiresAt: new Date(now.getTime() + this.TTL_SEARCH),
      accessCount: 0,
      lastAccessed: now,
    };
    
    this.l1Cache.setSearch(queryHash, cached);
    await this.l2Cache.setSearch(queryHash, cached);
  }

  /**
   * Récupère une chaîne depuis le cache
   */
  async getChannel(channelId: string): Promise<CachedYouTubeChannel | null> {
    const l1Result = this.l1Cache.getChannel(channelId);
    if (l1Result) return l1Result;
    
    const l2Result = await this.l2Cache.getChannel(channelId);
    if (l2Result) {
      this.l1Cache.setChannel(l2Result);
      return l2Result;
    }
    
    return null;
  }

  /**
   * Met en cache une chaîne
   */
  async setChannel(channel: Omit<CachedYouTubeChannel, 'cachedAt' | 'expiresAt'>): Promise<void> {
    const now = new Date();
    const cached: CachedYouTubeChannel = {
      ...channel,
      cachedAt: now,
      expiresAt: new Date(now.getTime() + this.TTL_CHANNEL),
    };
    
    this.l1Cache.setChannel(cached);
    await this.l2Cache.setChannel(cached);
  }

  /**
   * Nettoie le cache L1 (mémoire)
   */
  clearL1(): void {
    this.l1Cache.clear();
  }
}

// Export singleton
export const youtubeCacheService = new YouTubeCacheService();
