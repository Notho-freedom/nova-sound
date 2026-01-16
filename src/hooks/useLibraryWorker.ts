import { useEffect, useMemo, useRef, useState } from "react";
import type { Track } from "@/types/music";

type SortMode = "title" | "artist" | "album" | "duration" | "date";

type AlbumsSortBy = "name" | "artist" | "year" | "tracks";

type ArtistsSortBy = "name" | "albums" | "tracks";

type SortOrder = "asc" | "desc";

interface AlbumGroup {
  name: string;
  artist: string;
  coverUrl?: string | null;
  tracks: Track[];
  year?: number | null;
}

interface ArtistGroup {
  name: string;
  tracks: Track[];
  albums: Set<string>;
}

interface FolderGroup {
  path: string;
  tracks: Track[];
}

interface LibraryComputePayload {
  tracks: Track[];
  searchQuery: string;
  sortMode: SortMode;
  albumsSearchQuery: string;
  albumsFilterArtist: string | null;
  albumsSortBy: AlbumsSortBy;
  albumsSortOrder: SortOrder;
  artistsSearchQuery: string;
  artistsSortBy: ArtistsSortBy;
  artistsSortOrder: SortOrder;
}

interface LibraryComputeResult {
  uniqueTracks: Track[];
  filteredAndSortedTracks: Track[];
  albums: AlbumGroup[];
  artists: ArtistGroup[];
  folders: FolderGroup[];
  filteredAndSortedAlbums: AlbumGroup[];
  uniqueAlbumArtists: string[];
  filteredAndSortedArtists: ArtistGroup[];
  totalDuration: number;
  randomCovers: Track[];
}

interface UseLibraryWorkerResult {
  computed: LibraryComputeResult | null;
  computing: boolean;
}

export function useLibraryWorker(payload: LibraryComputePayload): UseLibraryWorkerResult {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const [computed, setComputed] = useState<LibraryComputeResult | null>(null);
  const [computing, setComputing] = useState(false);

  const isBrowser = typeof window !== "undefined";

  useEffect(() => {
    if (!isBrowser) return;
    const worker = new Worker(new URL("../workers/library-worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<{ id: number; result: LibraryComputeResult }>) => {
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
    payload.searchQuery,
    payload.sortMode,
    payload.albumsSearchQuery,
    payload.albumsFilterArtist,
    payload.albumsSortBy,
    payload.albumsSortOrder,
    payload.artistsSearchQuery,
    payload.artistsSortBy,
    payload.artistsSortOrder,
  ]);

  useEffect(() => {
    if (!workerRef.current) return;
    const id = ++requestIdRef.current;
    setComputing(true);
    workerRef.current.postMessage({ id, payload: stablePayload });
  }, [stablePayload]);

  return { computed, computing };
}
