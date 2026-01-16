import { useEffect, useMemo, useRef, useState } from "react";
import type { Track } from "@/types/music";

type HistoryEntry = { trackId: string; playCount: number };

type SearchAlbum = { name: string; artist: string; coverUrl?: string | null; count: number };

type SearchArtist = { name: string; coverUrl?: string | null; count: number };

type SearchResults = { tracks: Track[]; albums: SearchAlbum[]; artists: SearchArtist[] };

type DynamicData = {
  topArtists: Array<{ name: string; playCount: number; coverUrl?: string | null }>;
  recentTracks: Track[];
  genres: Array<{ name: string; count: number; coverUrl?: string | null }>;
  recommended: Track[];
};

interface SearchWorkerPayload {
  query: string;
  tracks: Track[];
  youtubeTracks: Track[];
  searchHistory: string[];
  history: HistoryEntry[];
  favoriteTrackIds: string[];
}

interface SearchWorkerResult {
  searchResults: SearchResults;
  dynamicData: DynamicData;
  suggestionPool: string[];
  autoCompleteSuggestion: string;
  inlineSuggestions: string[];
  hasResults: boolean;
}

interface UseSearchWorkerResult {
  computed: SearchWorkerResult | null;
  computing: boolean;
}

export function useSearchWorker(payload: SearchWorkerPayload): UseSearchWorkerResult {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const [computed, setComputed] = useState<SearchWorkerResult | null>(null);
  const [computing, setComputing] = useState(false);

  const isBrowser = typeof window !== "undefined";

  useEffect(() => {
    if (!isBrowser) return;
    const worker = new Worker(new URL("../workers/search-worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<{ id: number; result: SearchWorkerResult }>) => {
      if (event.data.id !== requestIdRef.current) return;
      setComputed(event.data.result);
      setComputing(false);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [isBrowser]);

  const stablePayload = useMemo(() => payload, [
    payload.query,
    payload.tracks,
    payload.youtubeTracks,
    payload.searchHistory,
    payload.history,
    payload.favoriteTrackIds,
  ]);

  useEffect(() => {
    if (!workerRef.current) return;
    const id = ++requestIdRef.current;
    setComputing(true);
    workerRef.current.postMessage({ id, payload: stablePayload });
  }, [stablePayload]);

  return { computed, computing };
}
