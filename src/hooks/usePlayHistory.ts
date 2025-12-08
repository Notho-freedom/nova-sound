import { useState, useEffect, useCallback } from "react";

interface HistoryEntry {
  trackId: string;
  playedAt: string;
  playCount: number;
}

interface UsePlayHistoryReturn {
  history: HistoryEntry[];
  addToHistory: (trackId: string) => void;
  clearHistory: () => void;
  getPlayCount: (trackId: string) => number;
  getLastPlayed: (trackId: string) => string | null;
}

const MAX_HISTORY_SIZE = 100;

export function usePlayHistory(): UsePlayHistoryReturn {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Load history from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("nexus-play-history");
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch {
        setHistory([]);
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem("nexus-play-history", JSON.stringify(history));
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
        });
        return updated.slice(0, MAX_HISTORY_SIZE);
      } else {
        // Add new entry
        return [
          { trackId, playedAt: now, playCount: 1 },
          ...prev,
        ].slice(0, MAX_HISTORY_SIZE);
      }
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

  return {
    history,
    addToHistory,
    clearHistory,
    getPlayCount,
    getLastPlayed,
  };
}

