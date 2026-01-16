import { useEffect, useMemo, useRef, useState } from "react";
import type { Video } from "@/types/music";

interface UseYouTubeHistoryWorkerPayload {
  recentlyWatched: Video[];
  enhancedVideos: Video[];
  rawWatchHistory: Array<{ videoId: string; watchedAt: string }>;
}

interface UseYouTubeHistoryWorkerResult {
  sorted: Video[];
  missingVideoIds: string[];
  computing: boolean;
}

export function useYouTubeHistoryWorker(payload: UseYouTubeHistoryWorkerPayload): UseYouTubeHistoryWorkerResult {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const [sorted, setSorted] = useState<Video[]>([]);
  const [missingVideoIds, setMissingVideoIds] = useState<string[]>([]);
  const [computing, setComputing] = useState(false);

  const isBrowser = typeof window !== "undefined";

  useEffect(() => {
    if (!isBrowser) return;
    const worker = new Worker(new URL("../workers/youtube-history-worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<{ id: number; result: { sorted: Video[]; missingVideoIds: string[] } }>) => {
      if (event.data.id !== requestIdRef.current) return;
      setSorted(event.data.result.sorted);
      setMissingVideoIds(event.data.result.missingVideoIds);
      setComputing(false);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [isBrowser]);

  const stablePayload = useMemo(() => payload, [
    payload.recentlyWatched,
    payload.enhancedVideos,
    payload.rawWatchHistory,
  ]);

  useEffect(() => {
    if (!workerRef.current) return;
    const id = ++requestIdRef.current;
    setComputing(true);
    workerRef.current.postMessage({ id, payload: stablePayload });
  }, [stablePayload]);

  return { sorted, missingVideoIds, computing };
}
