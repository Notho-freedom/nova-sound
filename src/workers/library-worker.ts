/// <reference lib="webworker" />

type SortMode = "title" | "artist" | "album" | "duration" | "date";

type AlbumsSortBy = "name" | "artist" | "year" | "tracks";

type ArtistsSortBy = "name" | "albums" | "tracks";

type SortOrder = "asc" | "desc";

interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string | null;
  duration: number;
  coverUrl?: string | null;
  year?: number | null;
  filePath?: string | null;
  addedAt?: string | null;
}

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

interface ComputePayload {
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

interface ComputeResult {
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

const sortTracks = (tracks: Track[], sortMode: SortMode) => {
  return [...tracks].sort((a, b) => {
    switch (sortMode) {
      case "title":
        return collator.compare(a.title || "", b.title || "");
      case "artist":
        return collator.compare(a.artist || "", b.artist || "");
      case "album":
        return collator.compare(a.album || "", b.album || "");
      case "duration":
        return (b.duration || 0) - (a.duration || 0);
      case "date":
        return String(b.addedAt || "").localeCompare(String(a.addedAt || ""));
      default:
        return 0;
    }
  });
};

const filterTracks = (tracks: Track[], query: string) => {
  const q = query.trim().toLowerCase();
  if (!q) return tracks;
  return tracks.filter(track => {
    const title = track.title?.toLowerCase() || "";
    const artist = track.artist?.toLowerCase() || "";
    const album = track.album?.toLowerCase() || "";
    return title.includes(q) || artist.includes(q) || album.includes(q);
  });
};

const groupByAlbum = (tracks: Track[]) => {
  const albums = new Map<string, AlbumGroup>();
  for (const track of tracks) {
    if (!track.album) continue;
    const key = `${track.album}-${track.artist || ""}`;
    if (!albums.has(key)) {
      albums.set(key, {
        name: track.album,
        artist: track.artist,
        coverUrl: track.coverUrl,
        tracks: [],
        year: track.year ?? undefined,
      });
    }
    albums.get(key)!.tracks.push(track);
  }
  return Array.from(albums.values()).sort((a, b) => collator.compare(a.name, b.name));
};

const groupByArtist = (tracks: Track[]) => {
  const artists = new Map<string, ArtistGroup>();
  for (const track of tracks) {
    const name = track.artist || "";
    if (!artists.has(name)) {
      artists.set(name, {
        name,
        tracks: [],
        albums: new Set<string>(),
      });
    }
    const artist = artists.get(name)!;
    artist.tracks.push(track);
    if (track.album) artist.albums.add(track.album);
  }
  return Array.from(artists.values()).sort((a, b) => collator.compare(a.name, b.name));
};

const groupByFolder = (tracks: Track[]) => {
  const folders = new Map<string, FolderGroup>();
  for (const track of tracks) {
    if (!track.filePath) continue;
    const folderPath = track.filePath.replace(/[/\\][^/\\]+$/, "");
    if (!folders.has(folderPath)) {
      folders.set(folderPath, { path: folderPath, tracks: [] });
    }
    folders.get(folderPath)!.tracks.push(track);
  }
  return Array.from(folders.values()).sort((a, b) => collator.compare(a.path, b.path));
};

const compute = (payload: ComputePayload): ComputeResult => {
  const uniqueTracks = dedupeTracks(payload.tracks);
  const filteredTracks = filterTracks(uniqueTracks, payload.searchQuery);
  const filteredAndSortedTracks = sortTracks(filteredTracks, payload.sortMode);

  const albums = groupByAlbum(uniqueTracks);
  const artists = groupByArtist(uniqueTracks);
  const folders = groupByFolder(uniqueTracks);

  let filteredAlbums = albums;
  if (payload.albumsSearchQuery.trim()) {
    const q = payload.albumsSearchQuery.toLowerCase();
    filteredAlbums = filteredAlbums.filter(album =>
      album.name.toLowerCase().includes(q) || album.artist.toLowerCase().includes(q)
    );
  }
  if (payload.albumsFilterArtist) {
    filteredAlbums = filteredAlbums.filter(album => album.artist === payload.albumsFilterArtist);
  }
  const filteredAndSortedAlbums = [...filteredAlbums].sort((a, b) => {
    let comparison = 0;
    switch (payload.albumsSortBy) {
      case "name":
        comparison = collator.compare(a.name, b.name);
        break;
      case "artist":
        comparison = collator.compare(a.artist, b.artist);
        break;
      case "year":
        comparison = (a.year || 0) - (b.year || 0);
        break;
      case "tracks":
        comparison = a.tracks.length - b.tracks.length;
        break;
      default:
        comparison = 0;
    }
    return payload.albumsSortOrder === "asc" ? comparison : -comparison;
  });

  const uniqueAlbumArtists = Array.from(new Set(albums.map(album => album.artist).filter(Boolean))).sort((a, b) => collator.compare(a, b));

  let filteredArtists = artists;
  if (payload.artistsSearchQuery.trim()) {
    const q = payload.artistsSearchQuery.toLowerCase();
    filteredArtists = filteredArtists.filter(artist => artist.name.toLowerCase().includes(q));
  }
  const filteredAndSortedArtists = [...filteredArtists].sort((a, b) => {
    let comparison = 0;
    switch (payload.artistsSortBy) {
      case "name":
        comparison = collator.compare(a.name, b.name);
        break;
      case "albums":
        comparison = a.albums.size - b.albums.size;
        break;
      case "tracks":
        comparison = a.tracks.length - b.tracks.length;
        break;
      default:
        comparison = 0;
    }
    return payload.artistsSortOrder === "asc" ? comparison : -comparison;
  });

  const totalDuration = uniqueTracks.reduce((sum, track) => sum + (track.duration || 0), 0);
  const randomCovers = uniqueTracks.filter(track => track.coverUrl).sort(() => Math.random() - 0.5);

  return {
    uniqueTracks,
    filteredAndSortedTracks,
    albums,
    artists,
    folders,
    filteredAndSortedAlbums,
    uniqueAlbumArtists,
    filteredAndSortedArtists,
    totalDuration,
    randomCovers,
  };
};

self.onmessage = (event: MessageEvent<{ id: number; payload: ComputePayload }>) => {
  const { id, payload } = event.data;
  const result = compute(payload);
  (self as DedicatedWorkerGlobalScope).postMessage({ id, result });
};
