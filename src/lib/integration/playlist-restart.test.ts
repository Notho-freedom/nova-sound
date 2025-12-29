import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Track, Playlist } from '@/types/music';

/**
 * Test that YouTube playlists persist across app restarts
 * Validates the full flow: cache YouTube tracks -> store in playlist -> restart -> resolve from cache
 */
describe('YouTube playlist - restart / cache-only resolution', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('resolves playlist tracks via cache when main index is missing', async () => {
    // Step 1: Simulate initial load - cache some YouTube tracks
    const { cacheYouTubeTrack, getYouTubeTracksCache } = await import('@/lib/youtube-track-cache');
    
    const youtubeTrack1: Track = {
      id: 'youtube-audio-vid-abc-123',
      title: 'YouTube Track 1',
      artist: 'Artist',
      album: 'Album',
      duration: 100,
      coverUrl: '',
      mediaSource: 'youtube',
      youtubeVideoId: 'vid-abc-123'
    };

    const youtubeTrack2: Track = {
      id: 'youtube-audio-vid-xyz-456',
      title: 'YouTube Track 2',
      artist: 'Artist',
      album: 'Album',
      duration: 150,
      coverUrl: '',
      mediaSource: 'youtube',
      youtubeVideoId: 'vid-xyz-456'
    };

    // Cache the tracks
    cacheYouTubeTrack(youtubeTrack1);
    cacheYouTubeTrack(youtubeTrack2);

    // Step 2: Simulate a playlist that references these tracks
    const playlist: Playlist = {
      id: 'playlist-1',
      name: 'My YouTube Playlist',
      trackIds: ['youtube-audio-vid-abc-123', 'youtube-audio-vid-xyz-456'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mediaSource: 'youtube',
      externalId: 'youtube-playlist-123'
    };

    // Step 3: Simulate app restart - load cache
    const cachedTracks = getYouTubeTracksCache();
    expect(cachedTracks.size).toBe(2);

    // Step 4: Use getTrackFromAllOrCache to resolve playlist tracks (as PlaylistView would do)
    const { getTrackFromAllOrCache } = await import('@/lib/track-resolver');
    
    const allTracks = Array.from(cachedTracks.values()); // Simulates what DesktopApp builds
    const resolvedTracks = playlist.trackIds
      .map(id => getTrackFromAllOrCache(allTracks, id))
      .filter((t): t is Track => !!t);

    // Verify all tracks are resolved
    expect(resolvedTracks).toHaveLength(2);
    expect(resolvedTracks[0].title).toBe('YouTube Track 1');
    expect(resolvedTracks[1].title).toBe('YouTube Track 2');
  });

  it('resolves playlist with variant track IDs from cache', async () => {
    const { cacheYouTubeTrack, getYouTubeTracksCache } = await import('@/lib/youtube-track-cache');
    
    // Cache a track with youtubeVideoId
    const track: Track = {
      id: 'yt-track-abc',
      title: 'Variant ID Track',
      artist: 'Artist',
      album: 'Album',
      duration: 100,
      coverUrl: '',
      mediaSource: 'youtube',
      youtubeVideoId: 'video-abc-123'
    };
    
    cacheYouTubeTrack(track);

    // Create a playlist with different ID variants that should match
    const playlist: Playlist = {
      id: 'playlist-2',
      name: 'Variant IDs Playlist',
      // Store trackIds with different formats that should resolve via cache
      trackIds: ['youtube-audio-video-abc-123', 'video-abc-123', 'yt-track-abc'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { getTrackFromAllOrCache } = await import('@/lib/track-resolver');
    const allTracks = Array.from(getYouTubeTracksCache().values());

    // All variants should resolve to the same cached track
    const resolved1 = getTrackFromAllOrCache(allTracks, 'youtube-audio-video-abc-123');
    const resolved2 = getTrackFromAllOrCache(allTracks, 'video-abc-123');
    const resolved3 = getTrackFromAllOrCache(allTracks, 'yt-track-abc');

    expect(resolved1).not.toBeNull();
    expect(resolved2).not.toBeNull();
    expect(resolved3).not.toBeNull();
    
    // All should be the same track
    expect(resolved1?.id).toBe('yt-track-abc');
    expect(resolved2?.id).toBe('yt-track-abc');
    expect(resolved3?.id).toBe('yt-track-abc');
  });

  it('handles empty playlist gracefully', async () => {
    const { getTrackFromAllOrCache } = await import('@/lib/track-resolver');
    const { getYouTubeTracksCache } = await import('@/lib/youtube-track-cache');
    
    const allTracks = Array.from(getYouTubeTracksCache().values());
    
    const playlist: Playlist = {
      id: 'empty-playlist',
      name: 'Empty',
      trackIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const resolved = playlist.trackIds
      .map(id => getTrackFromAllOrCache(allTracks, id))
      .filter((t): t is Track => !!t);

    expect(resolved).toHaveLength(0);
  });
});
