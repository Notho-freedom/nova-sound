/**
 * Hook optimisé pour l'historique de lecture
 * Optimisations: debounce Firebase 5s, batch localStorage, mémorisation
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";

export interface HistoryEntry {
  trackId: string;
  playedAt: string;
  playCount: number;
  duration: number;
  completedPercentage?: number;
  youtubeVideoId?: string; // Ajout: id YouTube pour les tracks YouTube (persistance plus robuste)
}

interface UsePlayHistoryReturn {
  history: HistoryEntry[];
  addToHistory: (trackId: string, youtubeVideoId?: string) => void;
  recordPlayback: (trackId: string, duration: number, completedPercentage?: number, youtubeVideoId?: string) => void;
  clearHistory: () => void;
  getPlayCount: (trackId: string) => number;
  getLastPlayed: (trackId: string) => string | null;
  getTotalListeningTime: (trackId?: string) => number;
}

const MAX_HISTORY_SIZE = 1000;
const STORAGE_KEY = "nexus-play-history";
const FIREBASE_DEBOUNCE_MS = 5000; // 5 secondes

export function usePlayHistory(): UsePlayHistoryReturn {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const firebaseSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncRef = useRef<number>(0);
  const pendingSyncRef = useRef<boolean>(false);

  // Chargement initial optimisé
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setHistory(parsed);
        }
      } catch {}
    }

    // Écouter les mises à jour Firebase
    const handleFirebaseUpdate = (event: CustomEvent) => {
      const data = event.detail?.history;
      if (Array.isArray(data) && data.length > 0) {
        setHistory(prev => {
          // Fusionner intelligemment au lieu de remplacer
          if (data.length > prev.length) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            return data;
          }
          return prev;
        });
      }
    };

    window.addEventListener('firebase-sync-update', handleFirebaseUpdate as EventListener);
    window.addEventListener('firebase-history-update', handleFirebaseUpdate as EventListener);

    return () => {
      window.removeEventListener('firebase-sync-update', handleFirebaseUpdate as EventListener);
      window.removeEventListener('firebase-history-update', handleFirebaseUpdate as EventListener);
    };
  }, []);

  // Sync Firebase avec debounce optimisé
  const syncToFirebase = useCallback(() => {
    if (pendingSyncRef.current) return;
    
    const now = Date.now();
    const timeSinceLastSync = now - lastSyncRef.current;
    
    // Si moins de 5s depuis le dernier sync, programmer un sync différé
    if (timeSinceLastSync < FIREBASE_DEBOUNCE_MS) {
      if (firebaseSyncTimeoutRef.current) {
        clearTimeout(firebaseSyncTimeoutRef.current);
      }
      firebaseSyncTimeoutRef.current = setTimeout(() => {
        syncToFirebase();
      }, FIREBASE_DEBOUNCE_MS - timeSinceLastSync);
      return;
    }

    pendingSyncRef.current = true;
    lastSyncRef.current = now;

    // Sync async sans bloquer
    import('@/services/firebase-sync').then(({ firebaseSyncService }) => {
      firebaseSyncService.queueSync('history', history);
    }).catch(() => {}).finally(() => {
      pendingSyncRef.current = false;
    });
  }, [history]);

  // Sauvegarde localStorage + Firebase avec debounce
  useEffect(() => {
    if (history.length === 0) return;

    // Sauvegarder immédiatement en localStorage (synchrone, rapide)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {}

    // Sync Firebase avec debounce
    syncToFirebase();

    return () => {
      if (firebaseSyncTimeoutRef.current) {
        clearTimeout(firebaseSyncTimeoutRef.current);
      }
    };
  }, [history, syncToFirebase]);

  // Sauvegarde avant fermeture
  useEffect(() => {
    const saveBeforeUnload = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      } catch {}
    };

    window.addEventListener('beforeunload', saveBeforeUnload);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveBeforeUnload();
    });

    return () => {
      window.removeEventListener('beforeunload', saveBeforeUnload);
    };
  }, [history]);

  const addToHistory = useCallback((trackId: string, youtubeVideoId?: string) => {
    setHistory(prev => {
      const now = new Date().toISOString();
      const existingIndex = prev.findIndex(h => h.trackId === trackId || (youtubeVideoId && h.youtubeVideoId === youtubeVideoId));

      if (existingIndex !== -1) {
        const updated = [...prev];
        const existing = updated.splice(existingIndex, 1)[0];
        return [
          { ...existing, playedAt: now, playCount: existing.playCount + 1, youtubeVideoId: youtubeVideoId || existing.youtubeVideoId },
          ...updated,
        ].slice(0, MAX_HISTORY_SIZE);
      }

      return [
        { trackId, playedAt: now, playCount: 1, duration: 0, youtubeVideoId },
        ...prev,
      ].slice(0, MAX_HISTORY_SIZE);
    });
  }, []);

  const recordPlayback = useCallback((trackId: string, duration: number, completedPercentage?: number, youtubeVideoId?: string) => {
    setHistory(prev => {
      const now = new Date().toISOString();
      const existingEntries = prev.filter(h => h.trackId === trackId || (youtubeVideoId && h.youtubeVideoId === youtubeVideoId));
      const playCount = existingEntries.length > 0 
        ? Math.max(...existingEntries.map(e => e.playCount)) + 1 
        : 1;

      return [
        {
          trackId,
          playedAt: now,
          playCount,
          duration,
          completedPercentage: completedPercentage ?? (duration > 0 ? 100 : 0),
          youtubeVideoId,
        },
        ...prev,
      ].slice(0, MAX_HISTORY_SIZE);
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Mémoïsation des lookups fréquents
  const historyMap = useMemo(() => {
    const map = new Map<string, HistoryEntry>();
    for (const entry of history) {
      if (!map.has(entry.trackId)) {
        map.set(entry.trackId, entry);
      }
    }
    return map;
  }, [history]);

  const getPlayCount = useCallback((trackId: string): number => {
    return historyMap.get(trackId)?.playCount ?? 0;
  }, [historyMap]);

  const getLastPlayed = useCallback((trackId: string): string | null => {
    return historyMap.get(trackId)?.playedAt ?? null;
  }, [historyMap]);

  const getTotalListeningTime = useCallback((trackId?: string): number => {
    if (trackId) {
      return history
        .filter(h => h.trackId === trackId)
        .reduce((sum, e) => sum + (e.duration || 0), 0);
    }
    return history.reduce((sum, e) => sum + (e.duration || 0), 0);
  }, [history]);

  return {
    history,
    addToHistory,
    recordPlayback,
    clearHistory,
    getPlayCount,
    getLastPlayed,
    getTotalListeningTime,
  };
}
