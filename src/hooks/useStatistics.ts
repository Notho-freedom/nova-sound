import { useMemo } from "react";
import type { Track } from "@/types/music";

// Interface pour l'historique depuis usePlayHistory
interface HistoryEntry {
  trackId: string;
  playedAt: string;
  playCount: number;
}

export interface Statistics {
  // Totaux
  totalListeningTime: number; // en secondes
  totalTracksPlayed: number;
  uniqueTracksPlayed: number;
  totalPlays: number;
  
  // Top lists
  topArtists: Array<{ name: string; plays: number; time: number }>;
  topAlbums: Array<{ name: string; artist: string; plays: number; time: number }>;
  topGenres: Array<{ name: string; plays: number; time: number }>;
  topTracks: Array<{ track: Track; plays: number; time: number }>;
  
  // Évolution temporelle
  listeningByDate: Array<{ date: string; plays: number; time: number }>;
  listeningByHour: Array<{ hour: number; plays: number; time: number }>;
  listeningByDayOfWeek: Array<{ day: string; plays: number; time: number }>;
  listeningByMonth: Array<{ month: string; plays: number; time: number }>;
  
  // Par décennie
  listeningByDecade: Array<{ decade: string; plays: number; time: number }>;
  
  // Sessions
  averageSessionTime: number;
  longestSession: number;
  totalSessions: number;
}

interface UseStatisticsProps {
  tracks: Track[];
  history: HistoryEntry[];
  period?: "day" | "week" | "month" | "year" | "all";
}

