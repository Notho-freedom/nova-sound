/**
 * Web Worker pour les calculs lourds de stats et genres
 * Évite de bloquer le thread principal pendant les filtages
 */

interface HistoryEntry {
  trackId: string;
  playedAt: string;
  playCount: number;
}

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverUrl?: string;
  genre?: string;
}

interface ArtistStats {
  name: string;
  playCount: number;
  trackCount: number;
  imageUrl?: string;
}

interface ListeningStats {
  totalListeningTime: number;
  totalTracks: number;
  totalPlays: number;
  topArtists: ArtistStats[];
  topGenres: { name: string; count: number }[];
  recentArtists: ArtistStats[];
  dailyListeningTime: number;
  weeklyListeningTime: number;
  monthlyListeningTime: number;
  averageTrackDuration: number;
  longestSession: number;
  mostPlayedTrack?: { track: Track; playCount: number };
}

interface Genre {
  name: string;
  trackCount: number;
  trackIds: string[];
  sampleCoverUrl?: string;
}

interface WorkerMessage {
  id: number;
  action: 'stats' | 'genres' | 'combined';
  tracks: Track[];
  history?: HistoryEntry[];
}

interface WorkerResult {
  id: number;
  stats?: ListeningStats;
  genres?: Genre[];
}

// Genre detection keywords
const genreKeywords: Record<string, string[]> = {
  pop: ['pop', 'top 40', 'chart', 'mainstream'],
  rock: ['rock', 'alternative', 'indie rock', 'grunge', 'punk'],
  jazz: ['jazz', 'smooth jazz', 'bebop', 'swing'],
  classical: ['classical', 'symphony', 'orchestra', 'concerto', 'opera'],
  electronic: ['electronic', 'edm', 'synth', 'electronica'],
  hiphop: ['hip-hop', 'hip hop', 'hiphop', 'rap', 'trap', 'drill'],
  rnb: ['r&b', 'rnb', 'rhythm and blues', 'neo-soul'],
  soul: ['soul', 'motown', 'funk'],
  country: ['country', 'western', 'bluegrass', 'americana'],
  reggae: ['reggae', 'dancehall', 'dub', 'ska'],
  metal: ['metal', 'heavy metal', 'death metal', 'thrash', 'hardcore'],
  blues: ['blues', 'delta blues', 'chicago blues'],
  folk: ['folk', 'acoustic', 'singer-songwriter'],
  indie: ['indie', 'independent', 'lo-fi', 'bedroom'],
  dance: ['dance', 'club', 'disco', 'house', 'techno'],
  ambient: ['ambient', 'chill', 'downtempo', 'lounge'],
  world: ['world', 'ethnic', 'traditional', 'afrobeat', 'latin'],
  french: ['french', 'français', 'francophone', 'chanson'],
  kpop: ['k-pop', 'kpop', 'korean'],
};

const artistGenreMap: Record<string, string> = {
  booba: 'hiphop',
  nekfeu: 'hiphop',
  orelsan: 'hiphop',
  pnl: 'hiphop',
  jul: 'hiphop',
  damso: 'hiphop',
  ninho: 'hiphop',
  sch: 'hiphop',
  freeze: 'hiphop',
  kaaris: 'hiphop',
  lacrim: 'hiphop',
  leto: 'hiphop',
  gazo: 'hiphop',
  tiakola: 'hiphop',
  stromae: 'pop',
  angèle: 'pop',
  'aya nakamura': 'pop',
  indila: 'pop',
  zaz: 'french',
  'taylor swift': 'pop',
  'ed sheeran': 'pop',
  'dua lipa': 'pop',
  'the weeknd': 'rnb',
  drake: 'hiphop',
  'kendrick lamar': 'hiphop',
  nirvana: 'rock',
  'red hot chili peppers': 'rock',
  'foo fighters': 'rock',
  muse: 'rock',
  radiohead: 'rock',
  'daft punk': 'electronic',
  deadmau5: 'electronic',
  skrillex: 'electronic',
  avicii: 'electronic',
};

function detectGenre(track: Track): string {
  const trackGenre = (track as any).genre?.toLowerCase();
  if (trackGenre) {
    for (const [genre, keywords] of Object.entries(genreKeywords)) {
      if (keywords.some((kw) => trackGenre.includes(kw))) {
        return genre;
      }
    }
    return trackGenre;
  }

  const artistLower = track.artist.toLowerCase();
  for (const [artist, genre] of Object.entries(artistGenreMap)) {
    if (artistLower.includes(artist)) {
      return genre;
    }
  }

  const searchText = `${track.title} ${track.album || ''}`.toLowerCase();
  for (const [genre, keywords] of Object.entries(genreKeywords)) {
    if (keywords.some((kw) => searchText.includes(kw))) {
      return genre;
    }
  }

  if (track.title.match(/remix|mix|edit/i)) {
    return 'electronic';
  }
  if (track.title.match(/cover|acoustic/i)) {
    return 'folk';
  }
  if (track.title.match(/live|concert/i)) {
    return 'rock';
  }

  return 'other';
}

