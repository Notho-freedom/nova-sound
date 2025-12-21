/**
 * Service de préchargement intelligent des suggestions YouTube
 * Précharge les suggestions populaires au démarrage et en arrière-plan
 */

import { youtubeCacheService } from './youtube-cache';
import { fetchYouTubeTrending, fetchYouTubeSuggestionsFromHistory } from '@/lib/youtube-suggestions';
import type { HistoryEntry } from '@/hooks/usePlayHistory';
import type { Track, Video } from '@/types/music';

class YouTubePrefetchService {
  private prefetchInProgress = false;
  private prefetchedQueries = new Set<string>();

  /**
   * Précharge les suggestions tendances au démarrage
   */
  async prefetchTrending(maxResults: number = 25): Promise<void> {
    if (this.prefetchInProgress) {
      console.log('[YouTubePrefetch] Préchargement déjà en cours, ignoré');
      return;
    }

    this.prefetchInProgress = true;

    try {
      console.log('[YouTubePrefetch] Démarrage préchargement tendances...');
      
      // Vérifier le cache d'abord
      const cached = await youtubeCacheService.getSearch('trending');
      if (cached && cached.results.length > 0) {
        console.log('[YouTubePrefetch] Tendances déjà en cache, ignoré');
        this.prefetchInProgress = false;
        return;
      }

      // Charger les tendances
      const trending = await fetchYouTubeTrending(maxResults);
      
      if (trending.length > 0) {
        // Mettre en cache - setSearch accepte des vidéos partielles et ajoute les métadonnées de cache
        const videosForCache = trending.map(s => ({
          id: s.videoId,
          videoId: s.videoId,
          title: s.title,
          description: s.description,
          channelTitle: s.channelTitle,
          channelId: '',
          publishedAt: s.publishedAt,
          duration: s.duration,
          viewCount: s.viewCount,
          thumbnailUrl: s.thumbnailUrl,
        }));
        // Cast as any car setSearch ajoute les propriétés de cache automatiquement
        await youtubeCacheService.setSearch('trending', videosForCache as any);
        console.log(`[YouTubePrefetch] ✅ ${trending.length} tendances préchargées`);
      }
    } catch (error) {
      console.error('[YouTubePrefetch] Erreur préchargement tendances:', error);
    } finally {
      this.prefetchInProgress = false;
    }
  }

  /**
   * Précharge les suggestions basées sur l'historique (en arrière-plan)
   */
  async prefetchFromHistory(
    audioHistory: HistoryEntry[],
    audioTracks: Track[],
    youtubeVideos: Video[],
    searchHistory: string[] = []
  ): Promise<void> {
    if (audioHistory.length === 0 && youtubeVideos.length === 0 && searchHistory.length === 0) {
      return; // Pas assez de données
    }

    try {
      // Générer des queries de préchargement basées sur l'historique
      const queries: string[] = [];

      // Top 3 artistes les plus écoutés
      const artistCounts = new Map<string, number>();
      audioHistory.forEach(entry => {
        const track = audioTracks.find(t => t.id === entry.trackId);
        if (track) {
          const count = artistCounts.get(track.artist) || 0;
          artistCounts.set(track.artist, count + (entry.playCount || 1));
        }
      });

      const topArtists = Array.from(artistCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([artist]) => artist);
      
      queries.push(...topArtists);

      // Top 2 genres
      const genreCounts = new Map<string, number>();
      audioHistory.forEach(entry => {
        const track = audioTracks.find(t => t.id === entry.trackId);
        if (track?.genre) {
          const count = genreCounts.get(track.genre) || 0;
          genreCounts.set(track.genre, count + (entry.playCount || 1));
        }
      });

      const topGenres = Array.from(genreCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([genre]) => genre);
      
      queries.push(...topGenres);

      // Recherches récentes (max 3)
      queries.push(...searchHistory.slice(0, 3));

      // Précharger chaque query (en parallèle mais avec limite)
      const prefetchPromises = queries
        .filter(q => q.trim().length > 0 && !this.prefetchedQueries.has(q))
        .slice(0, 5) // Limiter à 5 queries pour éviter surcharge
        .map(async (query) => {
          try {
            // Vérifier le cache
            const cached = await youtubeCacheService.getSearch(query);
            if (cached && cached.results.length > 0) {
              this.prefetchedQueries.add(query);
              return;
            }

            // Précharger en arrière-plan (sans bloquer)
            setTimeout(async () => {
              try {
                const suggestions = await fetchYouTubeSuggestionsFromHistory(
                  audioHistory,
                  audioTracks,
                  youtubeVideos,
                  [query],
                  10 // Moins de résultats pour préchargement
                );

                if (suggestions.length > 0) {
                  const videosForCache = suggestions.map(s => ({
                    id: s.videoId,
                    videoId: s.videoId,
                    title: s.title,
                    description: s.description,
                    channelTitle: s.channelTitle,
                    channelId: '',
                    publishedAt: s.publishedAt,
                    duration: s.duration,
                    viewCount: s.viewCount,
                    thumbnailUrl: s.thumbnailUrl,
                  }));
                  // Cast as any car setSearch ajoute les propriétés de cache automatiquement
                  await youtubeCacheService.setSearch(query, videosForCache as any);
                  this.prefetchedQueries.add(query);
                  console.log(`[YouTubePrefetch] ✅ Préchargé "${query}" (${suggestions.length} résultats)`);
                }
              } catch (error) {
                console.warn(`[YouTubePrefetch] Erreur préchargement "${query}":`, error);
              }
            }, 1000); // Délai pour ne pas surcharger au démarrage
          } catch (error) {
            console.warn(`[YouTubePrefetch] Erreur vérification cache "${query}":`, error);
          }
        });

      await Promise.allSettled(prefetchPromises);
    } catch (error) {
      console.error('[YouTubePrefetch] Erreur préchargement historique:', error);
    }
  }

  /**
   * Nettoie les queries préchargées
   */
  clearPrefetched(): void {
    this.prefetchedQueries.clear();
  }
}

// Export singleton
export const youtubePrefetchService = new YouTubePrefetchService();
