/**
 * Enhanced useGenres hook with Upstash caching
 * Loads genres from cache on first visit to app
 * Falls back to worker calculation if cache miss
 */

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
  isCached: boolean;
}

// Keywords to detect genres (copied from worker)
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

const artistGenreMap: Record<string, string> = {
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
  stromae: "pop",
  angèle: "pop",
  "aya nakamura": "pop",
  indila: "pop",
  zaz: "french",
  "taylor swift": "pop",
  "ed sheeran": "pop",
  "dua lipa": "pop",
  "the weeknd": "rnb",
  drake: "hiphop",
  "kendrick lamar": "hiphop",
  nirvana: "rock",
  "red hot chili peppers": "rock",
  "foo fighters": "rock",
  muse: "rock",
  radiohead: "rock",
  "daft punk": "electronic",
  deadmau5: "electronic",
  skrillex: "electronic",
  avicii: "electronic",
};

export function useGenresCached(
  tracks: Track[],
  userId: string | null = null
): UseGenresReturn {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [isCached, setIsCached] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  const detectGenre = (track: Track): string => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trackGenre = ((track as any).genre as string | undefined)?.toLowerCase();
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

  const getTracksByGenre = (genreName: string): Track[] => {
    const genre = genres.find((g) => g.name === genreName);
    if (!genre) return [];

    const trackMap = new Map(tracks.map((t) => [t.id, t]));
    return genre.trackIds
      .map((id) => trackMap.get(id))
      .filter(Boolean) as Track[];
  };

  useEffect(() => {
    const isBrowser = typeof window !== "undefined";
    if (!isBrowser) return;

    const worker = new Worker(new URL("../workers/stats-worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<{ id: number; genres?: Genre[] }>) => {
      if (event.data.id !== requestIdRef.current) return;
      if (event.data.genres) {
        setGenres(event.data.genres);
        setIsCached(false);

        // Store in Upstash cache
        if (tracks.length > 0) {
          (async () => {
            try {
              const { genresCache } = await import("@/lib/upstash-cache");
              await genresCache.set(userId, tracks.map(t => t.id), event.data.genres);
            } catch (err) {
              console.debug("[useGenresCached] Cache write skipped:", err);
            }
          })();
        }
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tracks.length]);

  useEffect(() => {
    if (tracks.length === 0) {
      setGenres([]);
      setIsCached(false);
      return;
    }

    // Check cache first
    (async () => {
      try {
        const { genresCache } = await import("@/lib/upstash-cache");
        const cached = await genresCache.get(userId, tracks.map(t => t.id));

        if (cached) {
          // Found in cache!
          setGenres(cached);
          setIsCached(true);
          console.log("[useGenresCached] 🚀 Loaded from cache");
          return; // Don't recalculate if cached
        }

        // Not in cache, trigger worker calculation
        if (workerRef.current) {
          const id = ++requestIdRef.current;
          setIsCached(false);
          workerRef.current.postMessage({
            id,
            action: "genres",
            tracks,
          });
        }
      } catch (err) {
        console.debug("[useGenresCached] Cache check skipped:", err);
        // Fallback to calculation
        if (workerRef.current) {
          const id = ++requestIdRef.current;
          setIsCached(false);
          workerRef.current.postMessage({
            id,
            action: "genres",
            tracks,
          });
        }
      }
    })();
  }, [tracks, userId]);

  return { genres, getTracksByGenre, detectGenre, isCached };
}

// Export original hook as fallback
export { useGenres } from "./useGenres";
