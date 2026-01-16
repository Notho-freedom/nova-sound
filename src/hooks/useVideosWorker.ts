import { useEffect, useMemo, useRef, useState } from "react";
import type { Video, VideoGenre } from "@/types/music";

export type SortOption = "recent" | "title" | "duration" | "size" | "rating" | "added";
export type ViewMode = "home" | "browse" | "watchlist" | "favorites" | "history" | "youtube";

interface VideosWorkerPayload {
  enhancedVideos: Video[];
  continueWatching: Video[];
  recentlyAdded: Video[];
  recentlyWatched: Video[];
  watchlistVideos: Video[];
  favoriteVideos: Video[];
  viewMode: ViewMode;
  searchQuery: string;
  selectedGenre: VideoGenre | null;
  sortBy: SortOption;
}

interface VideosWorkerResult {
  featuredVideos: Video[];
  filteredVideos: Video[];
  displayVideos: Video[];
}

interface UseVideosWorkerResult {
  computed: VideosWorkerResult | null;
  computing: boolean;
}

export function useVideosWorker(payload: VideosWorkerPayload): UseVideosWorkerResult {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const [computed, setComputed] = useState<VideosWorkerResult | null>(null);
  const [computing, setComputing] = useState(false);

  const isBrowser = typeof window !== "undefined";

  useEffect(() => {
    if (!isBrowser) return;
    const worker = new Worker(new URL("../workers/videos-worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<{ id: number; result: VideosWorkerResult }>) => {
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
    payload.enhancedVideos,
    payload.continueWatching,
    payload.recentlyAdded,
    payload.recentlyWatched,
    payload.watchlistVideos,
    payload.favoriteVideos,
    payload.viewMode,
    payload.searchQuery,
    payload.selectedGenre,
    payload.sortBy,
  ]);

  useEffect(() => {
    if (!workerRef.current) return;
    const id = ++requestIdRef.current;
    setComputing(true);
    workerRef.current.postMessage({ id, payload: stablePayload });
  }, [stablePayload]);

  return { computed, computing };
}
