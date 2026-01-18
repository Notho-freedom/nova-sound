import { useState, useEffect, useRef } from "react";
import type { Track } from "@/types/music";

interface Genre {
  name: string;
  trackCount: number;
  trackIds: string[];
  sampleCoverUrl?: string;
}

interface UseGenresReturn {
  genres: Genre[];
  getTracksByGenre: (genreName: string) => Track[];
  detectGenre: (track: Track) => string;
}

// Keywords to detect genres from track metadata (copied to worker)
const genreKeywords: Record<string, string[]> = {
  pop: ["pop", "top 40", "chart", "mainstream"],
  rock: ["rock", "alternative", "indie rock", "grunge", "punk"],
  jazz: ["jazz", "smooth jazz", "bebop", "swing"],
  classical: ["classical", "symphony", "orchestra", "concerto", "opera"],
  electronic: ["electronic", "edm", "synth", "electronica"],
  hiphop: ["hip-hop", "hip hop", "hiphop", "rap", "trap", "drill"],
  rnb: ["r&b", "rnb", "rhythm and blues", "neo-soul"],
  soul: ["soul", "motown", "funk"],
  country: ["country", "western", "bluegrass", "americana"],
  reggae: ["reggae", "dancehall", "dub", "ska"],
  metal: ["metal", "heavy metal", "death metal", "thrash", "hardcore"],
  blues: ["blues", "delta blues", "chicago blues"],
  folk: ["folk", "acoustic", "singer-songwriter"],
  indie: ["indie", "independent", "lo-fi", "bedroom"],
  dance: ["dance", "club", "disco", "house", "techno"],
  ambient: ["ambient", "chill", "downtempo", "lounge"],
  world: ["world", "ethnic", "traditional", "afrobeat", "latin"],
  french: ["french", "français", "francophone", "chanson"],
  kpop: ["k-pop", "kpop", "korean"],
};

// Common French/international artists and their likely genres
const artistGenreMap: Record<string, string> = {
  // French Rap/Hip-Hop
  booba: "hiphop",
  nekfeu: "hiphop",
  orelsan: "hiphop",
  pnl: "hiphop",
  jul: "hiphop",
  damso: "hiphop",
  ninho: "hiphop",
  sch: "hiphop",
  freeze: "hiphop",
  kaaris: "hiphop",
  lacrim: "hiphop",
  leto: "hiphop",
  gazo: "hiphop",
  tiakola: "hiphop",
  
  // French Pop/Chanson
  stromae: "pop",
  angèle: "pop",
  "aya nakamura": "pop",
  indila: "pop",
  zaz: "french",
  
  // International Pop
  "taylor swift": "pop",
  "ed sheeran": "pop",
  "dua lipa": "pop",
  "the weeknd": "rnb",
  drake: "hiphop",
  "kendrick lamar": "hiphop",
  
  // Rock
  nirvana: "rock",
  "red hot chili peppers": "rock",
  "foo fighters": "rock",
  muse: "rock",
  radiohead: "rock",
  
  // Electronic
  "daft punk": "electronic",
  deadmau5: "electronic",
  skrillex: "electronic",
  avicii: "electronic",
};

export function useGenres(tracks: Track[]): UseGenresReturn {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [genresMap, setGenresMap] = useState<Map<string, Genre>>(new Map());
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  // Detect genre for a single track (for main thread when needed)
  const detectGenre = (track: Track): string => {
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

    const searchText = `${track.title} ${track.album || ""}`.toLowerCase();
    for (const [genre, keywords] of Object.entries(genreKeywords)) {
      if (keywords.some((kw) => searchText.includes(kw))) {
        return genre;
      }
    }

    if (track.title.match(/remix|mix|edit/i)) {
      return "electronic";
    }
    if (track.title.match(/cover|acoustic/i)) {
      return "folk";
    }
    if (track.title.match(/live|concert/i)) {
      return "rock";
    }

    return "other";
  };

  // Get tracks for a specific genre
  const getTracksByGenre = (genreName: string): Track[] => {
    const genre = genres.find((g) => g.name === genreName);
    if (!genre) return [];

    const trackMap = new Map(tracks.map((t) => [t.id, t]));
    return genre.trackIds
      .map((id) => trackMap.get(id))
      .filter(Boolean) as Track[];
  };

  useEffect(() => {
    const isBrowser = typeof window !== 'undefined';
    if (!isBrowser) return;

    const worker = new Worker(new URL('../workers/stats-worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<{ id: number; genres?: Genre[] }>) => {
      if (event.data.id !== requestIdRef.current) return;
      if (event.data.genres) {
        setGenres(event.data.genres);
        const map = new Map(event.data.genres.map(g => [g.name, g]));
        setGenresMap(map);
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (tracks.length === 0) {
      setGenres([]);
      setGenresMap(new Map());
      return;
    }

    if (workerRef.current) {
      const id = ++requestIdRef.current;
      workerRef.current.postMessage({
        id,
        action: 'genres',
        tracks,
      });
    }
  }, [tracks]);

  return { genres, getTracksByGenre, detectGenre };
}

// Format genre name for display
export function formatGenreName(name: string): string {
  const displayNames: Record<string, string> = {
    hiphop: "Hip-Hop",
    rnb: "R&B",
    kpop: "K-Pop",
    electronic: "Électronique",
    classical: "Classique",
    french: "Chanson Française",
    world: "World Music",
    ambient: "Ambient / Chill",
    other: "Autres",
  };

  return displayNames[name] || name.charAt(0).toUpperCase() + name.slice(1);
}
