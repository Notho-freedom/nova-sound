/**
 * Service de prefetch prédictif pour YouTube
 * Précharge les vidéos que l'utilisateur va probablement vouloir voir
 * pour une UX "instantanée" sans consommer de quota en session live
 */

import { youtubeCacheService } from './youtube-cache';
import { youtubeBatchService } from './youtube-batch';
import { youtubeQuotaManager } from './youtube-quota-manager';

interface PrefetchContext {
  currentVideoId?: string;
  currentChannelId?: string;
  watchHistory?: string[];
  searchHistory?: string[];
}

class YouTubePrefetchService {
  private prefetchQueue: string[] = [];
  private isPrefetching = false;

  /**
   * Précharge les vidéos similaires à celle en cours
   */
  async prefetchSimilarVideos(videoId: string, channelId?: string): Promise<void> {
    if (this.isPrefetching) return;
    
    this.isPrefetching = true;
    
    try {
      // Vérifier le quota avant de précharger
      if (!youtubeQuotaManager.canGetMetadata(5)) {
        console.log('[Prefetch] Quota insuffisant pour prefetch');
        return;
      }

      // 1. Vérifier si déjà en cache
      const cached = await youtubeCacheService.getVideo(videoId);
      if (cached) {
        // Déjà en cache, pas besoin de précharger
        return;
      }

      // 2. Précharger la vidéo actuelle si pas en cache
      // (sera fait par le système normal, on skip ici)

      // 3. Précharger les vidéos de la même chaîne (si channelId disponible)
      if (channelId) {
        // TODO: Implémenter la récupération des vidéos de la chaîne
        // Pour l'instant, on skip
      }
    } catch (error) {
      console.error('[Prefetch] Erreur prefetch similar:', error);
    } finally {
      this.isPrefetching = false;
    }
  }

  /**
   * Précharge les vidéos basées sur l'historique
   */
  async prefetchFromHistory(watchHistory: string[], searchHistory: string[]): Promise<void> {
    if (this.isPrefetching) return;
    if (watchHistory.length === 0 && searchHistory.length === 0) return;
    
    this.isPrefetching = true;
    
    try {
      // Vérifier le quota
      const maxPrefetch = Math.min(10, watchHistory.length);
      if (!youtubeQuotaManager.canGetMetadata(maxPrefetch)) {
        console.log('[Prefetch] Quota insuffisant pour prefetch history');
        return;
      }

      // Précharger les vidéos récemment regardées qui ne sont plus en cache
      const toPrefetch: string[] = [];
      
      for (const videoId of watchHistory.slice(0, 10)) {
        const cached = await youtubeCacheService.getVideo(videoId);
        if (!cached) {
          toPrefetch.push(videoId);
        }
      }

      if (toPrefetch.length > 0) {
        // Utiliser le batch service pour précharger en lot
        await youtubeBatchService.getVideosBatch(toPrefetch);
        console.log(`[Prefetch] Préchargé ${toPrefetch.length} vidéos de l'historique`);
      }
    } catch (error) {
      console.error('[Prefetch] Erreur prefetch history:', error);
    } finally {
      this.isPrefetching = false;
    }
  }

  /**
   * Précharge les vidéos suggérées basées sur le contexte
   */
  async prefetchSuggestions(context: PrefetchContext): Promise<void> {
    // Cette fonction sera appelée en arrière-plan
    // pour précharger les suggestions probables
    
    if (this.isPrefetching) return;
    
    // Précharger seulement si on a du quota disponible
    const remaining = youtubeQuotaManager.getRemainingBudget();
    if (remaining.percentage > 50) {
      // On a encore de la marge, on peut précharger
      if (context.watchHistory && context.watchHistory.length > 0) {
        await this.prefetchFromHistory(context.watchHistory, context.searchHistory || []);
      }
    }
  }
}

// Export singleton
export const youtubePrefetchService = new YouTubePrefetchService();
