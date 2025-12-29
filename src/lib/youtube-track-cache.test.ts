import { describe, it, expect, beforeEach } from 'vitest';
import { cacheYouTubeTrack, getCachedYouTubeTrack, getCachedYouTubeTrackByVideoId, saveYouTubeTracksCache, getYouTubeTracksCache } from './youtube-track-cache';

// Simple track factory
function makeTrack(id: string, videoId: string) {
  return {
    id,
    title: 'Test',
    artist: 'Artist',
    album: 'Album',
    duration: 100,
    coverUrl: '',
    mediaSource: 'youtube',
    youtubeVideoId: videoId,
    addedAt: new Date().toISOString(),
  } as any;
}

describe('YouTube track cache helpers', () => {
  beforeEach(() => {
    // Clear localStorage key
    try { localStorage.removeItem('nexus-youtube-tracks-cache'); } catch (e) {}
  });

  it('sanity: saveYouTubeTracksCache should persist to cache (in-memory or localStorage)', () => {
    const m = new Map<string, any>();
    m.set('abc', { id: 'abc', mediaSource: 'youtube' });
    saveYouTubeTracksCache(m);
    const loaded = getYouTubeTracksCache();
    expect(loaded.has('abc')).toBe(true);
  });

  it('should retrieve by exact stored id', () => {
    const t = makeTrack('yt-track-1', 'vid-1');
    cacheYouTubeTrack(t);
    const found = getCachedYouTubeTrack('yt-track-1');
    expect(found).toBeTruthy();
    expect(found?.youtubeVideoId).toBe('vid-1');
  });

  it('should retrieve by youtubeVideoId', () => {
    const t = makeTrack('yt-track-2', 'vid-2');
    cacheYouTubeTrack(t);
    const found = getCachedYouTubeTrack('vid-2');
    expect(found).toBeTruthy();
    expect(found?.id).toBe('yt-track-2');

    const byVid = getCachedYouTubeTrackByVideoId('vid-2');
    expect(byVid).toBeTruthy();
  });

  it('should retrieve by id variant like youtube-audio-<vid>', () => {
    const t = makeTrack('yt-track-3', 'video-abc-123');
    cacheYouTubeTrack(t);
    const found = getCachedYouTubeTrack('youtube-audio-video-abc-123');
    expect(found).toBeTruthy();
    expect(found?.id).toBe('yt-track-3');
  });
});