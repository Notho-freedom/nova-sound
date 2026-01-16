import { useEffect, useMemo, useRef, useState } from "react";
import type { Track } from "@/types/music";

type HistoryEntry = { trackId: string; playCount?: number };

type RecentArtist = { name: string; playCount: number; trackCount: number; imageUrl?: string | null };

type Slide = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  coverUrl?: string | null;
  gradient: string;
};

type PlaylistSelections = {
  discoveries: Track[];
  similar: Track[];
  mix: Track[];
};

interface HomeWorkerPayload {
  tracks: Track[];
  recentTracks: Track[];
  favoriteTracks: Track[];
  history: HistoryEntry[];
  currentTrack: Track | null;
  recentArtists: RecentArtist[];
}

interface HomeWorkerResult {
  displayRecent: Track[];
  displayFavorites: Track[];
  playlistSelections: PlaylistSelections;
  newTracks: Track[];
  heroSlides: Slide[];
  quickPlayItems: Track[];
}

interface UseHomeWorkerResult {
  computed: HomeWorkerResult | null;
  computing: boolean;
}

export function useHomeWorker(payload: HomeWorkerPayload): UseHomeWorkerResult {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const [computed, setComputed] = useState<HomeWorkerResult | null>(null);
  const [computing, setComputing] = useState(false);

  const isBrowser = typeof window !== "undefined";

  useEffect(() => {
    if (!isBrowser) return;
    const worker = new Worker(new URL("../workers/home-worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<{ id: number; result: HomeWorkerResult }>) => {
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
    payload.tracks,
    payload.recentTracks,
    payload.favoriteTracks,
    payload.history,
    payload.currentTrack,
    payload.recentArtists,
  ]);

  useEffect(() => {
    if (!workerRef.current) return;
    const id = ++requestIdRef.current;
    setComputing(true);
    workerRef.current.postMessage({ id, payload: stablePayload });
  }, [stablePayload]);

  return { computed, computing };
}
