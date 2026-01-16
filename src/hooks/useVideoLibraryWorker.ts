import { useEffect, useMemo, useRef, useState } from "react";
import type { Video, VideoGenre, WatchProgress } from "@/types/music";

type VideoLibraryState = {
  watchlist: string[];
  favorites: string[];
  watchHistory: { videoId: string; watchedAt: string }[];
  watchProgress: Record<string, WatchProgress>;
  userRatings: Record<string, number>;
};

interface VideoLibraryWorkerPayload {
  videos: Video[];
  state: VideoLibraryState;
}

interface VideoLibraryWorkerResult {
  enhancedVideos: Video[];
  continueWatching: Video[];
  recentlyAdded: Video[];
  recentlyWatched: Video[];
  watchlistVideos: Video[];
  favoriteVideos: Video[];
  availableGenres: VideoGenre[];
  genreMap: Record<string, Video[]>;
  movies: Video[];
  series: Video[];
  episodes: Video[];
  clips: Video[];
}

interface UseVideoLibraryWorkerResult {
  computed: VideoLibraryWorkerResult | null;
  computing: boolean;
}

export function useVideoLibraryWorker(payload: VideoLibraryWorkerPayload): UseVideoLibraryWorkerResult {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const [computed, setComputed] = useState<VideoLibraryWorkerResult | null>(null);
  const [computing, setComputing] = useState(false);

  const isBrowser = typeof window !== "undefined";

  useEffect(() => {
    if (!isBrowser) return;
    const worker = new Worker(new URL("../workers/video-library-worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<{ id: number; result: VideoLibraryWorkerResult }>) => {
      if (event.data.id !== requestIdRef.current) return;
      setComputed(event.data.result);
      setComputing(false);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [isBrowser]);

  const stablePayload = useMemo(() => payload, [payload.videos, payload.state]);

  useEffect(() => {
    if (!workerRef.current) return;
    const id = ++requestIdRef.current;
    setComputing(true);
    workerRef.current.postMessage({ id, payload: stablePayload });
  }, [stablePayload]);

  return { computed, computing };
}