export function useStatistics({ tracks, history, period = "all" }: UseStatisticsProps): Statistics {
  return useMemo(() => {
    // Retourner des statistiques vides si pas de données
    if (!history || history.length === 0 || !tracks || tracks.length === 0) {
      return {
        totalListeningTime: 0,
        totalTracksPlayed: 0,
        uniqueTracksPlayed: 0,
        totalPlays: 0,
        topArtists: [],
        topAlbums: [],
        topGenres: [],
        topTracks: [],
        listeningByDate: [],
        listeningByHour: Array.from({ length: 24 }, (_, i) => ({ hour: i, plays: 0, time: 0 })),
        listeningByDayOfWeek: [
          { day: "Dimanche", plays: 0, time: 0 },
          { day: "Lundi", plays: 0, time: 0 },
          { day: "Mardi", plays: 0, time: 0 },
          { day: "Mercredi", plays: 0, time: 0 },
          { day: "Jeudi", plays: 0, time: 0 },
          { day: "Vendredi", plays: 0, time: 0 },
          { day: "Samedi", plays: 0, time: 0 },
        ],
        listeningByMonth: [],
        listeningByDecade: [],
        averageSessionTime: 0,
        longestSession: 0,
        totalSessions: 0,
      };
    }

    // Filtrer l'historique selon la période
    const now = new Date();
    const filteredHistory = history.filter((entry) => {
      if (period === "all") return true;
      
      const entryDate = new Date(entry.playedAt);
      const diff = now.getTime() - entryDate.getTime();
      
      switch (period) {
        case "day":
          return diff < 24 * 60 * 60 * 1000;
        case "week":
          return diff < 7 * 24 * 60 * 60 * 1000;
        case "month":
          return diff < 30 * 24 * 60 * 60 * 1000;
        case "year":
          return diff < 365 * 24 * 60 * 60 * 1000;
        default:
          return true;
      }
    });

    // Créer un map pour accéder rapidement aux tracks
    const tracksMap = new Map(tracks.map((t) => [t.id, t]));

    // Calculer les totaux
    let totalListeningTime = 0;
    const trackPlays = new Map<string, number>();
    const trackTimes = new Map<string, number>();
    const artistPlays = new Map<string, number>();
    const artistTimes = new Map<string, number>();
    const albumPlays = new Map<string, { plays: number; time: number; artist: string }>();
    const genrePlays = new Map<string, number>();
    const genreTimes = new Map<string, number>();

    // Analyser chaque entrée d'historique
    filteredHistory.forEach((entry) => {
      const track = tracksMap.get(entry.trackId);
      if (!track) return;

      // Utiliser la durée de la piste (l'historique n'a pas de durée)
      const playTime = track.duration || 0;
      totalListeningTime += playTime;

      // Compteurs par piste
      trackPlays.set(entry.trackId, (trackPlays.get(entry.trackId) || 0) + 1);
      trackTimes.set(entry.trackId, (trackTimes.get(entry.trackId) || 0) + playTime);

      // Compteurs par artiste
      artistPlays.set(track.artist, (artistPlays.get(track.artist) || 0) + 1);
      artistTimes.set(track.artist, (artistTimes.get(track.artist) || 0) + playTime);

      // Compteurs par album
      const albumKey = `${track.album}::${track.artist}`;
      const albumData = albumPlays.get(albumKey) || { plays: 0, time: 0, artist: track.artist };
      albumPlays.set(albumKey, {
        plays: albumData.plays + 1,
        time: albumData.time + playTime,
        artist: track.artist,
      });

      // Compteurs par genre
      if (track.genre) {
        genrePlays.set(track.genre, (genrePlays.get(track.genre) || 0) + 1);
        genreTimes.set(track.genre, (genreTimes.get(track.genre) || 0) + playTime);
      }
    });

    // Top artistes
    const topArtists = Array.from(artistPlays.entries())
      .map(([name, plays]) => ({
        name,
        plays,
        time: artistTimes.get(name) || 0,
      }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 10);

    // Top albums
    const topAlbums = Array.from(albumPlays.entries())
      .map(([key, data]) => {
        const [name] = key.split("::");
        return {
          name,
          artist: data.artist,
          plays: data.plays,
          time: data.time,
        };
      })
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 10);

    // Top genres
    const topGenres = Array.from(genrePlays.entries())
      .map(([name, plays]) => ({
        name,
        plays,
        time: genreTimes.get(name) || 0,
      }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 10);

    // Top pistes
    const topTracks = Array.from(trackPlays.entries())
      .map(([trackId, plays]) => {
        const track = tracksMap.get(trackId);
        return track
          ? {
              track,
              plays,
              time: trackTimes.get(trackId) || 0,
            }
          : null;
      })
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 10);

    // Évolution par date
    const dateMap = new Map<string, { plays: number; time: number }>();
    filteredHistory.forEach((entry) => {
      const date = new Date(entry.playedAt).toISOString().split("T")[0];
      const track = tracksMap.get(entry.trackId);
      const playTime = track?.duration || 0;
      const existing = dateMap.get(date) || { plays: 0, time: 0 };
      dateMap.set(date, {
        plays: existing.plays + 1,
        time: existing.time + playTime,
      });
    });
    const listeningByDate = Array.from(dateMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Par heure de la journée
    const hourMap = new Map<number, { plays: number; time: number }>();
    filteredHistory.forEach((entry) => {
      const hour = new Date(entry.playedAt).getHours();
      const track = tracksMap.get(entry.trackId);
      const playTime = track?.duration || 0;
      const existing = hourMap.get(hour) || { plays: 0, time: 0 };
      hourMap.set(hour, {
        plays: existing.plays + 1,
        time: existing.time + playTime,
      });
    });
    const listeningByHour = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      plays: hourMap.get(i)?.plays || 0,
      time: hourMap.get(i)?.time || 0,
    }));

    // Par jour de la semaine
    const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const dayMap = new Map<number, { plays: number; time: number }>();
    filteredHistory.forEach((entry) => {
      const day = new Date(entry.playedAt).getDay();
      const track = tracksMap.get(entry.trackId);
      const playTime = track?.duration || 0;
      const existing = dayMap.get(day) || { plays: 0, time: 0 };
      dayMap.set(day, {
        plays: existing.plays + 1,
        time: existing.time + playTime,
      });
    });
    const listeningByDayOfWeek = Array.from({ length: 7 }, (_, i) => ({
      day: dayNames[i],
      plays: dayMap.get(i)?.plays || 0,
      time: dayMap.get(i)?.time || 0,
    }));

    // Par mois
    const monthNames = [
      "Janvier",
      "Février",
      "Mars",
      "Avril",
      "Mai",
      "Juin",
      "Juillet",
      "Août",
      "Septembre",
      "Octobre",
      "Novembre",
      "Décembre",
    ];
    const monthMap = new Map<string, { plays: number; time: number }>();
    filteredHistory.forEach((entry) => {
      const date = new Date(entry.playedAt);
      const track = tracksMap.get(entry.trackId);
      const playTime = track?.duration || 0;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      const existing = monthMap.get(monthKey) || { plays: 0, time: 0, label: monthLabel };
      monthMap.set(monthKey, {
        plays: existing.plays + 1,
        time: existing.time + playTime,
        label: monthLabel,
      });
    });
    const listeningByMonth = Array.from(monthMap.entries())
      .map(([key, data]) => ({
        month: data.label,
        plays: data.plays,
        time: data.time,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Par décennie
    const decadeMap = new Map<string, { plays: number; time: number }>();
    filteredHistory.forEach((entry) => {
      const track = tracksMap.get(entry.trackId);
      if (!track?.year) return;

      const playTime = track.duration || 0;
      const decade = `${Math.floor(track.year / 10) * 10}s`;
      const existing = decadeMap.get(decade) || { plays: 0, time: 0 };
      decadeMap.set(decade, {
        plays: existing.plays + 1,
        time: existing.time + playTime,
      });
    });
    const listeningByDecade = Array.from(decadeMap.entries())
      .map(([decade, data]) => ({ decade, ...data }))
      .sort((a, b) => a.decade.localeCompare(b.decade));

    // Calcul des sessions (groupes d'écoutes proches dans le temps)
    const sortedHistory = [...filteredHistory].sort(
      (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime()
    );

    let totalSessions = 0;
    let currentSessionTime = 0;
    let longestSession = 0;
    const SESSION_GAP = 30 * 60 * 1000; // 30 minutes

    for (let i = 0; i < sortedHistory.length; i++) {
      const current = new Date(sortedHistory[i].playedAt).getTime();
      const previous = i > 0 ? new Date(sortedHistory[i - 1].playedAt).getTime() : current;

      const track = tracksMap.get(sortedHistory[i].trackId);
      const playTime = track?.duration || 0;

      if (i === 0 || current - previous > SESSION_GAP) {
        // Nouvelle session
        if (i > 0) {
          longestSession = Math.max(longestSession, currentSessionTime);
        }
        totalSessions++;
        currentSessionTime = playTime;
      } else {
        // Même session
        currentSessionTime += playTime;
      }
    }
    longestSession = Math.max(longestSession, currentSessionTime);

    const averageSessionTime =
      totalSessions > 0 ? totalListeningTime / totalSessions : 0;

    return {
      totalListeningTime,
      totalTracksPlayed: filteredHistory.length,
      uniqueTracksPlayed: new Set(filteredHistory.map((e) => e.trackId)).size,
      totalPlays: filteredHistory.length,
      topArtists,
      topAlbums,
      topGenres,
      topTracks,
      listeningByDate,
      listeningByHour,
      listeningByDayOfWeek,
      listeningByMonth,
      listeningByDecade,
      averageSessionTime,
      longestSession,
      totalSessions,
    };
  }, [tracks, history, period]);
}

// Fonction utilitaire pour formater le temps
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// Fonction utilitaire pour formater le temps long
export function formatLongTime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}j ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

