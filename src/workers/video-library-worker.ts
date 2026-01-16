/// <reference lib="webworker" />

import type { Video, VideoGenre, WatchProgress } from "@/types/music";

type VideoLibraryState = {
  watchlist: string[];
  favorites: string[];
  watchHistory: { videoId: string; watchedAt: string }[];
  watchProgress: Record<string, WatchProgress>;
  userRatings: Record<string, number>;
};

interface ComputePayload {
  videos: Video[];
  state: VideoLibraryState;
}

interface ComputeResult {
  enhancedVideos: Video[];
  continueWatching: Video[];
  recentlyAdded: Video[];
  recentlyWatched: Video[];
  watchlistVideos: Video[];
  favoriteVideos: Video[];
  availableGenres: VideoGenre[];
  genreMap: Record<string, Video[]>;
  movies: Video[];
  series: Video[];
  episodes: Video[];
  clips: Video[];
}

const compute = (payload: ComputePayload): ComputeResult => {
  const { videos, state } = payload;

  const enhancedVideos = videos.map((video) => ({
    ...video,
    isFavorite: state.favorites.includes(video.id),
    isInWatchlist: state.watchlist.includes(video.id),
    watchProgress: state.watchProgress[video.id] || undefined,
    userRating: state.userRatings[video.id] || undefined,
  }));

  const continueWatching = enhancedVideos
    .filter((v) => v.watchProgress && !v.watchProgress.completed && v.watchProgress.percentage > 5)
    .sort((a, b) => {
      const aTime = new Date(a.watchProgress!.lastWatchedAt).getTime();
      const bTime = new Date(b.watchProgress!.lastWatchedAt).getTime();
      return bTime - aTime;
    });

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentlyAdded = enhancedVideos
    .filter((v) => new Date(v.addedAt).getTime() > thirtyDaysAgo)
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());

  const watchedIds = state.watchHistory.map((h) => h.videoId);
  const recentlyWatched = watchedIds
    .map((id) => enhancedVideos.find((v) => v.id === id))
    .filter(Boolean) as Video[];

  const watchlistVideos = enhancedVideos.filter((v) => state.watchlist.includes(v.id));
  const favoriteVideos = enhancedVideos.filter((v) => state.favorites.includes(v.id));

  const genreSet = new Set<VideoGenre>();
  const genreMap: Record<string, Video[]> = {};
  enhancedVideos.forEach((v) => {
    v.genres?.forEach((g) => {
      genreSet.add(g);
      if (!genreMap[g]) genreMap[g] = [];
      genreMap[g].push(v);
    });
  });

  const availableGenres = Array.from(genreSet).sort();

  const movies = enhancedVideos.filter((v) => v.type === "movie");
  const series = enhancedVideos.filter((v) => v.type === "series");
  const episodes = enhancedVideos.filter((v) => v.type === "episode");
  const clips = enhancedVideos.filter((v) => v.type === "clip" || v.type === "music_video");

  return {
    enhancedVideos,
    continueWatching,
    recentlyAdded,
    recentlyWatched,
    watchlistVideos,
    favoriteVideos,
    availableGenres,
    genreMap,
    movies,
    series,
    episodes,
    clips,
  };
};

self.onmessage = (event: MessageEvent<{ id: number; payload: ComputePayload }>) => {
  const { id, payload } = event.data;
  const result = compute(payload);
  (self as DedicatedWorkerGlobalScope).postMessage({ id, result });
};

export {};
