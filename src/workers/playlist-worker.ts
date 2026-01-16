/// <reference lib="webworker" />

type SortOrder = "asc" | "desc";

type TableSortBy = "title" | "artist" | "album" | "duration";

interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string | null;
  duration: number;
  filePath?: string | null;
}

interface Playlist {
  id: string;
  name: string;
  description?: string | null;
  trackIds: string[];
}

interface ComputePayload {
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

interface ComputeResult {
  filteredPlaylists: Playlist[];
  availableTracks: Track[];
  uniqueTracks: Track[];
  uniqueAvailableTracks: Track[];
  uniqueArtists: string[];
  uniqueAlbums: string[];
  filteredAndSortedTracks: Track[];
  totalTracks: number;
}

const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

const dedupeTracks = (tracks: Track[]) => {
  const seen = new Set<string>();
  const result: Track[] = [];
  for (const track of tracks) {
    if (!track?.id || seen.has(track.id)) continue;
    seen.add(track.id);
    result.push(track);
  }
  return result;
};

const compute = (payload: ComputePayload): ComputeResult => {
  const query = payload.searchQuery.trim().toLowerCase();
  const filteredPlaylists = !query
    ? payload.playlists
    : payload.playlists.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.description?.toLowerCase() || "").includes(query)
      );

  const selectedPlaylist = payload.playlists.find((p) => p.id === payload.selectedPlaylistId) || null;
  const selectedTrackIds = selectedPlaylist?.trackIds || [];
  const availableTracks = selectedPlaylist
    ? payload.tracks.filter((t) => !selectedTrackIds.includes(t.id))
    : payload.tracks;

  const uniqueTracks = dedupeTracks(payload.tracks);
  const uniqueAvailableTracks = dedupeTracks(availableTracks);

  const artistsSet = new Set<string>();
  for (const track of uniqueTracks) {
    if (track.artist) artistsSet.add(track.artist);
  }
  const uniqueArtists = Array.from(artistsSet).sort((a, b) => collator.compare(a, b));

  const albumsSet = new Set<string>();
  for (const track of uniqueTracks) {
    if (track.album) albumsSet.add(track.album);
  }
  const uniqueAlbums = Array.from(albumsSet).sort((a, b) => collator.compare(a, b));

  let filtered = uniqueTracks;
  if (payload.tableSearchQuery.trim()) {
    const q = payload.tableSearchQuery.toLowerCase();
    filtered = filtered.filter((track) => {
      const title = track.title?.toLowerCase() || "";
      const artist = track.artist?.toLowerCase() || "";
      const album = track.album?.toLowerCase() || "";
      return title.includes(q) || artist.includes(q) || album.includes(q);
    });
  }

  if (payload.filterArtist) filtered = filtered.filter((track) => track.artist === payload.filterArtist);
  if (payload.filterAlbum) filtered = filtered.filter((track) => track.album === payload.filterAlbum);

  const filteredAndSortedTracks = [...filtered].sort((a, b) => {
    let comparison = 0;
    switch (payload.tableSortBy) {
      case "title":
        comparison = collator.compare(a.title || "", b.title || "");
        break;
      case "artist":
        comparison = collator.compare(a.artist || "", b.artist || "");
        break;
      case "album":
        comparison = collator.compare(a.album || "", b.album || "");
        break;
      case "duration":
        comparison = (a.duration || 0) - (b.duration || 0);
        break;
      default:
        comparison = 0;
    }
    return payload.tableSortOrder === "asc" ? comparison : -comparison;
  });

  const totalTracks = payload.playlists.reduce((acc, p) => acc + (p.trackIds?.length || 0), 0);

  return {
    filteredPlaylists,
    availableTracks,
    uniqueTracks,
    uniqueAvailableTracks,
    uniqueArtists,
    uniqueAlbums,
    filteredAndSortedTracks,
    totalTracks,
  };
};

self.onmessage = (event: MessageEvent<{ id: number; payload: ComputePayload }>) => {
  const { id, payload } = event.data;
  const result = compute(payload);
  (self as DedicatedWorkerGlobalScope).postMessage({ id, result });
};

export {};
