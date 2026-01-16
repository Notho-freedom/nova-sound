/// <reference lib="webworker" />

type SortOption = "recent" | "title" | "duration" | "size" | "rating" | "added";

type ViewMode = "home" | "browse" | "watchlist" | "favorites" | "history" | "youtube";

type VideoGenre = string;

interface VideoRating {
  value?: number;
}

interface Video {
  id: string;
  filePath: string;
  title: string;
  description?: string | null;
  director?: string | null;
  cast?: string[] | null;
  genres?: VideoGenre[] | null;
  duration: number;
  fileSize: number;
  userRating?: number | null;
  ratings?: VideoRating[] | null;
  addedAt: string;
  lastPlayedAt?: string | null;
}

interface ComputePayload {
  enhancedVideos: Video[];
  continueWatching: Video[];
  recentlyAdded: Video[];
  recentlyWatched: Video[];
  watchlistVideos: Video[];
  favoriteVideos: Video[];
  viewMode: ViewMode;
  searchQuery: string;
  selectedGenre: VideoGenre | null;
  sortBy: SortOption;
}

interface ComputeResult {
  featuredVideos: Video[];
  filteredVideos: Video[];
  displayVideos: Video[];
}

const dedupeVideos = (videos: Video[]) => {
  const seen = new Set<string>();
  const result: Video[] = [];
  for (const video of videos) {
    if (!video?.id || seen.has(video.id)) continue;
    seen.add(video.id);
    result.push(video);
  }
  return result;
};

const computeFeatured = (payload: ComputePayload) => {
  const videos: Video[] = [];
  videos.push(...payload.continueWatching);
  videos.push(...payload.recentlyAdded);
  videos.push(...payload.recentlyWatched);

  const topRated = [...payload.enhancedVideos]
    .filter((v) => v.ratings && v.ratings.length > 0)
    .sort((a, b) => {
      const aRating = a.ratings?.[0]?.value || 0;
      const bRating = b.ratings?.[0]?.value || 0;
      return bRating - aRating;
    });

  videos.push(...topRated);
  return dedupeVideos(videos);
};

const computeFiltered = (payload: ComputePayload) => {
  let result = [...payload.enhancedVideos];

  if (payload.searchQuery.trim()) {
    const query = payload.searchQuery.toLowerCase();
    result = result.filter(
      (v) =>
        (v.title?.toLowerCase() || "").includes(query) ||
        (v.description?.toLowerCase() || "").includes(query) ||
        (v.director?.toLowerCase() || "").includes(query) ||
        (v.cast?.some((c) => (c?.toLowerCase() || "").includes(query)) || false)
    );
  }

  const selectedGenre = payload.selectedGenre ?? undefined;
  if (selectedGenre) {
    result = result.filter((v) => v.genres?.includes(selectedGenre));
  }

  switch (payload.sortBy) {
    case "title":
      result.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
      break;
    case "duration":
      result.sort((a, b) => (b.duration || 0) - (a.duration || 0));
      break;
    case "size":
      result.sort((a, b) => (b.fileSize || 0) - (a.fileSize || 0));
      break;
    case "rating":
      result.sort((a, b) => (b.userRating || 0) - (a.userRating || 0));
      break;
    case "added":
      result.sort((a, b) => new Date(b.addedAt || 0).getTime() - new Date(a.addedAt || 0).getTime());
      break;
    case "recent":
    default:
      result.sort((a, b) => {
        const aTime = a.lastPlayedAt ? new Date(a.lastPlayedAt).getTime() : 0;
        const bTime = b.lastPlayedAt ? new Date(b.lastPlayedAt).getTime() : 0;
        return bTime - aTime || new Date(b.addedAt || 0).getTime() - new Date(a.addedAt || 0).getTime();
      });
  }

  return result;
};

const computeDisplay = (payload: ComputePayload, filteredVideos: Video[]) => {
  switch (payload.viewMode) {
    case "watchlist":
      return payload.watchlistVideos;
    case "favorites":
      return payload.favoriteVideos;
    case "history":
      return payload.recentlyWatched;
    case "browse":
      return filteredVideos;
    case "youtube":
      return [];
    case "home":
    default:
      return payload.enhancedVideos;
  }
};

const compute = (payload: ComputePayload): ComputeResult => {
  const featuredVideos = computeFeatured(payload);
  const filteredVideos = computeFiltered(payload);
  const displayVideos = computeDisplay(payload, filteredVideos);

  return { featuredVideos, filteredVideos, displayVideos };
};

self.onmessage = (event: MessageEvent<{ id: number; payload: ComputePayload }>) => {
  const { id, payload } = event.data;
  const result = compute(payload);
  (self as DedicatedWorkerGlobalScope).postMessage({ id, result });
};

export {};
