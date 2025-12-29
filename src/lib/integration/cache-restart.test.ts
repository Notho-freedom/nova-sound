import { describe, it, expect, beforeEach, vi } from 'vitest';

// Integration tests to ensure favorites/playlists can resolve tracks using only the YouTube cache

describe('YouTube cache - restart / cache-only resolution', () => {
  beforeEach(() => {
    // Ensure a stable localStorage implementation for these tests (isolate from other tests)
    if (typeof window !== 'undefined') {
      let _store: Record<string, string> = {};
      // Provide a minimal storage API
      (window as any).localStorage = {
        getItem: (k: string) => (_store[k] ?? null),
        setItem: (k: string, v: string) => { _store[k] = String(v); },
        removeItem: (k: string) => { delete _store[k]; },
        clear: () => { _store = {}; },
      };
      window.localStorage.clear();
    }

    // Reset module registry to simulate a restart (fresh imports)
    vi.resetModules();
  });

  it('resolves favorite track via cache when main index is missing', async () => {
    const { cacheYouTubeTrack, getCachedYouTubeTrack } = await import('@/lib/youtube-track-cache');
    const { getTrackFromAllOrCache } = await import('@/lib/track-resolver');

    const cachedTrack = {
      id: 'yt-track-1',
      title: 'YouTube Track 1',
      artist: 'Artist',
      album: 'Album',
      duration: 100,
      coverUrl: '',
      mediaSource: 'youtube' as const,
      youtubeVideoId: 'vid-1',
    } as any;

    // Cache the track (simulates state before restart)
    cacheYouTubeTrack(cachedTrack);
    // Debug: inspect localStorage to make sure the cache was written
    // eslint-disable-next-line no-console
    console.log('[TEST DEBUG] localStorage after cache:', typeof window !== 'undefined' ? window.localStorage.getItem('nexus-youtube-tracks-cache') : null);

    // Simulate app restart by resetting modules and re-importing the resolver
    vi.resetModules();
    const { getTrackFromAllOrCache: resolver } = await import('@/lib/track-resolver');

    const allTracks: any[] = []; // main index is missing

    const resolved = resolver(allTracks, 'yt-track-1');
    expect(resolved).not.toBeNull();
    expect(resolved?.id).toBe('yt-track-1');
    expect(resolved?.youtubeVideoId).toBe('vid-1');
  });

  it('resolves playlist tracks via cache when main index is missing', async () => {
    const { cacheYouTubeTrack } = await import('@/lib/youtube-track-cache');
    const { getTrackFromAllOrCache } = await import('@/lib/track-resolver');

    const cachedTrack = {
      id: 'yt-track-2',
      title: 'YouTube Track 2',
      artist: 'Artist',
      album: 'Album',
      duration: 120,
      coverUrl: '',
      mediaSource: 'youtube' as const,
      youtubeVideoId: 'vid-2',
    } as any;

    cacheYouTubeTrack(cachedTrack);

    // Simulate restart
    vi.resetModules();
    const { getTrackFromAllOrCache: resolver2 } = await import('@/lib/track-resolver');

    const playlist = { id: 'p1', name: 'P1', trackIds: ['yt-track-2'] } as any;
    const allTracks: any[] = [];

    const mapped = playlist.trackIds
      .map((id: string) => resolver2(allTracks, id))
      .filter((t: any): t is any => !!t);

    expect(mapped.length).toBe(1);
    expect(mapped[0].id).toBe('yt-track-2');
  });

  it('does not resolve unknown track when not cached', async () => {
    const { getTrackFromAllOrCache } = await import('@/lib/track-resolver');
    const allTracks: any[] = [];

    const resolved = getTrackFromAllOrCache(allTracks, 'non-existent');
    expect(resolved).toBeNull();
  });
});
