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
vi.mock('../youtube-quota-manager');
vi.mock('../youtube-batch');
vi.mock('../youtube-prefetch');

describe('YouTubeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset localStorage
    if (typeof window !== 'undefined') {
      localStorage.clear();
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
      vi.mocked(youtubeQuotaManager.canUseAPI).mockReturnValue(true);
      vi.mocked(youtubeQuotaManager.canSearch).mockReturnValue(true);

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
          getItem: jest.fn(() => 'test-api-key'),
          setItem: jest.fn(),
          removeItem: jest.fn(),
        },
        writable: true,
      });

      const result = await youtubeService.searchVideos('test query');

      expect(result.source).toBe('api');
      expect(result.results).toHaveLength(1);
      expect(result.results[0].videoId).toBe('video1');
    });

    it('devrait utiliser le fallback si le quota est épuisé', async () => {
      (youtubeCacheService.getSearch as jest.Mock).mockResolvedValue(null);
      (youtubeQuotaManager.canUseAPI as jest.Mock).mockReturnValue(false);

      // Mock localStorage avec historique
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: jest.fn((key) => {
            if (key === 'nexus-search-history') {
              return JSON.stringify(['test query similar']);
            }
            return null;
          }),
          setItem: jest.fn(),
          removeItem: jest.fn(),
        },
        writable: true,
      });

      // Mock cache avec recherche similaire
      (youtubeCacheService.getSearch as jest.Mock)
        .mockResolvedValueOnce(null) // Première recherche
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

      vi.mocked(youtubeProvider.getSystemStatus).mockReturnValue(mockStatus);

      const result = youtubeService.getSystemStatus();

      expect(result).toEqual(mockStatus);
      expect(youtubeProvider.getSystemStatus).toHaveBeenCalled();
    });
  });
});

