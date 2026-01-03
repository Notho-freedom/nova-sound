import { useState, useEffect, useCallback, useMemo } from "react";
import type { Video, VideoGenre, WatchProgress } from "@/types/music";
import { useVideos } from "./useVideos";

// Storage keys
const WATCHLIST_KEY = "nexus-video-watchlist";
const FAVORITES_KEY = "nexus-video-favorites";
const WATCH_HISTORY_KEY = "nexus-video-watch-history";
const WATCH_PROGRESS_KEY = "nexus-video-watch-progress";
const USER_RATINGS_KEY = "nexus-video-user-ratings";

interface VideoLibraryState {
  watchlist: string[];
  favorites: string[];
  watchHistory: { videoId: string; watchedAt: string }[];
  watchProgress: Record<string, WatchProgress>;
  userRatings: Record<string, number>;
}

interface UseVideoLibraryReturn {
  // Base videos
  videos: Video[];
  loading: boolean;
  error: string | null;
  
  // Enhanced video with user data
  enhancedVideos: Video[];
  
  // Filtered collections
  continueWatching: Video[];
  recentlyAdded: Video[];
  recentlyWatched: Video[];
  watchlistVideos: Video[];
  favoriteVideos: Video[];
  
  // By genre
  getVideosByGenre: (genre: VideoGenre) => Video[];
  availableGenres: VideoGenre[];
  
  // By type
  movies: Video[];
  series: Video[];
  episodes: Video[];
  clips: Video[];
  
  // Actions
  addToWatchlist: (videoId: string) => void;
  removeFromWatchlist: (videoId: string) => void;
  isInWatchlist: (videoId: string) => boolean;
  
  toggleFavorite: (videoId: string) => void;
  isFavorite: (videoId: string) => boolean;
  
  updateWatchProgress: (videoId: string, currentTime: number, duration: number) => void;
  getWatchProgress: (videoId: string) => WatchProgress | null;
  clearWatchProgress: (videoId: string) => void;
  markAsWatched: (videoId: string) => void;
  markAsUnwatched: (videoId: string) => void;
  
  setUserRating: (videoId: string, rating: number) => void;
  getUserRating: (videoId: string) => number | null;
  
  addToWatchHistory: (videoId: string) => void;
  
  // Search & Filter
  searchVideos: (query: string) => Video[];
  filterByGenre: (genre: VideoGenre | null) => Video[];
  
  // Video operations from useVideos
  scanVideos: (directories?: string[]) => Promise<void>;
  selectVideoFolders: () => Promise<string[]>;
  addVideoFiles: (filePaths: string[]) => Promise<void>;
  addVideoFromUrl: (url: string, title?: string) => Promise<void>;
  refreshVideos: () => Promise<void>;
}

