/**
 * Enhanced useListeningStats hook with Upstash caching
 * First checks Redis cache, then calculates in worker if miss
 * Stores results back in cache for next session
 */

import { useState, useEffect, useRef } from "react";
import type { Track } from "@/types/music";

interface HistoryEntry {
  trackId: string;
  playedAt: string;
  playCount: number;
}

interface ArtistStats {
  name: string;
  playCount: number;
  trackCount: number;
  imageUrl?: string;
}

interface ListeningStats {
  totalListeningTime: number;
  totalTracks: number;
  totalPlays: number;
  topArtists: ArtistStats[];
  topGenres: { name: string; count: number }[];
  recentArtists: ArtistStats[];
  dailyListeningTime: number;
  weeklyListeningTime: number;
  monthlyListeningTime: number;
  averageTrackDuration: number;
  longestSession: number;
  mostPlayedTrack?: { track: Track; playCount: number };
}

interface UseListeningStatsReturn {
  stats: ListeningStats | null;
  loading: boolean;
  refresh: () => void;
  isCached: boolean;
}

export function useListeningStatsCached(
  tracks: Track[],
  history: HistoryEntry[] = [],
  userId: string | null = null
): UseListeningStatsReturn {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ListeningStats | null>(null);
  const [isCached, setIsCached] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  const refresh = () => {
    if (workerRef.current) {
      const id = ++requestIdRef.current;
      setLoading(true);
      setIsCached(false);
      workerRef.current.postMessage({
        id,
        action: "stats",
        tracks,
        history,
      });
    }
  };

  useEffect(() => {
    const isBrowser = typeof window !== "undefined";
    if (!isBrowser) return;

    const worker = new Worker(new URL("../workers/stats-worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<{ id: number; stats?: ListeningStats }>) => {
      if (event.data.id !== requestIdRef.current) return;
      
      const calculatedStats = event.data.stats || null;
      setStats(calculatedStats);
      setLoading(false);

      // Store in Upstash cache for next session
      if (calculatedStats && tracks.length > 0) {
        (async () => {
          try {
            const { statsCache } = await import("@/lib/upstash-cache");
            await statsCache.set(userId, tracks.map(t => t.id), calculatedStats);
          } catch (err) {
            console.debug("[useListeningStatsCached] Cache write skipped:", err);
          }
        })();
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tracks.length]);

  useEffect(() => {
    if (tracks.length === 0) {
      setStats(null);
      setLoading(false);
      setIsCached(false);
      return;
    }

    // Check cache first
    (async () => {
      try {
        const { statsCache } = await import("@/lib/upstash-cache");
        const cached = await statsCache.get(userId, tracks.map(t => t.id));

        if (cached) {
          // Found in cache!
          setStats(cached);
          setLoading(false);
          setIsCached(true);
          console.log("[useListeningStatsCached] 🚀 Loaded from cache");
          return; // Don't recalculate if cached
        }

        // Not in cache, trigger worker calculation
        if (workerRef.current) {
          const id = ++requestIdRef.current;
          setLoading(true);
          setIsCached(false);
          workerRef.current.postMessage({
            id,
            action: "stats",
            tracks,
            history,
          });
        }
      } catch (err) {
        console.debug("[useListeningStatsCached] Cache check skipped:", err);
        // Fallback to calculation
        if (workerRef.current) {
          const id = ++requestIdRef.current;
          setLoading(true);
          setIsCached(false);
          workerRef.current.postMessage({
            id,
            action: "stats",
            tracks,
            history,
          });
        }
      }
    })();
  }, [tracks, history, userId]);

  return { stats, loading, refresh, isCached };
}

// Export original hook as fallback
export { useListeningStats } from "./useListeningStats";
