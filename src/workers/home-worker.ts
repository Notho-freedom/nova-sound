/// <reference lib="webworker" />

interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string | null;
  duration: number;
  coverUrl?: string | null;
}

interface HistoryEntry {
  trackId: string;
  playCount?: number;
}

interface RecentArtist {
  name: string;
  playCount: number;
  trackCount: number;
  imageUrl?: string | null;
}

interface Slide {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  coverUrl?: string | null;
  gradient: string;
}

interface PlaylistSelections {
  discoveries: Track[];
  similar: Track[];
  mix: Track[];
}

interface ComputePayload {
  tracks: Track[];
  recentTracks: Track[];
  favoriteTracks: Track[];
  history: HistoryEntry[];
  currentTrack: Track | null;
  recentArtists: RecentArtist[];
}

interface ComputeResult {
  displayRecent: Track[];
  displayFavorites: Track[];
  playlistSelections: PlaylistSelections;
  newTracks: Track[];
  heroSlides: Slide[];
  quickPlayItems: Track[];
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

function fisherYatesShuffle<T>(array: T[], seed: number = 0): T[] {
  const shuffled = [...array];
  let currentIndex = shuffled.length;
  let seedValue = seed;
  const random = () => {
    seedValue = (seedValue * 9301 + 49297) % 233280;
    return seedValue / 233280;
  };
  while (currentIndex !== 0) {
    const randomIndex = Math.floor(random() * currentIndex);
    currentIndex--;
    [shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[currentIndex]];
  }
  return shuffled;
}

const generatePlaylistSelections = (tracks: Track[], history: HistoryEntry[] = []): PlaylistSelections => {
  const playCountMap = new Map<string, number>();
  history.forEach((entry) => playCountMap.set(entry.trackId, entry.playCount || 1));

  const tracksWithCounts: Array<{ track: Track; playCount: number }> = [];
  for (const track of tracks) {
    const playCount = playCountMap.get(track.id) || 0;
    if (playCount > 0) {
      tracksWithCounts.push({ track, playCount });
    }
  }

  tracksWithCounts.sort((a, b) => b.playCount - a.playCount);
  const topTracks = tracksWithCounts;

  const shuffled1 = fisherYatesShuffle(topTracks, Date.now() % 1000);
  const shuffled2 = fisherYatesShuffle(topTracks, (Date.now() + 1) % 1000);
  const shuffled3 = fisherYatesShuffle(topTracks, (Date.now() + 2) % 1000);

  return {
    discoveries: shuffled1.map((item) => item.track),
    similar: shuffled2.map((item) => item.track),
    mix: shuffled3.map((item) => item.track),
  };
};

const computeHeroSlides = (
  tracks: Track[],
  currentTrack: Track | null,
  recentArtists: RecentArtist[],
  displayRecent: Track[],
): Slide[] => {
  const slides: Slide[] = [];

  if (currentTrack) {
    slides.push({
      id: currentTrack.id,
      title: currentTrack.title,
      subtitle: "En cours de lecture",
      description: `${currentTrack.artist} • ${currentTrack.album}`,
      coverUrl: currentTrack.coverUrl,
      gradient: "from-primary/40 to-secondary/40",
    });
  }

  recentArtists.forEach((artist) => {
    const artistTrack = tracks.find((t) => t.artist === artist.name);
    if (artistTrack) {
      slides.push({
        id: `artist-${artist.name}`,
        title: artist.name,
        subtitle: "Artiste populaire",
        description: `${artist.trackCount} titres • ${artist.playCount} écoutes`,
        coverUrl: artist.imageUrl || artistTrack.coverUrl,
        gradient: "from-secondary/40 to-accent/40",
      });
    }
  });

  const seenAlbums = new Set<string>();
  displayRecent.forEach((track) => {
    const albumKey = `${track.album}-${track.artist}`;
    if (!seenAlbums.has(albumKey) && track.album !== "Album inconnu") {
      seenAlbums.add(albumKey);
      slides.push({
        id: `album-${albumKey}`,
        title: track.album || "",
        subtitle: "Album récent",
        description: track.artist,
        coverUrl: track.coverUrl,
        gradient: "from-accent/40 to-primary/40",
      });
    }
  });

  if (slides.length < 5) {
    const seenTracks = new Set(slides.map((s) => s.id));
    displayRecent.forEach((track) => {
      if (slides.length < 12 && !seenTracks.has(track.id)) {
        seenTracks.add(track.id);
        slides.push({
          id: track.id,
          title: track.title,
          subtitle: "Titre récent",
          description: `${track.artist} • ${track.album}`,
          coverUrl: track.coverUrl,
          gradient: "from-primary/40 to-secondary/40",
        });
      }
    });
  }

  return slides;
};

const computeQuickPlayItems = (displayRecent: Track[]) => {
  const items: Track[] = [];
  const seen = new Set<string>();
  displayRecent.forEach((track) => {
    if (items.length < 6 && !seen.has(track.id)) {
      seen.add(track.id);
      items.push(track);
    }
  });
  return items;
};

const compute = (payload: ComputePayload): ComputeResult => {
  const displayRecent = payload.recentTracks.length > 0 ? dedupeTracks(payload.recentTracks) : dedupeTracks(payload.tracks);
  const displayFavorites = payload.favoriteTracks.length > 0 ? dedupeTracks(payload.favoriteTracks) : [];
  const playlistSelections = generatePlaylistSelections(payload.tracks, payload.history);
  const newTracks = dedupeTracks(payload.tracks).reverse();
  const heroSlides = computeHeroSlides(payload.tracks, payload.currentTrack, payload.recentArtists, displayRecent);
  const quickPlayItems = computeQuickPlayItems(displayRecent);

  return {
    displayRecent,
    displayFavorites,
    playlistSelections,
    newTracks,
    heroSlides,
    quickPlayItems,
  };
};

self.onmessage = (event: MessageEvent<{ id: number; payload: ComputePayload }>) => {
  const { id, payload } = event.data;
  const result = compute(payload);
  (self as DedicatedWorkerGlobalScope).postMessage({ id, result });
};

export {};
