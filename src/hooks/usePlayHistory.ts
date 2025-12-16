import { useState, useEffect, useCallback } from "react";

export interface HistoryEntry {
  trackId: string;
  playedAt: string;
  playCount: number;
  duration: number; // Temps d'écoute réel en secondes
  completedPercentage?: number; // Pourcentage de la piste écouté (0-100)
}

interface UsePlayHistoryReturn {
  history: HistoryEntry[];
  addToHistory: (trackId: string) => void;
  recordPlayback: (trackId: string, duration: number, completedPercentage?: number) => void;
  clearHistory: () => void;
  getPlayCount: (trackId: string) => number;
  getLastPlayed: (trackId: string) => string | null;
  getTotalListeningTime: (trackId?: string) => number;
}

const MAX_HISTORY_SIZE = 1000; // Augmenté pour stocker plus d'entrées

export function usePlayHistory(): UsePlayHistoryReturn {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Load history from localStorage and listen to Firebase sync updates
  useEffect(() => {
    const stored = localStorage.getItem("nexus-play-history");
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch {
        setHistory([]);
      }
    }

    // Listen to Firebase sync updates
    const handleSyncUpdate = (event: CustomEvent) => {
      if (event.detail?.history) {
        setHistory(event.detail.history);
      }
    };

    window.addEventListener('firebase-sync-update', handleSyncUpdate as EventListener);
    return () => {
      window.removeEventListener('firebase-sync-update', handleSyncUpdate as EventListener);
    };
  }, []);

  // Save history to localStorage and sync to Firebase
  useEffect(() => {
    localStorage.setItem("nexus-play-history", JSON.stringify(history));
    
    // Sync to Firebase (debounced to avoid too many writes)
    // Sauvegarder plus fréquemment pour assurer la persistance
    const timeoutId = setTimeout(() => {
      (async () => {
        try {
          const { firebaseSyncService } = await import('@/services/firebase-sync');
          firebaseSyncService.queueSync('history', history);
        } catch (error) {
          // Silently fail if Firebase sync is not available
        }
      })();
    }, 2000); // Debounce 2 secondes pour éviter trop d'écritures mais assurer la persistance
    
    return () => clearTimeout(timeoutId);
  }, [history]);

  const addToHistory = useCallback((trackId: string) => {
    setHistory((prev) => {
      const existingIndex = prev.findIndex((h) => h.trackId === trackId);
      const now = new Date().toISOString();

      if (existingIndex !== -1) {
        // Update existing entry
        const updated = [...prev];
        const existing = updated[existingIndex];
        updated.splice(existingIndex, 1);
        updated.unshift({
          ...existing,
          playedAt: now,
          playCount: existing.playCount + 1,
          // Conserver la durée existante si elle existe
          duration: existing.duration || 0,
        });
        return updated.slice(0, MAX_HISTORY_SIZE);
      } else {
        // Add new entry
        return [
          { trackId, playedAt: now, playCount: 1, duration: 0 },
          ...prev,
        ].slice(0, MAX_HISTORY_SIZE);
      }
    });
  }, []);

  // Enregistrer une session d'écoute complète avec durée réelle
  // Cette fonction ajoute une nouvelle entrée à l'historique pour chaque session d'écoute
  // Elle accumule aussi le temps d'écoute total pour chaque piste
  const recordPlayback = useCallback((trackId: string, duration: number, completedPercentage?: number) => {
    setHistory((prev) => {
      const now = new Date().toISOString();
      
      // Trouver toutes les entrées existantes pour cette piste pour calculer le playCount
      const existingEntries = prev.filter((h) => h.trackId === trackId);
      const playCount = existingEntries.length > 0 
        ? Math.max(...existingEntries.map(e => e.playCount)) + 1
        : 1;
      
      // Créer une nouvelle entrée pour cette session d'écoute
      const newEntry: HistoryEntry = {
        trackId,
        playedAt: now,
        playCount: playCount,
        duration: duration,
        completedPercentage: completedPercentage || (duration > 0 ? 100 : 0),
      };
      
      // Ajouter la nouvelle entrée au début (plus récente) et garder toutes les sessions
      // Cela permet l'accumulation dans le temps - chaque session est enregistrée séparément
      const updated = [newEntry, ...prev].slice(0, MAX_HISTORY_SIZE);
      
      // Sauvegarder immédiatement dans localStorage pour assurer la persistance
      try {
        localStorage.setItem("nexus-play-history", JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to save history to localStorage:", error);
      }
      
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem("nexus-play-history");
  }, []);

  const getPlayCount = useCallback(
    (trackId: string): number => {
      const entry = history.find((h) => h.trackId === trackId);
      return entry?.playCount || 0;
    },
    [history]
  );

  const getLastPlayed = useCallback(
    (trackId: string): string | null => {
      const entry = history.find((h) => h.trackId === trackId);
      return entry?.playedAt || null;
    },
    [history]
  );

  const getTotalListeningTime = useCallback(
    (trackId?: string): number => {
      if (trackId) {
        // Temps total pour une piste spécifique
        return history
          .filter((h) => h.trackId === trackId)
          .reduce((sum, entry) => sum + (entry.duration || 0), 0);
      } else {
        // Temps total pour toutes les pistes
        return history.reduce((sum, entry) => sum + (entry.duration || 0), 0);
      }
    },
    [history]
  );

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

