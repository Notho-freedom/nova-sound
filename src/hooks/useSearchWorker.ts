import { useEffect, useRef, useState, useMemo } from "react";
import type { Track } from "@/types/music";

type HistoryEntry = { trackId: string; playCount: number };

type SearchAlbum = { name: string; artist: string; coverUrl?: string | null; count: number };
type SearchArtist = { name: string; coverUrl?: string | null; count: number };

type SearchResults = {
  tracks: Track[];
  albums: SearchAlbum[];
  artists: SearchArtist[];
};

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
  const lastPayloadKeyRef = useRef<string>("");

  const [computed, setComputed] = useState<SearchWorkerResult | null>(null);
  const [computing, setComputing] = useState(false);

  // Worker créé une seule fois
  useEffect(() => {
    if (typeof window === "undefined") return;

    const worker = new Worker(
      new URL("../workers/search-worker.ts", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = (event: MessageEvent<{ id: number; result: SearchWorkerResult }>) => {
      if (event.data.id !== requestIdRef.current) return;
      setComputed(event.data.result);
      setComputing(false);
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // Clé STRICTEMENT primitive et stable
  const payloadKey = useMemo(
    () =>
      [
        payload.query,
        payload.tracks.length,
        payload.youtubeTracks.length,
        payload.searchHistory.length,
        payload.history.length,
        payload.favoriteTrackIds.length,
      ].join("|"),
    [
      payload.query,
      payload.tracks.length,
      payload.youtubeTracks.length,
      payload.searchHistory.length,
      payload.history.length,
      payload.favoriteTrackIds.length,
    ],
  );

  // Effet déclenché uniquement par payloadKey
  useEffect(() => {
    if (!workerRef.current) return;
    if (payloadKey === lastPayloadKeyRef.current) return;

    lastPayloadKeyRef.current = payloadKey;
    const id = ++requestIdRef.current;

    setComputing(true);

    workerRef.current.postMessage({
      id,
      payload: {
        query: payload.query,
        tracks: payload.tracks,
        youtubeTracks: payload.youtubeTracks,
        searchHistory: payload.searchHistory,
        history: payload.history,
        favoriteTrackIds: payload.favoriteTrackIds,
      },
    });
  }, [payloadKey]);

  return { computed, computing };
}
