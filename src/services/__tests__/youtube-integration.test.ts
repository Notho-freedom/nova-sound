/**
 * Tests d'intégration pour le système YouTube complet
 * Teste le pipeline complet : cache → oEmbed → API → fallback
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { youtubeService } from '../youtube-service';
import { youtubeProvider } from '../youtube-provider';
import { youtubeCacheService } from '../youtube-cache';
import { youtubeQuotaManager } from '../youtube-quota-manager';

// Mock des dépendances externes
vi.mock('../youtube-provider');
vi.mock('../youtube-cache');
vi.mock('../youtube-quota-manager');

describe('YouTube Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    youtubeQuotaManager.reset();
  });

  describe('Pipeline complet de récupération de métadonnées', () => {
    it('devrait utiliser le cache en priorité', async () => {
      const mockCachedVideo = {
        id: 'test-video',
        videoId: 'test-video',
        title: 'Cached Video',
        channelTitle: 'Cached Channel',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        publishedAt: '2024-01-01',
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000000),
        accessCount: 1,
        lastAccessed: new Date(),
      };

      vi.mocked(youtubeCacheService.getVideo).mockResolvedValue(mockCachedVideo);

      const result = await youtubeService.getVideoMetadata('test-video');

      expect(youtubeCacheService.getVideo).toHaveBeenCalledWith('test-video');
      expect(result.success).toBe(true);
      expect(result.source).toBe('cache');
      expect(result.metadata?.title).toBe('Cached Video');
    });

    it('devrait utiliser oEmbed si le cache est vide et le quota est épuisé', async () => {
      vi.mocked(youtubeCacheService.getVideo).mockResolvedValue(null);
      vi.mocked(youtubeQuotaManager.canUseAPI).mockReturnValue(false);

      const mockOEmbedResult = {
        success: true,
        metadata: {
          id: 'test-video',
          title: 'OEmbed Video',
          channelTitle: 'OEmbed Channel',
          thumbnailUrl: 'https://example.com/thumb.jpg',
        },
        source: 'oembed' as const,
      };

      vi.mocked(youtubeProvider.getVideoMetadata).mockResolvedValue(mockOEmbedResult);

      const result = await youtubeService.getVideoMetadata('test-video');

      expect(result.success).toBe(true);
      expect(result.source).toBe('oembed');
      expect(result.metadata?.title).toBe('OEmbed Video');
    });

    it('devrait utiliser l\'API si le cache est vide et le quota est disponible', async () => {
      vi.mocked(youtubeCacheService.getVideo).mockResolvedValue(null);
      vi.mocked(youtubeQuotaManager.canUseAPI).mockReturnValue(true);
      vi.mocked(youtubeQuotaManager.canGetMetadata).mockReturnValue(true);

      const mockApiResult = {
        success: true,
        metadata: {
          id: 'test-video',
          title: 'API Video',
          channelTitle: 'API Channel',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          duration: 120,
          viewCount: 1000,
        },
        source: 'api' as const,
      };

      vi.mocked(youtubeProvider.getVideoMetadata).mockResolvedValue(mockApiResult);

      const result = await youtubeService.getVideoMetadata('test-video');

      expect(result.success).toBe(true);
      expect(result.source).toBe('api');
      expect(result.metadata?.title).toBe('API Video');
    });

    it('devrait utiliser le fallback si tout échoue', async () => {
      vi.mocked(youtubeCacheService.getVideo).mockResolvedValue(null);
      vi.mocked(youtubeQuotaManager.canUseAPI).mockReturnValue(false);

      const mockFallbackResult = {
        success: true,
        metadata: {
          id: 'test-video',
          title: 'Vidéo YouTube test-video',
          channelTitle: 'YouTube',
          thumbnailUrl: 'https://img.youtube.com/vi/test-video/default.jpg',
        },
        source: 'fallback' as const,
      };

      vi.mocked(youtubeProvider.getVideoMetadata).mockResolvedValue(mockFallbackResult);

      const result = await youtubeService.getVideoMetadata('test-video');

      expect(result.success).toBe(true);
      expect(result.source).toBe('fallback');
      expect(result.metadata?.channelTitle).toBe('YouTube');
    });
  });

  describe('Pipeline complet de recherche', () => {
    it('devrait utiliser le cache de recherche en priorité', async () => {
      const mockCachedSearch = {
        id: 'search_hash',
        query: 'test query',
        results: [
          {
            id: 'video1',
            videoId: 'video1',
            title: 'Cached Video 1',
            channelTitle: 'Channel 1',
            thumbnailUrl: 'https://example.com/thumb1.jpg',
            publishedAt: '2024-01-01',
            duration: 120,
            viewCount: 1000,
          },
        ],
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000000),
        accessCount: 1,
        lastAccessed: new Date(),
      };

      vi.mocked(youtubeCacheService.getSearch).mockResolvedValue(mockCachedSearch);

      const result = await youtubeService.searchVideos('test query');

      expect(result.source).toBe('cache');
      expect(result.results).toHaveLength(1);
      expect(result.results[0].title).toBe('Cached Video 1');
    });

    it('devrait utiliser le fallback historique si le quota est épuisé', async () => {
      vi.mocked(youtubeCacheService.getSearch)
        .mockResolvedValueOnce(null) // Première recherche
        .mockResolvedValueOnce({
          id: 'search_hash',
          query: 'similar query',
          results: [
            {
              id: 'video1',
              videoId: 'video1',
              title: 'Similar Video',
              channelTitle: 'Channel',
              thumbnailUrl: 'https://example.com/thumb.jpg',
              publishedAt: '2024-01-01',
              duration: 120,
              viewCount: 1000,
            },
          ],
          cachedAt: new Date(),
          expiresAt: new Date(Date.now() + 1000000),
          accessCount: 1,
          lastAccessed: new Date(),
        });

      vi.mocked(youtubeQuotaManager.canUseAPI).mockReturnValue(false);

      // Mock localStorage
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn((key) => {
            if (key === 'nexus-search-history') {
              return JSON.stringify(['similar query']);
            }
            return null;
          }),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        },
        writable: true,
      });

      const result = await youtubeService.searchVideos('test query', {
        fallbackToHistory: true,
      });

      expect(result.source).toBe('fallback');
      expect(result.results.length).toBeGreaterThan(0);
    });
  });

  describe('Conversion de formats', () => {
    it('devrait convertir un résultat de recherche en Video', () => {
      const searchResult = {
        videoId: 'test-video',
        title: 'Test Video',
        description: 'Test Description',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        channelTitle: 'Test Channel',
        publishedAt: '2024-01-01',
        duration: 'PT2M30S',
        viewCount: '1000',
      };

      const video = youtubeService.searchResultToVideo(searchResult);

      expect(video.id).toBe('youtube-test-video');
      expect(video.title).toBe('Test Video');
      expect(video.channelTitle).toBe('Test Channel');
      expect(video.duration).toBe(150);
      expect(video.mediaSource).toBe('youtube');
      expect(video.youtubeVideoId).toBe('test-video');
    });

    it('devrait convertir un résultat de recherche en Track', () => {
      const searchResult = {
        videoId: 'test-video',
        title: 'Artist - Song Title',
        description: 'Test Description',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        channelTitle: 'Test Channel',
        publishedAt: '2024-01-01',
        duration: 'PT3M45S',
        viewCount: '5000',
      };

      const track = youtubeService.searchResultToTrack(searchResult);

      expect(track.id).toBe('youtube-audio-test-video');
      expect(track.artist).toBe('Artist');
      expect(track.title).toBe('Song Title');
      expect(track.mediaSource).toBe('youtube');
      expect(track.youtubeVideoId).toBe('test-video');
    });
  });

  describe('Gestion du quota et circuit breaker', () => {
    it('devrait respecter le circuit breaker', async () => {
      // Ouvrir le circuit breaker
      youtubeQuotaManager.recordFailure();
      youtubeQuotaManager.recordFailure();
      youtubeQuotaManager.recordFailure();

      vi.mocked(youtubeQuotaManager.canUseAPI).mockReturnValue(false);
      vi.mocked(youtubeCacheService.getVideo).mockResolvedValue(null);

      const status = youtubeService.getSystemStatus();

      expect(status.canUseAPI).toBe(false);
      expect(status.quotaState).toBe('EXHAUSTED');
    });

    it('devrait fermer le circuit breaker après un succès', async () => {
      // Ouvrir le circuit breaker
      youtubeQuotaManager.recordFailure();
      youtubeQuotaManager.recordFailure();
      youtubeQuotaManager.recordFailure();

      // Enregistrer un succès
      youtubeQuotaManager.recordSuccess();

      vi.mocked(youtubeQuotaManager.canUseAPI).mockReturnValue(true);

      const status = youtubeService.getSystemStatus();

      expect(status.canUseAPI).toBe(true);
    });
  });

  describe('Préchargement', () => {
    it('devrait précharger les tendances', async () => {
      const { youtubePrefetchService } = await import('../youtube-prefetch');
      const prefetchSpy = vi.spyOn(youtubePrefetchService, 'prefetchTrending');

      await youtubeService.prefetchTrending(25);

      expect(prefetchSpy).toHaveBeenCalledWith(25);
    });
  });
});

