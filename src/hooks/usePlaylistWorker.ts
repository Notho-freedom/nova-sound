import { useEffect, useMemo, useRef, useState } from "react";
import type { Track, Playlist } from "@/types/music";

type SortOrder = "asc" | "desc";

type TableSortBy = "title" | "artist" | "album" | "duration";

interface PlaylistWorkerPayload {
  tracks: Track[];
  playlists: Playlist[];
  searchQuery: string;
  selectedPlaylistId: string | null;
  tableSearchQuery: string;
  filterArtist: string | null;
  filterAlbum: string | null;
  tableSortBy: TableSortBy;
  tableSortOrder: SortOrder;
}

interface PlaylistWorkerResult {
  filteredPlaylists: Playlist[];
  availableTracks: Track[];
  uniqueTracks: Track[];
  uniqueAvailableTracks: Track[];
  uniqueArtists: string[];
  uniqueAlbums: string[];
  filteredAndSortedTracks: Track[];
  totalTracks: number;
}

interface UsePlaylistWorkerResult {
  computed: PlaylistWorkerResult | null;
  computing: boolean;
}

export function usePlaylistWorker(payload: PlaylistWorkerPayload): UsePlaylistWorkerResult {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const [computed, setComputed] = useState<PlaylistWorkerResult | null>(null);
  const [computing, setComputing] = useState(false);

  const isBrowser = typeof window !== "undefined";

  useEffect(() => {
    if (!isBrowser) return;
    const worker = new Worker(new URL("../workers/playlist-worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<{ id: number; result: PlaylistWorkerResult }>) => {
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
    payload.playlists,
    payload.searchQuery,
    payload.selectedPlaylistId,
    payload.tableSearchQuery,
    payload.filterArtist,
    payload.filterAlbum,
    payload.tableSortBy,
    payload.tableSortOrder,
  ]);

  useEffect(() => {
    if (!workerRef.current) return;
    const id = ++requestIdRef.current;
    setComputing(true);
    workerRef.current.postMessage({ id, payload: stablePayload });
  }, [stablePayload]);

  return { computed, computing };
}
