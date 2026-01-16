/// <reference lib="webworker" />

interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string | null;
  duration: number;
  coverUrl?: string | null;
  year?: number | null;
  genre?: string | null;
}

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

interface ComputePayload {
  tracks: Track[];
  artistName: string;
}

interface ComputeResult {
  artistTracks: Track[];
  albums: AlbumGroup[];
  popularTracks: Track[];
  stats: Stats;
}

const compute = (payload: ComputePayload): ComputeResult => {
  const artistLower = payload.artistName.toLowerCase();
  const artistTracks = payload.tracks.filter((t) => t.artist.toLowerCase() === artistLower);

  const albumsMap = new Map<string, AlbumGroup>();
  artistTracks.forEach((track) => {
    const key = track.album || "Singles";
    if (!albumsMap.has(key)) {
      albumsMap.set(key, {
        name: key,
        coverUrl: track.coverUrl,
        year: track.year ?? undefined,
        tracks: [],
        totalDuration: 0,
      });
    }
    const album = albumsMap.get(key)!;
    album.tracks.push(track);
    album.totalDuration += track.duration || 0;
  });

  const albums = Array.from(albumsMap.values()).sort((a, b) => (b.year || 0) - (a.year || 0));
  const popularTracks = artistTracks;

  const genres = Array.from(new Set(artistTracks.flatMap((t) => (t.genre ? [t.genre] : []))));

  const stats: Stats = {
    totalTracks: artistTracks.length,
    totalAlbums: albums.length,
    totalDuration: artistTracks.reduce((sum, t) => sum + (t.duration || 0), 0),
    genres,
  };

  return {
    artistTracks,
    albums,
    popularTracks,
    stats,
  };
};

self.onmessage = (event: MessageEvent<{ id: number; payload: ComputePayload }>) => {
  const { id, payload } = event.data;
  const result = compute(payload);
  (self as DedicatedWorkerGlobalScope).postMessage({ id, result });
};

export {};