function calculateStats(tracks: Track[], history: HistoryEntry[] = []): ListeningStats {
  if (tracks.length === 0) {
    return {
      totalListeningTime: 0,
      totalTracks: 0,
      totalPlays: 0,
      topArtists: [],
      topGenres: [],
      recentArtists: [],
      dailyListeningTime: 0,
      weeklyListeningTime: 0,
      monthlyListeningTime: 0,
      averageTrackDuration: 0,
      longestSession: 0,
    };
  }

  const trackMap = new Map<string, Track>();
  tracks.forEach((track) => trackMap.set(track.id, track));

  const playCountMap = new Map<string, number>();
  history.forEach((entry) => {
    playCountMap.set(entry.trackId, (playCountMap.get(entry.trackId) || 0) + (entry.playCount || 1));
  });

  const artistStatsMap = new Map<string, ArtistStats>();
  tracks.forEach((track) => {
    const existing = artistStatsMap.get(track.artist) || {
      name: track.artist,
      playCount: 0,
      trackCount: 0,
      imageUrl: track.coverUrl || undefined,
    };
    
    existing.trackCount++;
    existing.playCount += playCountMap.get(track.id) || 0;
    
    if (!existing.imageUrl && track.coverUrl) {
      existing.imageUrl = track.coverUrl;
    }
    
    artistStatsMap.set(track.artist, existing);
  });

  const allArtists = Array.from(artistStatsMap.values());
  const topArtists = [...allArtists]
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, 10);

  const recentArtistNames = new Set<string>();
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
  );
  
  for (const entry of sortedHistory) {
    const track = trackMap.get(entry.trackId);
    if (track) {
      recentArtistNames.add(track.artist);
      if (recentArtistNames.size >= 10) break;
    }
  }
  
  const recentArtists = Array.from(recentArtistNames)
    .map((name) => artistStatsMap.get(name))
    .filter(Boolean) as ArtistStats[];

  const genreMap = new Map<string, number>();
  tracks.forEach((track) => {
    const genre = (track as any).genre || track.album || 'Unknown';
    const plays = playCountMap.get(track.id) || 0;
    genreMap.set(genre, (genreMap.get(genre) || 0) + plays);
  });

  const topGenres = Array.from(genreMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  let totalListeningTime = 0;
  let totalPlays = 0;
  let mostPlayedTrack: { track: Track; playCount: number } | undefined;
  let maxPlayCount = 0;

  playCountMap.forEach((count, trackId) => {
    const track = trackMap.get(trackId);
    if (track) {
      totalListeningTime += track.duration * count;
      totalPlays += count;
      
      if (count > maxPlayCount) {
        maxPlayCount = count;
        mostPlayedTrack = { track, playCount: count };
      }
    }
  });

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  let dailyListeningTime = 0;
  let weeklyListeningTime = 0;
  let monthlyListeningTime = 0;

  history.forEach((entry) => {
    const track = trackMap.get(entry.trackId);
    if (!track) return;

    const playedAt = new Date(entry.playedAt);
    const duration = track.duration * (entry.playCount || 1);

    if (playedAt >= oneDayAgo) {
      dailyListeningTime += duration;
    }
    if (playedAt >= oneWeekAgo) {
      weeklyListeningTime += duration;
    }
    if (playedAt >= oneMonthAgo) {
      monthlyListeningTime += duration;
    }
  });

  const averageTrackDuration =
    tracks.length > 0
      ? tracks.reduce((sum, t) => sum + t.duration, 0) / tracks.length
      : 0;

  return {
    totalListeningTime,
    totalTracks: tracks.length,
    totalPlays,
    topArtists,
    topGenres,
    recentArtists,
    dailyListeningTime,
    weeklyListeningTime,
    monthlyListeningTime,
    averageTrackDuration,
    longestSession: 0,
    mostPlayedTrack,
  };
}

function calculateGenres(tracks: Track[]): Genre[] {
  const genreMap = new Map<string, Genre>();

  tracks.forEach((track) => {
    const genreName = detectGenre(track);
    
    const existing = genreMap.get(genreName) || {
      name: genreName,
      trackCount: 0,
      trackIds: [],
      sampleCoverUrl: undefined,
    };

    existing.trackCount++;
    existing.trackIds.push(track.id);
    
    if (!existing.sampleCoverUrl && track.coverUrl) {
      existing.sampleCoverUrl = track.coverUrl;
    }

    genreMap.set(genreName, existing);
  });

  return Array.from(genreMap.values())
    .filter((g) => g.name !== 'other' || g.trackCount > 5)
    .sort((a, b) => b.trackCount - a.trackCount);
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { id, action, tracks, history = [] } = event.data;

  try {
    let result: WorkerResult = { id };

    if (action === 'stats') {
      result.stats = calculateStats(tracks, history);
    } else if (action === 'genres') {
      result.genres = calculateGenres(tracks);
    } else if (action === 'combined') {
      result.stats = calculateStats(tracks, history);
      result.genres = calculateGenres(tracks);
    }

    self.postMessage(result);
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
