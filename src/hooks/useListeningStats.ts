import { useState, useEffect, useMemo } from "react";
import type { Track } from "@/types/music";

interface HistoryEntry {
  trackId: string;
  playedAt: string;
  playCount: number;
}

interface ArtistStats {
  name: string;
  playCount: number;
  trackCount: number;
  imageUrl?: string;
}

interface ListeningStats {
  totalListeningTime: number; // in seconds
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

interface UseListeningStatsReturn {
  stats: ListeningStats | null;
  loading: boolean;
  refresh: () => void;
}

export function useListeningStats(
  tracks: Track[],
  history: HistoryEntry[] = []
): UseListeningStatsReturn {
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey((prev) => prev + 1);

  const stats = useMemo<ListeningStats | null>(() => {
    if (tracks.length === 0) {
      setLoading(false);
      return null;
    }

    setLoading(true);

    // Create a map of trackId -> track for quick lookup
    const trackMap = new Map<string, Track>();
    tracks.forEach((track) => trackMap.set(track.id, track));

    // Calculate play counts per track
    const playCountMap = new Map<string, number>();
    history.forEach((entry) => {
      playCountMap.set(entry.trackId, (playCountMap.get(entry.trackId) || 0) + (entry.playCount || 1));
    });

    // Calculate artist stats
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
      
      // Use the first available cover as artist image
      if (!existing.imageUrl && track.coverUrl) {
        existing.imageUrl = track.coverUrl;
      }
      
      artistStatsMap.set(track.artist, existing);
    });

    const allArtists = Array.from(artistStatsMap.values());
    const topArtists = [...allArtists]
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 10);

    // Get recent artists from history
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

    // Calculate genre stats (using album as genre proxy if no genre field)
    const genreMap = new Map<string, number>();
    tracks.forEach((track) => {
      // Try to extract genre from track metadata or use album
      const genre = (track as any).genre || track.album || "Unknown";
      const plays = playCountMap.get(track.id) || 0;
      genreMap.set(genre, (genreMap.get(genre) || 0) + plays);
    });

    const topGenres = Array.from(genreMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate total listening time
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

    // Calculate time-based stats
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

    setLoading(false);

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
      longestSession: 0, // Would need session tracking to calculate
      mostPlayedTrack,
    };
  }, [tracks, history, refreshKey]);

  return { stats, loading, refresh };
}

// Helper function to format duration
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}min`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
}

// Helper function to format large numbers
export function formatCount(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1000000).toFixed(1)}M`;
}