export function useVideoLibrary(): UseVideoLibraryReturn {
  const {
    videos,
    loading,
    error,
    scanVideos,
    selectVideoFolders,
    addVideoFiles,
    addVideoFromUrl,
    refreshVideos,
  } = useVideos();

  const [state, setState] = useState<VideoLibraryState>({
    watchlist: [],
    favorites: [],
    watchHistory: [],
    watchProgress: {},
    userRatings: {},
  });

  // Load state from localStorage
  useEffect(() => {
    try {
      const watchlist = JSON.parse(localStorage.getItem(WATCHLIST_KEY) || "[]");
      const favorites = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
      const watchHistory = JSON.parse(localStorage.getItem(WATCH_HISTORY_KEY) || "[]");
      const watchProgress = JSON.parse(localStorage.getItem(WATCH_PROGRESS_KEY) || "{}");
      const userRatings = JSON.parse(localStorage.getItem(USER_RATINGS_KEY) || "{}");

      setState({
        watchlist,
        favorites,
        watchHistory,
        watchProgress,
        userRatings,
      });
    } catch (err) {
      console.error("Failed to load video library state:", err);
    }
  }, []);

  // Save state to localStorage
  const saveState = useCallback((newState: Partial<VideoLibraryState>) => {
    setState((prev) => {
      const updated = { ...prev, ...newState };
      
      if (newState.watchlist !== undefined) {
        localStorage.setItem(WATCHLIST_KEY, JSON.stringify(updated.watchlist));
      }
      if (newState.favorites !== undefined) {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated.favorites));
      }
      if (newState.watchHistory !== undefined) {
        localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(updated.watchHistory));
      }
      if (newState.watchProgress !== undefined) {
        localStorage.setItem(WATCH_PROGRESS_KEY, JSON.stringify(updated.watchProgress));
      }
      if (newState.userRatings !== undefined) {
        localStorage.setItem(USER_RATINGS_KEY, JSON.stringify(updated.userRatings));
      }
      
      return updated;
    });
  }, []);

  // Enhanced videos with user data
  const enhancedVideos = useMemo(() => {
    return videos.map((video) => ({
      ...video,
      isFavorite: state.favorites.includes(video.id),
      isInWatchlist: state.watchlist.includes(video.id),
      watchProgress: state.watchProgress[video.id] || undefined,
      userRating: state.userRatings[video.id] || undefined,
    }));
  }, [videos, state]);

  // Continue watching (videos with progress but not completed)
  const continueWatching = useMemo(() => {
    return enhancedVideos
      .filter((v) => v.watchProgress && !v.watchProgress.completed && v.watchProgress.percentage > 5)
      .sort((a, b) => {
        const aTime = new Date(a.watchProgress!.lastWatchedAt).getTime();
        const bTime = new Date(b.watchProgress!.lastWatchedAt).getTime();
        return bTime - aTime;
      });
  }, [enhancedVideos]);

  // Recently added (last 30 days)
  const recentlyAdded = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return enhancedVideos
      .filter((v) => new Date(v.addedAt).getTime() > thirtyDaysAgo)
      .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  }, [enhancedVideos]);

  // Recently watched
  const recentlyWatched = useMemo(() => {
    const watchedIds = state.watchHistory.map((h) => h.videoId);
    return watchedIds
      .map((id) => enhancedVideos.find((v) => v.id === id))
      .filter((v) => v !== undefined) as Video[];
  }, [enhancedVideos, state.watchHistory]);

  // Watchlist videos
  const watchlistVideos = useMemo(() => {
    return enhancedVideos.filter((v) => state.watchlist.includes(v.id));
  }, [enhancedVideos, state.watchlist]);

  // Favorite videos
  const favoriteVideos = useMemo(() => {
    return enhancedVideos.filter((v) => state.favorites.includes(v.id));
  }, [enhancedVideos, state.favorites]);

  // Available genres
  const availableGenres = useMemo(() => {
    const genreSet = new Set<VideoGenre>();
    enhancedVideos.forEach((v) => {
      v.genres?.forEach((g) => genreSet.add(g));
    });
    return Array.from(genreSet).sort();
  }, [enhancedVideos]);

  // Get videos by genre
  const getVideosByGenre = useCallback(
    (genre: VideoGenre) => {
      return enhancedVideos.filter((v) => v.genres?.includes(genre));
    },
    [enhancedVideos]
  );

  // Videos by type
  const movies = useMemo(() => enhancedVideos.filter((v) => v.type === "movie"), [enhancedVideos]);
  const series = useMemo(() => enhancedVideos.filter((v) => v.type === "series"), [enhancedVideos]);
  const episodes = useMemo(() => enhancedVideos.filter((v) => v.type === "episode"), [enhancedVideos]);
  const clips = useMemo(() => enhancedVideos.filter((v) => v.type === "clip" || v.type === "music_video"), [enhancedVideos]);

  // Watchlist actions
  const addToWatchlist = useCallback(
    (videoId: string) => {
      if (!state.watchlist.includes(videoId)) {
        saveState({ watchlist: [...state.watchlist, videoId] });
      }
    },
    [state.watchlist, saveState]
  );

  const removeFromWatchlist = useCallback(
    (videoId: string) => {
      saveState({ watchlist: state.watchlist.filter((id) => id !== videoId) });
    },
    [state.watchlist, saveState]
  );

  const isInWatchlist = useCallback(
    (videoId: string) => state.watchlist.includes(videoId),
    [state.watchlist]
  );

  // Favorites actions
  const toggleFavorite = useCallback(
    (videoId: string) => {
      const isFav = state.favorites.includes(videoId);
      if (isFav) {
        saveState({ favorites: state.favorites.filter((id) => id !== videoId) });
      } else {
        saveState({ favorites: [...state.favorites, videoId] });
      }
    },
    [state.favorites, saveState]
  );

  const isFavorite = useCallback(
    (videoId: string) => state.favorites.includes(videoId),
    [state.favorites]
  );

  // Watch progress actions
  const updateWatchProgress = useCallback(
    (videoId: string, currentTime: number, duration: number) => {
      const percentage = duration > 0 ? (currentTime / duration) * 100 : 0;
      const completed = percentage >= 90;

      const progress: WatchProgress = {
        videoId,
        currentTime,
        duration,
        percentage,
        lastWatchedAt: new Date().toISOString(),
        completed,
      };

      saveState({
        watchProgress: { ...state.watchProgress, [videoId]: progress },
      });
    },
    [state.watchProgress, saveState]
  );

  const getWatchProgress = useCallback(
    (videoId: string) => state.watchProgress[videoId] || null,
    [state.watchProgress]
  );

  const clearWatchProgress = useCallback(
    (videoId: string) => {
      const { [videoId]: _, ...rest } = state.watchProgress;
      saveState({ watchProgress: rest });
    },
    [state.watchProgress, saveState]
  );

  const markAsWatched = useCallback(
    (videoId: string) => {
      const video = videos.find((v) => v.id === videoId);
      if (video) {
        const progress: WatchProgress = {
          videoId,
          currentTime: video.duration,
          duration: video.duration,
          percentage: 100,
          lastWatchedAt: new Date().toISOString(),
          completed: true,
        };
        saveState({
          watchProgress: { ...state.watchProgress, [videoId]: progress },
        });
      }
    },
    [videos, state.watchProgress, saveState]
  );

  const markAsUnwatched = useCallback(
    (videoId: string) => {
      const { [videoId]: _, ...rest } = state.watchProgress;
      saveState({ watchProgress: rest });
    },
    [state.watchProgress, saveState]
  );

  // User ratings
  const setUserRating = useCallback(
    (videoId: string, rating: number) => {
      if (rating === 0) {
        const { [videoId]: _, ...rest } = state.userRatings;
        saveState({ userRatings: rest });
      } else {
        saveState({
          userRatings: { ...state.userRatings, [videoId]: rating },
        });
      }
    },
    [state.userRatings, saveState]
  );

  const getUserRating = useCallback(
    (videoId: string) => state.userRatings[videoId] || null,
    [state.userRatings]
  );

  // Watch history
  const addToWatchHistory = useCallback(
    (videoId: string) => {
      const newEntry = { videoId, watchedAt: new Date().toISOString() };
      // Remove existing entry for this video and add new one at the start
      const filtered = state.watchHistory.filter((h) => h.videoId !== videoId);
      saveState({ watchHistory: [newEntry, ...filtered].slice(0, 100) });
    },
    [state.watchHistory, saveState]
  );

  // Search videos
  const searchVideos = useCallback(
    (query: string) => {
      const q = query.toLowerCase().trim();
      if (!q) return enhancedVideos;

      return enhancedVideos.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.description?.toLowerCase().includes(q) ||
          v.director?.toLowerCase().includes(q) ||
          v.cast?.some((c) => c.toLowerCase().includes(q)) ||
          v.genres?.some((g) => g.toLowerCase().includes(q)) ||
          v.tags?.some((t) => t.toLowerCase().includes(q))
      );
    },
    [enhancedVideos]
  );

  // Filter by genre
  const filterByGenre = useCallback(
    (genre: VideoGenre | null) => {
      if (!genre) return enhancedVideos;
      return enhancedVideos.filter((v) => v.genres?.includes(genre));
    },
    [enhancedVideos]
  );

  return {
    videos,
    loading,
    error,
    enhancedVideos,
    continueWatching,
    recentlyAdded,
    recentlyWatched,
    watchlistVideos,
    favoriteVideos,
    getVideosByGenre,
    availableGenres,
    movies,
    series,
    episodes,
    clips,
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist,
    toggleFavorite,
    isFavorite,
    updateWatchProgress,
    getWatchProgress,
    clearWatchProgress,
    markAsWatched,
    markAsUnwatched,
    setUserRating,
    getUserRating,
    addToWatchHistory,
    searchVideos,
    filterByGenre,
    scanVideos,
    selectVideoFolders,
    addVideoFiles,
    addVideoFromUrl,
    refreshVideos,
  };
}

