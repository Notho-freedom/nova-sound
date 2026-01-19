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
  totalListeningTime: number; // in seconds
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
}

export function useListeningStats(
  tracks: Track[],
  history: HistoryEntry[] = []
): UseListeningStatsReturn {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ListeningStats | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  const refresh = () => {
    if (workerRef.current) {
      const id = ++requestIdRef.current;
      setLoading(true);
      workerRef.current.postMessage({
        id,
        action: 'stats',
        tracks,
        history,
      });
    }
  };

  useEffect(() => {
    const isBrowser = typeof window !== 'undefined';
    if (!isBrowser) return;

    const worker = new Worker(new URL('../workers/stats-worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<{ id: number; stats?: ListeningStats }>) => {
      if (event.data.id !== requestIdRef.current) return;
      setStats(event.data.stats || null);
      setLoading(false);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (tracks.length === 0) {
      setStats(null);
      setLoading(false);
      return;
    }

    if (workerRef.current) {
      const id = ++requestIdRef.current;
      setLoading(true);
      workerRef.current.postMessage({
        id,
        action: 'stats',
        tracks,
        history,
      });
    }
  }, [tracks, history]);

  return { stats, loading, refresh };
}

// Helper function to format duration
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}min`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
}

// Helper function to format large numbers
export function formatCount(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1000000).toFixed(1)}M`;
}
