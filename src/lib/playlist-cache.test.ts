import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensurePlaylistTracksCached } from './playlist-cache';

const makeTrack = (id: string, youtube: boolean = false) => ({ id, title: `T ${id}`, artist: 'A', album: 'B', duration: 120, coverUrl: '', mediaSource: youtube ? 'youtube' : 'local', youtubeVideoId: youtube ? `video-${id}` : undefined });

const mockVideo = (videoId: string) => ({ videoId, title: `Video ${videoId}`, thumbnailUrl: '', duration: 'PT1M30S', channelTitle: 'Channel' });

describe('ensurePlaylistTracksCached', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('caches tracks found in allTracks', async () => {
    const playlists = [{ id: 'p1', name: 'P1', trackIds: ['t1', 't2'], createdAt: '', updatedAt: '' }];
    const allTracks = [makeTrack('t1', true), makeTrack('t2', false)];
    const cacheFn = vi.fn();

    await ensurePlaylistTracksCached(playlists as any, allTracks as any, { cacheYouTubeTrack: cacheFn, fetchYouTubePlaylistVideos: async () => [] });

    expect(cacheFn).toHaveBeenCalledTimes(1);
    expect(cacheFn).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }));
  });

  it('fetches youtube playlist videos and caches them', async () => {
    const playlists = [{ id: 'py', name: 'PY', trackIds: [], mediaSource: 'youtube', externalId: 'ext123', createdAt: '', updatedAt: '' }];
    const allTracks: any[] = [];
    const cacheFn = vi.fn();
    const fetchFn = vi.fn(async (id: string) => [mockVideo('video-1'), mockVideo('video-2')]);

    await ensurePlaylistTracksCached(playlists as any, allTracks as any, { cacheYouTubeTrack: cacheFn, fetchYouTubePlaylistVideos: fetchFn });

    expect(fetchFn).toHaveBeenCalledWith('ext123', 200);
    expect(cacheFn).toHaveBeenCalledTimes(2);
    expect(cacheFn).toHaveBeenCalledWith(expect.objectContaining({ id: 'youtube-audio-video-1' }));
  });
});
