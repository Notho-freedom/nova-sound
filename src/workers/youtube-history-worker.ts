/// <reference lib="webworker" />

interface Video {
  id: string;
  filePath: string;
  title: string;
  description?: string | null;
  duration: number;
  thumbnailUrl?: string | null;
  fileSize: number;
  addedAt: string;
  mediaSource?: string | null;
  youtubeVideoId?: string | null;
  type?: string | null;
  lastPlayedAt?: string | null;
}

interface ComputePayload {
  recentlyWatched: Video[];
  enhancedVideos: Video[];
  rawWatchHistory: Array<{ videoId: string; watchedAt: string }>;
}

interface ComputeResult {
  sorted: Video[];
  missingVideoIds: string[];
}

const extractYouTubeVideoId = (input: string) => {
  if (!input) return null;
  const match = input.match(/(?:v=|\/|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return match ? match[1] : null;
};

const buildVideo = (videoId: string, watchedAt: string, filePath?: string) => ({
  id: `youtube-${videoId}`,
  filePath: filePath || `https://www.youtube.com/watch?v=${videoId}`,
  title: `Vidéo YouTube ${videoId}`,
  description: "",
  duration: 0,
  thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  fileSize: 0,
  addedAt: watchedAt,
  mediaSource: "youtube",
  youtubeVideoId: videoId,
  type: "music_video",
  lastPlayedAt: watchedAt,
});

const compute = (payload: ComputePayload): ComputeResult => {
  const fromRecentlyWatched = payload.recentlyWatched.filter(
    (v) => v.mediaSource === "youtube" || v.youtubeVideoId || (v.filePath && extractYouTubeVideoId(v.filePath))
  );

  const fromEnhancedVideos = payload.enhancedVideos
    .filter((v) => v.mediaSource === "youtube" || v.youtubeVideoId || (v.filePath && extractYouTubeVideoId(v.filePath)))
    .filter((v) => !fromRecentlyWatched.some((rw) => rw.id === v.id));

  const fromRawHistory: Video[] = [];
  const missingVideoIds: string[] = [];
  const existingIds = new Set([...fromRecentlyWatched, ...fromEnhancedVideos].map((v) => v.id));

  for (const entry of payload.rawWatchHistory) {
    if (entry.videoId.startsWith("youtube-") || entry.videoId.includes("youtube-audio-")) {
      const videoId = entry.videoId.replace("youtube-", "").replace("youtube-audio-", "");
      const id = `youtube-${videoId}`;
      if (!existingIds.has(id) && !existingIds.has(entry.videoId)) {
        fromRawHistory.push(buildVideo(videoId, entry.watchedAt));
        missingVideoIds.push(videoId);
      }
    } else {
      const videoId = extractYouTubeVideoId(entry.videoId);
      if (videoId) {
        const id = `youtube-${videoId}`;
        if (!existingIds.has(id) && !existingIds.has(entry.videoId)) {
          fromRawHistory.push(buildVideo(videoId, entry.watchedAt, entry.videoId));
          missingVideoIds.push(videoId);
        }
      }
    }
  }

  const allYouTubeVideos = [...fromRecentlyWatched, ...fromEnhancedVideos, ...fromRawHistory];
  const unique = Array.from(new Map(allYouTubeVideos.map((v) => [v.id, v])).values());

  const sorted = unique.sort((a, b) => {
    const aTime = a.lastPlayedAt ? new Date(a.lastPlayedAt).getTime() : new Date(a.addedAt).getTime();
    const bTime = b.lastPlayedAt ? new Date(b.lastPlayedAt).getTime() : new Date(b.addedAt).getTime();
    return bTime - aTime;
  });

  return { sorted, missingVideoIds };
};

self.onmessage = (event: MessageEvent<{ id: number; payload: ComputePayload }>) => {
  const { id, payload } = event.data;
  const result = compute(payload);
  (self as DedicatedWorkerGlobalScope).postMessage({ id, result });
};

export {};
