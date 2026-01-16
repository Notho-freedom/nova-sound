/// <reference lib="webworker" />

type SortMode = "title" | "artist" | "album" | "duration" | "date";

interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string | null;
  duration: number;
  coverUrl?: string | null;
  genre?: string | null;
  addedAt?: string | null;
}

interface HistoryEntry {
  trackId: string;
  playCount: number;
}

interface SearchAlbum {
  name: string;
  artist: string;
  coverUrl?: string | null;
  count: number;
}

interface SearchArtist {
  name: string;
  coverUrl?: string | null;
  count: number;
}

interface SearchResults {
  tracks: Track[];
  albums: SearchAlbum[];
  artists: SearchArtist[];
}

interface DynamicData {
  topArtists: Array<{ name: string; playCount: number; coverUrl?: string | null }>;
  recentTracks: Track[];
  genres: Array<{ name: string; count: number; coverUrl?: string | null }>;
  recommended: Track[];
}

interface ComputePayload {
  query: string;
  tracks: Track[];
  youtubeTracks: Track[];
  searchHistory: string[];
  history: HistoryEntry[];
  favoriteTrackIds: string[];
}

interface ComputeResult {
  searchResults: SearchResults;
  dynamicData: DynamicData;
  suggestionPool: string[];
  autoCompleteSuggestion: string;
  inlineSuggestions: string[];
  hasResults: boolean;
}

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

const computeSearchResults = (payload: ComputePayload): SearchResults => {
  if (!payload.query.trim()) {
    return { tracks: [], albums: [], artists: [] };
  }

  const q = payload.query.toLowerCase();

  const matchedTracks = payload.tracks.filter((t) =>
    (t.title || "").toLowerCase().includes(q) ||
    (t.artist || "").toLowerCase().includes(q) ||
    (t.album || "").toLowerCase().includes(q)
  );

  const allTracks = [...matchedTracks, ...payload.youtubeTracks];
  const uniqueMatchedTracks = dedupeTracks(allTracks);

  const albumsMap = new Map<string, SearchAlbum>();
  matchedTracks.forEach((t) => {
    const key = `${t.album}-${t.artist}`;
    if (!albumsMap.has(key)) {
      albumsMap.set(key, { name: t.album || "", artist: t.artist || "", coverUrl: t.coverUrl, count: 0 });
    }
    albumsMap.get(key)!.count++;
  });

  const artistsMap = new Map<string, SearchArtist>();
  matchedTracks.forEach((t) => {
    if (!artistsMap.has(t.artist)) {
      artistsMap.set(t.artist, { name: t.artist || "", coverUrl: t.coverUrl, count: 0 });
    }
    artistsMap.get(t.artist)!.count++;
  });

  return {
    tracks: uniqueMatchedTracks,
    albums: Array.from(albumsMap.values()),
    artists: Array.from(artistsMap.values()),
  };
};

const computeDynamicData = (payload: ComputePayload): DynamicData => {
  const artistPlayCounts = new Map<string, { count: number; track: Track }>();
  for (const entry of payload.history) {
    const track = payload.tracks.find((t) => t.id === entry.trackId);
    if (track) {
      const current = artistPlayCounts.get(track.artist) || { count: 0, track };
      artistPlayCounts.set(track.artist, { count: current.count + (entry.playCount || 0), track });
    }
  }

  const topArtists = Array.from(artistPlayCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([name, data]) => ({ name, playCount: data.count, coverUrl: data.track.coverUrl }));

  const recentTracks = [...payload.tracks].slice(-12).reverse();

  const genreMap = new Map<string, { count: number; coverUrl?: string | null }>();
  payload.tracks.forEach((t) => {
    if (t.genre) {
      const current = genreMap.get(t.genre) || { count: 0, coverUrl: t.coverUrl };
      genreMap.set(t.genre, { count: current.count + 1, coverUrl: t.coverUrl || current.coverUrl });
    }
  });

  const genres = Array.from(genreMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([name, data]) => ({ name, count: data.count, coverUrl: data.coverUrl }));

  const favoriteTrackIds = new Set(payload.favoriteTrackIds);
  const favoriteArtists = new Set(
    payload.tracks.filter((t) => favoriteTrackIds.has(t.id)).map((t) => t.artist)
  );

  const recommended = payload.tracks.filter(
    (t) => !favoriteTrackIds.has(t.id) && favoriteArtists.has(t.artist)
  );

  return {
    topArtists,
    recentTracks,
    genres,
    recommended,
  };
};

const computeSuggestions = (
  query: string,
  searchHistory: string[],
  searchResults: SearchResults,
  youtubeTracks: Track[],
) => {
  const pool: string[] = [];
  pool.push(...searchHistory);
  searchResults.tracks.forEach((t) => {
    if (t.title) pool.push(t.title);
    if (t.artist) pool.push(t.artist);
  });
  youtubeTracks.forEach((t) => {
    if (t.title) pool.push(t.title);
    if (t.artist) pool.push(t.artist);
  });

  const base = query.trim().toLowerCase();
  const autoCompleteSuggestion = base
    ? pool.find((s) => s && s.toLowerCase().startsWith(base)) || ""
    : "";

  const inlineSuggestions = (() => {
    if (!base) return searchHistory;
    const relatedArtists = searchResults.tracks
      .map((t) => t.artist)
      .filter((a) => a && a.toLowerCase().includes(base));
    const relatedTitles = searchResults.tracks
      .map((t) => t.title)
      .filter((t) => t && t.toLowerCase().includes(base));
    const merged = [...searchHistory.filter((h) => h.toLowerCase().includes(base)), ...relatedArtists, ...relatedTitles];
    const unique: string[] = [];
    merged.forEach((m) => {
      if (m && !unique.some((u) => u.toLowerCase() === m.toLowerCase())) unique.push(m);
    });
    return unique;
  })();

  return { pool, autoCompleteSuggestion, inlineSuggestions };
};

const compute = (payload: ComputePayload): ComputeResult => {
  const searchResults = computeSearchResults(payload);
  const dynamicData = computeDynamicData(payload);
  const { pool, autoCompleteSuggestion, inlineSuggestions } = computeSuggestions(
    payload.query,
    payload.searchHistory,
    searchResults,
    payload.youtubeTracks,
  );

  const hasResults =
    payload.query.trim().length > 0 &&
    (searchResults.tracks.length > 0 || searchResults.albums.length > 0 || searchResults.artists.length > 0);

  return {
    searchResults,
    dynamicData,
    suggestionPool: pool,
    autoCompleteSuggestion,
    inlineSuggestions,
    hasResults,
  };
};

self.onmessage = (event: MessageEvent<{ id: number; payload: ComputePayload }>) => {
  const { id, payload } = event.data;
  const result = compute(payload);
  (self as DedicatedWorkerGlobalScope).postMessage({ id, result });
};

export {};
