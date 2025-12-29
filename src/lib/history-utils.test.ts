import { describe, it, expect, beforeEach } from 'vitest';
import { mapHistoryEntriesToTracks } from './history-utils';
import { cacheYouTubeTrack, getCachedYouTubeTrackByVideoId, getYouTubeTracksCache } from './youtube-track-cache';

const makeTrack = (id: string, youtubeVideoId?: string) => ({ id, title: `Track ${id}`, mediaSource: youtubeVideoId ? 'youtube' : 'local', youtubeVideoId, duration: 180 });

beforeEach(() => {
  // Clear localStorage cache between tests
  localStorage.clear();
});

describe('mapHistoryEntriesToTracks', () => {


  it('prefers allTracks id lookup over cache', () => {
    const track = makeTrack('lib-1', 'video-123');
    cacheYouTubeTrack({ id: 'cached-override', title: 'Cached', mediaSource: 'youtube', youtubeVideoId: 'video-123' } as any);

    const history = [
      { trackId: 'lib-1', playedAt: new Date().toISOString(), playCount: 1, duration: 20, youtubeVideoId: 'video-123' }
    ];

    const result = mapHistoryEntriesToTracks(history as any, [track as any], [], []);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('lib-1');
  });
});
