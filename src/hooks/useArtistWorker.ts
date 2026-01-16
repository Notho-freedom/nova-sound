import { useEffect, useMemo, useRef, useState } from "react";
import type { Track } from "@/types/music";

interface AlbumGroup {
  name: string;
  coverUrl?: string | null;
  year?: number | null;
  tracks: Track[];
  totalDuration: number;
}

interface Stats {
  totalTracks: number;
  totalAlbums: number;
  totalDuration: number;
  genres: string[];
}

interface ArtistWorkerPayload {
  tracks: Track[];
  artistName: string;
}

interface ArtistWorkerResult {
  artistTracks: Track[];
  albums: AlbumGroup[];
  popularTracks: Track[];
  stats: Stats;
}

interface UseArtistWorkerResult {
  computed: ArtistWorkerResult | null;
  computing: boolean;
}

export function useArtistWorker(payload: ArtistWorkerPayload): UseArtistWorkerResult {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const [computed, setComputed] = useState<ArtistWorkerResult | null>(null);
  const [computing, setComputing] = useState(false);

  const isBrowser = typeof window !== "undefined";

  useEffect(() => {
    if (!isBrowser) return;
    const worker = new Worker(new URL("../workers/artist-worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<{ id: number; result: ArtistWorkerResult }>) => {
      if (event.data.id !== requestIdRef.current) return;
      setComputed(event.data.result);
      setComputing(false);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [isBrowser]);

  const stablePayload = useMemo(() => payload, [payload.tracks, payload.artistName]);

  useEffect(() => {
    if (!workerRef.current) return;
    const id = ++requestIdRef.current;
    setComputing(true);
    workerRef.current.postMessage({ id, payload: stablePayload });
  }, [stablePayload]);

  return { computed, computing };
}
