/**
 * Tests unitaires pour YouTubeService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { youtubeService } from '../youtube-service';
import { youtubeProvider } from '../youtube-provider';
import { youtubeCacheService } from '../youtube-cache';
import { youtubeQuotaManager } from '../youtube-quota-manager';

// Mock des dépendances
vi.mock('../youtube-provider');
vi.mock('../youtube-cache');
// Note: do NOT mock the quota manager here because some tests rely on its real behavior (recordFailure/recordSuccess)
// vi.mock('../youtube-quota-manager');
vi.mock('../youtube-batch');
vi.mock('../youtube-prefetch');

describe('YouTubeService', () => {
  beforeEach(() => {
    // Clear mocks and restore spies to avoid cross-test interference
    vi.clearAllMocks();
    vi.restoreAllMocks();

    // Provide a default localStorage mock with clear for tests
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn(() => null),
          setItem: vi.fn(),
          removeItem: vi.fn(),
          clear: vi.fn(),
        },
        writable: true,
      });
    }
  });

  describe('getVideoMetadata', () => {
    it('devrait appeler youtubeProvider.getVideoMetadata', async () => {
      const mockMetadata = {
        success: true,
        metadata: {
          id: 'test-video-id',
          title: 'Test Video',
          channelTitle: 'Test Channel',
          thumbnailUrl: 'https://example.com/thumb.jpg',
        },
        source: 'api' as const,
      };

      vi.mocked(youtubeProvider.getVideoMetadata).mockResolvedValue(mockMetadata);

      const result = await youtubeService.getVideoMetadata('test-video-id');

      expect(youtubeProvider.getVideoMetadata).toHaveBeenCalledWith('test-video-id');
      expect(result).toEqual(mockMetadata);
    });
  });

  describe('searchVideos', () => {
    it('devrait retourner les résultats du cache si disponibles', async () => {
      const mockCachedSearch = {
        id: 'search_hash',
        query: 'test query',
        results: [
          {
            id: 'video1',
            videoId: 'video1',
            title: 'Test Video 1',
            channelTitle: 'Test Channel',
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

      expect(youtubeCacheService.getSearch).toHaveBeenCalledWith('test query');
      expect(result.source).toBe('cache');
      expect(result.results).toHaveLength(1);
      expect(result.results[0].videoId).toBe('video1');
    });

    it('devrait utiliser l\'API si le cache est vide et le quota est disponible', async () => {
      vi.mocked(youtubeCacheService.getSearch).mockResolvedValue(null);
      vi.spyOn(youtubeQuotaManager, 'canUseAPI').mockReturnValue(true as any);
      vi.spyOn(youtubeQuotaManager, 'canSearch').mockReturnValue(true as any);

      // Mock fetch
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              {
                id: { videoId: 'video1' },
                snippet: {
                  title: 'Test Video 1',
                  description: 'Description',
                  channelTitle: 'Test Channel',
                  thumbnails: {
                    high: { url: 'https://example.com/thumb1.jpg' },
                    default: { url: 'https://example.com/thumb1.jpg' },
                  },
                  publishedAt: '2024-01-01',
                },
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 'video1',
                contentDetails: { duration: 'PT2M' },
                statistics: { viewCount: '1000' },
              },
            ],
          }),
        });

      // Mock localStorage
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn(() => 'test-api-key'),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        },
        writable: true,
      });

      const result = await youtubeService.searchVideos('test query');

      expect(result.source).toBe('api');
      expect(result.results).toHaveLength(1);
      expect(result.results[0].videoId).toBe('video1');
    });

    it('devrait utiliser le fallback si le quota est épuisé', async () => {
      // Reset and open circuit
      youtubeQuotaManager.reset();
      youtubeQuotaManager.recordFailure();
      youtubeQuotaManager.recordFailure();
      youtubeQuotaManager.recordFailure();

      // Provide mocked canUseAPI in addition to the opened circuit
      vi.spyOn(youtubeQuotaManager, 'canUseAPI').mockReturnValue(false as any);

      // Mock localStorage with history containing a similar query
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn((key) => {
            if (key === 'nexus-search-history') {
              return JSON.stringify(['test query similar']);
            }
            return null;
          }),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        },
        writable: true,
      });

      // Sequence: first call for main query -> null, second for history -> returns cached results
      vi.mocked(youtubeCacheService.getSearch)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'search_hash',
          query: 'test query similar',
          results: [
            {
              id: 'video1',
              videoId: 'video1',
              title: 'Test Video 1',
              channelTitle: 'Test Channel',
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
        });

      const result = await youtubeService.searchVideos('test query', { fallbackToHistory: true });

      expect(result.source).toBe('fallback');
      expect(result.results.length).toBeGreaterThan(0);
    });
  });

  describe('searchResultToVideo', () => {
    it('devrait convertir un résultat de recherche en Video', () => {
      const searchResult = {
        videoId: 'test-video-id',
        title: 'Test Video',
        description: 'Test Description',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        channelTitle: 'Test Channel',
        publishedAt: '2024-01-01',
        duration: 'PT2M30S',
        viewCount: '1000',
      };

      const video = youtubeService.searchResultToVideo(searchResult);

      expect(video.id).toBe('youtube-test-video-id');
      expect(video.title).toBe('Test Video');
      expect(video.channelTitle).toBe('Test Channel');
      expect(video.duration).toBe(150); // 2 minutes 30 secondes
      expect(video.mediaSource).toBe('youtube');
      expect(video.youtubeVideoId).toBe('test-video-id');
    });
  });

  describe('canPlay', () => {
    it('devrait toujours retourner true', () => {
      vi.mocked(youtubeProvider.canPlay).mockReturnValue(true);

      const result = youtubeService.canPlay('test-video-id');

      expect(result).toBe(true);
      expect(youtubeProvider.canPlay).toHaveBeenCalledWith('test-video-id');
    });
  });

  describe('getSystemStatus', () => {
    it('devrait retourner l\'état du système', () => {
      const mockStatus = {
        quotaState: 'OK' as const,
        canUseAPI: true,
        canPlay: true,
        message: null,
      };

      // Ensure clean quota manager state so provider mock is authoritative for this unit test
      youtubeQuotaManager.reset();
      // Clear previous mocks to avoid interfering mocked canUseAPI from other tests
      vi.clearAllMocks();

      vi.mocked(youtubeProvider.getSystemStatus).mockReturnValue(mockStatus);

      const result = youtubeService.getSystemStatus();

      expect(result).toEqual(mockStatus);
      expect(youtubeProvider.getSystemStatus).toHaveBeenCalled();
    });

    it('deterministic: should reflect circuit breaker state when quota manager opens the circuit', () => {
      // Ensure clean state
      youtubeQuotaManager.reset();

      // Trigger failures to open circuit breaker
      youtubeQuotaManager.recordFailure();
      youtubeQuotaManager.recordFailure();
      youtubeQuotaManager.recordFailure();

      const status = youtubeService.getSystemStatus();

      expect(status.canUseAPI).toBe(false);
      expect(status.quotaState).toBe('EXHAUSTED');
    });
  });
});

