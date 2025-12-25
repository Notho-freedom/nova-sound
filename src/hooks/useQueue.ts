import { useState, useCallback, useEffect, useRef } from 'react';
import type { Track } from '@/types/music';

export interface QueueState {
  tracks: Track[];
  currentIndex: number;
  originalOrder: Track[]; // For shuffle restoration
  shuffleOrder: number[] | null;
}

interface UseQueueReturn {
  queue: QueueState;
  currentTrack: Track | null;
  nextTrack: Track | null;
  previousTrack: Track | null;
  addToQueue: (tracks: Track | Track[]) => void;
  addToQueueNext: (tracks: Track | Track[]) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setCurrentIndex: (index: number) => void;
  moveTrack: (fromIndex: number, toIndex: number) => void;
  setQueue: (tracks: Track[]) => void;
  shuffle: () => void;
  unshuffle: () => void;
  isShuffled: boolean;
}

const QUEUE_STORAGE_KEY = 'nexus-queue';
const QUEUE_INDEX_STORAGE_KEY = 'nexus-queue-index';

export function useQueue(initialTracks: Track[] = []): UseQueueReturn {
  const [queue, setQueueState] = useState<QueueState>(() => {
    // Try to restore from localStorage
    if (typeof window !== 'undefined') {
      try {
        const savedQueue = localStorage.getItem(QUEUE_STORAGE_KEY);
        const savedIndex = localStorage.getItem(QUEUE_INDEX_STORAGE_KEY);
        
        if (savedQueue) {
          const parsed = JSON.parse(savedQueue);
          const tracks = Array.isArray(parsed) ? parsed : [];
          const index = savedIndex ? parseInt(savedIndex, 10) : 0;
          
          if (tracks.length > 0 && index >= 0 && index < tracks.length) {
            return {
              tracks,
              currentIndex: index,
              originalOrder: [...tracks],
              shuffleOrder: null,
            };
          }
        }
      } catch (error) {
        console.error('Failed to restore queue from localStorage:', error);
      }
    }
    
    // Default: use initial tracks
    return {
      tracks: initialTracks,
      currentIndex: 0,
      originalOrder: [...initialTracks],
      shuffleOrder: null,
    };
  });

  // Save to localStorage whenever queue changes (persist even when empty to avoid wiping other caches)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue.tracks));
      localStorage.setItem(QUEUE_INDEX_STORAGE_KEY, queue.currentIndex.toString());
    } catch (error) {
      console.error('Failed to save queue to localStorage:', error);
    }
  }, [queue.tracks, queue.currentIndex]);

  // Add tracks to the end of queue
  const addToQueue = useCallback((tracksToAdd: Track | Track[]) => {
    setQueueState((prev) => {
      const newTracks = Array.isArray(tracksToAdd) ? tracksToAdd : [tracksToAdd];
      const updatedTracks = [...prev.tracks, ...newTracks];
      
      return {
        ...prev,
        tracks: updatedTracks,
        originalOrder: prev.shuffleOrder ? prev.originalOrder : updatedTracks,
      };
    });
  }, []);

  // Add tracks right after current track (play next)
  const addToQueueNext = useCallback((tracksToAdd: Track | Track[]) => {
    setQueueState((prev) => {
      const newTracks = Array.isArray(tracksToAdd) ? tracksToAdd : [tracksToAdd];
      const insertIndex = prev.currentIndex + 1;
      const updatedTracks = [
        ...prev.tracks.slice(0, insertIndex),
        ...newTracks,
        ...prev.tracks.slice(insertIndex),
      ];
      
      return {
        ...prev,
        tracks: updatedTracks,
        originalOrder: prev.shuffleOrder ? prev.originalOrder : updatedTracks,
      };
    });
  }, []);

  // Remove track from queue
  const removeFromQueue = useCallback((index: number) => {
    setQueueState((prev) => {
      if (index < 0 || index >= prev.tracks.length) return prev;
      
      const updatedTracks = prev.tracks.filter((_, i) => i !== index);
      let newIndex = prev.currentIndex;
      
      // Adjust current index if needed
      if (index < prev.currentIndex) {
        newIndex = prev.currentIndex - 1;
      } else if (index === prev.currentIndex && updatedTracks.length > 0) {
        // If removing current track, stay at same position or move to end
        newIndex = Math.min(prev.currentIndex, updatedTracks.length - 1);
      }
      
      return {
        ...prev,
        tracks: updatedTracks,
        currentIndex: newIndex,
        originalOrder: prev.shuffleOrder ? prev.originalOrder : updatedTracks,
      };
    });
  }, []);

  // Clear entire queue
  const clearQueue = useCallback(() => {
    setQueueState((prev) => ({
      tracks: [],
      currentIndex: 0,
      // Conserver l'ordre original pour pouvoir rétablir facilement après ajout
      originalOrder: prev.originalOrder,
      shuffleOrder: null,
    }));
    if (typeof window !== 'undefined') {
      try {
        // Persister un état vide plutôt que supprimer les clés pour éviter tout reset global
        localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify([]));
        localStorage.setItem(QUEUE_INDEX_STORAGE_KEY, '0');
      } catch (error) {
        console.error('Failed to persist cleared queue:', error);
      }
    }
  }, []);

  // Set current index
  const setCurrentIndex = useCallback((index: number) => {
    setQueueState((prev) => {
      if (index < 0 || index >= prev.tracks.length) return prev;
      return {
        ...prev,
        currentIndex: index,
      };
    });
  }, []);

  // Move track in queue (for drag & drop)
  const moveTrack = useCallback((fromIndex: number, toIndex: number) => {
    setQueueState((prev) => {
      if (
        fromIndex < 0 ||
        fromIndex >= prev.tracks.length ||
        toIndex < 0 ||
        toIndex >= prev.tracks.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }

      const newTracks = [...prev.tracks];
      const [movedTrack] = newTracks.splice(fromIndex, 1);
      newTracks.splice(toIndex, 0, movedTrack);

      // Adjust current index
      let newIndex = prev.currentIndex;
      if (fromIndex === prev.currentIndex) {
        newIndex = toIndex;
      } else if (fromIndex < prev.currentIndex && toIndex >= prev.currentIndex) {
        newIndex = prev.currentIndex - 1;
      } else if (fromIndex > prev.currentIndex && toIndex <= prev.currentIndex) {
        newIndex = prev.currentIndex + 1;
      }

      return {
        ...prev,
        tracks: newTracks,
        currentIndex: newIndex,
        originalOrder: prev.shuffleOrder ? prev.originalOrder : newTracks,
      };
    });
  }, []);

  // Set entire queue (replace all tracks)
  const setQueue = useCallback((tracks: Track[]) => {
    setQueueState({
      tracks,
      currentIndex: 0,
      originalOrder: tracks,
      shuffleOrder: null,
    });
  }, []);

  // Shuffle queue
  const shuffle = useCallback(() => {
    setQueueState((prev) => {
      if (prev.tracks.length <= 1) return prev;

      // Create shuffled order
      const indices = prev.tracks.map((_, i) => i);
      const shuffledIndices = [...indices];
      
      // Fisher-Yates shuffle
      for (let i = shuffledIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
      }

      // Keep current track at its position
      const currentIndexInShuffle = shuffledIndices.indexOf(prev.currentIndex);
      if (currentIndexInShuffle > 0) {
        [shuffledIndices[0], shuffledIndices[currentIndexInShuffle]] = [
          shuffledIndices[currentIndexInShuffle],
          shuffledIndices[0],
        ];
      }

      const shuffledTracks = shuffledIndices.map((idx) => prev.tracks[idx]);
      const newCurrentIndex = shuffledIndices.indexOf(prev.currentIndex);

      return {
        tracks: shuffledTracks,
        currentIndex: newCurrentIndex >= 0 ? newCurrentIndex : 0,
        originalOrder: prev.originalOrder.length > 0 ? prev.originalOrder : prev.tracks,
        shuffleOrder: shuffledIndices,
      };
    });
  }, []);

  // Unshuffle (restore original order)
  const unshuffle = useCallback(() => {
    setQueueState((prev) => {
      if (!prev.shuffleOrder || prev.originalOrder.length === 0) return prev;

      // Find current track in original order
      const currentTrack = prev.tracks[prev.currentIndex];
      const originalIndex = prev.originalOrder.findIndex((t) => t.id === currentTrack.id);

      return {
        tracks: prev.originalOrder,
        currentIndex: originalIndex >= 0 ? originalIndex : 0,
        originalOrder: prev.originalOrder,
        shuffleOrder: null,
      };
    });
  }, []);

  const currentTrack = queue.tracks[queue.currentIndex] || null;
  const nextTrack = queue.currentIndex < queue.tracks.length - 1 
    ? queue.tracks[queue.currentIndex + 1] 
    : null;
  const previousTrack = queue.currentIndex > 0 
    ? queue.tracks[queue.currentIndex - 1] 
    : null;
  const isShuffled = queue.shuffleOrder !== null;

  return {
    queue,
    currentTrack,
    nextTrack,
    previousTrack,
    addToQueue,
    addToQueueNext,
    removeFromQueue,
    clearQueue,
    setCurrentIndex,
    moveTrack,
    setQueue,
    shuffle,
    unshuffle,
    isShuffled,
  };
}

