/**
 * Tests unitaires pour YouTubeCacheService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { youtubeCacheService } from '../youtube-cache';

// Mock Firebase
vi.mock('../firebase', () => ({
  getDb: vi.fn(() => ({
    collection: vi.fn(),
    doc: vi.fn(),
  })),
}));

describe('YouTubeCacheService', () => {
  beforeEach(() => {
    // Clear L1 cache
    youtubeCacheService.clearL1();
  });

  describe('setVideo et getVideo', () => {
    it('devrait mettre en cache et récupérer une vidéo', async () => {
      const video = {
        id: 'test-video-id',
        videoId: 'test-video-id',
        title: 'Test Video',
        description: 'Test Description',
        channelTitle: 'Test Channel',
        channelId: 'channel-id',
        publishedAt: '2024-01-01',
        duration: 120,
        viewCount: 1000,
        thumbnailUrl: 'https://example.com/thumb.jpg',
      };

      await youtubeCacheService.setVideo(video);
      const cached = await youtubeCacheService.getVideo('test-video-id');

      expect(cached).toBeTruthy();
      expect(cached?.title).toBe('Test Video');
      expect(cached?.channelTitle).toBe('Test Channel');
    });

    it('devrait retourner null si la vidéo n\'est pas en cache', async () => {
      const cached = await youtubeCacheService.getVideo('non-existent-video-id');
      expect(cached).toBeNull();
    });
  });

  describe('setSearch et getSearch', () => {
    it('devrait mettre en cache et récupérer une recherche', async () => {
      const videos = [
        {
          id: 'video1',
          videoId: 'video1',
          title: 'Video 1',
          channelTitle: 'Channel 1',
          thumbnailUrl: 'https://example.com/thumb1.jpg',
          publishedAt: '2024-01-01',
        },
        {
          id: 'video2',
          videoId: 'video2',
          title: 'Video 2',
          channelTitle: 'Channel 2',
          thumbnailUrl: 'https://example.com/thumb2.jpg',
          publishedAt: '2024-01-02',
        },
      ];

      await youtubeCacheService.setSearch('test query', videos as any);
      const cached = await youtubeCacheService.getSearch('test query');

      expect(cached).toBeTruthy();
      expect(cached?.query).toBe('test query');
      expect(cached?.results).toHaveLength(2);
    });

    it('devrait retourner null si la recherche n\'est pas en cache', async () => {
      const cached = await youtubeCacheService.getSearch('non-existent-query');
      expect(cached).toBeNull();
    });
  });

  describe('TTL adaptatif', () => {
    it('devrait utiliser un TTL plus long pour les vidéos populaires', async () => {
      const popularVideo = {
        id: 'popular-video',
        videoId: 'popular-video',
        title: 'Popular Video',
        channelTitle: 'Channel',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        publishedAt: '2024-01-01',
        viewCount: 2000000, // 2M vues = populaire
      };

      await youtubeCacheService.setVideo(popularVideo);
      const cached = await youtubeCacheService.getVideo('popular-video');

      expect(cached).toBeTruthy();
      // Le TTL devrait être plus long (3 jours pour >1M vues)
      const ttl = cached!.expiresAt.getTime() - cached!.cachedAt.getTime();
      expect(ttl).toBeGreaterThan(12 * 60 * 60 * 1000); // Plus que 12h
    });
  });
});

