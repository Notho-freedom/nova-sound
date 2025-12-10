import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQueue } from '../useQueue';
import type { Track } from '@/types/music';

const mockTrack1: Track = {
  id: '1',
  title: 'Track 1',
  artist: 'Artist 1',
  album: 'Album 1',
  duration: 180,
  filePath: '/path/to/track1.mp3',
  coverUrl: '',
};

const mockTrack2: Track = {
  id: '2',
  title: 'Track 2',
  artist: 'Artist 2',
  album: 'Album 2',
  duration: 200,
  filePath: '/path/to/track2.mp3',
  coverUrl: '',
};

const mockTrack3: Track = {
  id: '3',
  title: 'Track 3',
  artist: 'Artist 3',
  album: 'Album 3',
  duration: 220,
  filePath: '/path/to/track3.mp3',
  coverUrl: '',
};

describe('useQueue', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('should initialize with empty queue', () => {
    const { result } = renderHook(() => useQueue());
    
    expect(result.current.queue.tracks).toEqual([]);
    expect(result.current.queue.currentIndex).toBe(0);
    expect(result.current.currentTrack).toBeNull();
  });

  it('should initialize with provided tracks', () => {
    const { result } = renderHook(() => useQueue([mockTrack1, mockTrack2]));
    
    expect(result.current.queue.tracks).toHaveLength(2);
    expect(result.current.currentTrack).toEqual(mockTrack1);
  });

  it('should add tracks to queue', () => {
    const { result } = renderHook(() => useQueue([mockTrack1]));
    
    act(() => {
      result.current.addToQueue(mockTrack2);
    });
    
    expect(result.current.queue.tracks).toHaveLength(2);
    expect(result.current.queue.tracks[1]).toEqual(mockTrack2);
  });

  it('should add multiple tracks to queue', () => {
    const { result } = renderHook(() => useQueue([mockTrack1]));
    
    act(() => {
      result.current.addToQueue([mockTrack2, mockTrack3]);
    });
    
    expect(result.current.queue.tracks).toHaveLength(3);
    expect(result.current.queue.tracks[1]).toEqual(mockTrack2);
    expect(result.current.queue.tracks[2]).toEqual(mockTrack3);
  });

  it('should add tracks to queue next (after current)', () => {
    const { result } = renderHook(() => useQueue([mockTrack1, mockTrack2]));
    
    act(() => {
      result.current.setCurrentIndex(0);
      result.current.addToQueueNext(mockTrack3);
    });
    
    expect(result.current.queue.tracks).toHaveLength(3);
    expect(result.current.queue.tracks[1]).toEqual(mockTrack3);
    expect(result.current.queue.tracks[2]).toEqual(mockTrack2);
  });

  it('should remove track from queue', () => {
    const { result } = renderHook(() => useQueue([mockTrack1, mockTrack2, mockTrack3]));
    
    act(() => {
      result.current.removeFromQueue(1);
    });
    
    expect(result.current.queue.tracks).toHaveLength(2);
    expect(result.current.queue.tracks[0]).toEqual(mockTrack1);
    expect(result.current.queue.tracks[1]).toEqual(mockTrack3);
  });

  it('should clear queue', () => {
    const { result } = renderHook(() => useQueue([mockTrack1, mockTrack2]));
    
    act(() => {
      result.current.clearQueue();
    });
    
    expect(result.current.queue.tracks).toHaveLength(0);
    expect(result.current.queue.currentIndex).toBe(0);
  });

  it('should set current index', () => {
    const { result } = renderHook(() => useQueue([mockTrack1, mockTrack2, mockTrack3]));
    
    act(() => {
      result.current.setCurrentIndex(2);
    });
    
    expect(result.current.queue.currentIndex).toBe(2);
    expect(result.current.currentTrack).toEqual(mockTrack3);
  });

  it('should move track in queue', () => {
    const { result } = renderHook(() => useQueue([mockTrack1, mockTrack2, mockTrack3]));
    
    act(() => {
      result.current.moveTrack(0, 2);
    });
    
    expect(result.current.queue.tracks[0]).toEqual(mockTrack2);
    expect(result.current.queue.tracks[2]).toEqual(mockTrack1);
  });

  it('should get next and previous tracks', () => {
    const { result } = renderHook(() => useQueue([mockTrack1, mockTrack2, mockTrack3]));
    
    act(() => {
      result.current.setCurrentIndex(1);
    });
    
    expect(result.current.currentTrack).toEqual(mockTrack2);
    expect(result.current.nextTrack).toEqual(mockTrack3);
    expect(result.current.previousTrack).toEqual(mockTrack1);
  });

  it('should shuffle queue', () => {
    const { result } = renderHook(() => useQueue([mockTrack1, mockTrack2, mockTrack3]));
    
    act(() => {
      result.current.shuffle();
    });
    
    expect(result.current.isShuffled).toBe(true);
    expect(result.current.queue.tracks).toHaveLength(3);
    // Current track should remain at position 0 after shuffle
    expect(result.current.queue.currentIndex).toBe(0);
  });

  it('should unshuffle queue', () => {
    const { result } = renderHook(() => useQueue([mockTrack1, mockTrack2, mockTrack3]));
    
    act(() => {
      result.current.shuffle();
      result.current.unshuffle();
    });
    
    expect(result.current.isShuffled).toBe(false);
    expect(result.current.queue.tracks[0]).toEqual(mockTrack1);
    expect(result.current.queue.tracks[1]).toEqual(mockTrack2);
    expect(result.current.queue.tracks[2]).toEqual(mockTrack3);
  });
});

