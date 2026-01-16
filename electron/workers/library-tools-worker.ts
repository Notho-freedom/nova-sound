import { parentPort } from "worker_threads";
import * as fs from "fs/promises";

interface ScannedTrack {
  id: string;
  filePath: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverUrl: string;
  year?: number;
  genre?: string;
  trackNumber?: number;
  discNumber?: number;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  format: string;
  addedAt: string;
  fileSize: number;
  lastModified: string;
}

interface QualityAnalysis {
  highQuality: ScannedTrack[];
  mediumQuality: ScannedTrack[];
  lowQuality: ScannedTrack[];
  unknown: ScannedTrack[];
  stats: {
    totalTracks: number;
    highQualityCount: number;
    mediumQualityCount: number;
    lowQualityCount: number;
    unknownCount: number;
    averageBitrate: number;
    formats: Record<string, number>;
  };
}

interface DuplicateGroup {
  tracks: ScannedTrack[];
  reason: "exact-match" | "similar-duration" | "title-artist";
  confidence: number;
}

interface IntegrityCheckResult {
  totalTracks: number;
  missingFiles: ScannedTrack[];
  validFiles: ScannedTrack[];
  stats: {
    missing: number;
    valid: number;
    percentage: number;
  };
}

interface MetadataCompletionReport {
  withoutCover: ScannedTrack[];
  withoutGenre: ScannedTrack[];
  withoutYear: ScannedTrack[];
  withoutArtist: ScannedTrack[];
  complete: ScannedTrack[];
  stats: {
    totalTracks: number;
    missingCover: number;
    missingGenre: number;
    missingYear: number;
    missingArtist: number;
    complete: number;
    completionPercentage: number;
  };
}

type WorkerTask = "analyzeQuality" | "detectDuplicates" | "checkIntegrity" | "analyzeMetadata";

interface WorkerPayload {
  task: WorkerTask;
  tracks: ScannedTrack[];
}

const analyzeQuality = async (tracks: ScannedTrack[]): Promise<QualityAnalysis> => {
  const highQuality: ScannedTrack[] = [];
  const mediumQuality: ScannedTrack[] = [];
  const lowQuality: ScannedTrack[] = [];
  const unknown: ScannedTrack[] = [];
  const formats: Record<string, number> = {};

  let totalBitrate = 0;
  let bitrateCount = 0;

  for (const track of tracks) {
    const bitrate = track.bitrate || 0;
    const format = track.format?.toUpperCase() || "UNKNOWN";

    formats[format] = (formats[format] || 0) + 1;

    if (bitrate === 0) {
      unknown.push(track);
    } else if (bitrate >= 320) {
      highQuality.push(track);
      totalBitrate += bitrate;
      bitrateCount++;
    } else if (bitrate >= 128) {
      mediumQuality.push(track);
      totalBitrate += bitrate;
      bitrateCount++;
    } else {
      lowQuality.push(track);
      totalBitrate += bitrate;
      bitrateCount++;
    }
  }

  return {
    highQuality,
    mediumQuality,
    lowQuality,
    unknown,
    stats: {
      totalTracks: tracks.length,
      highQualityCount: highQuality.length,
      mediumQualityCount: mediumQuality.length,
      lowQualityCount: lowQuality.length,
      unknownCount: unknown.length,
      averageBitrate: bitrateCount > 0 ? Math.round(totalBitrate / bitrateCount) : 0,
      formats,
    },
  };
};

const detectDuplicates = async (tracks: ScannedTrack[]): Promise<DuplicateGroup[]> => {
  const groups: Map<string, ScannedTrack[]> = new Map();
  const processed = new Set<string>();
  const duplicateGroups: DuplicateGroup[] = [];

  for (const track of tracks) {
    const key = `${track.title}:${track.artist}`.toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(track);
  }

  for (const [, group] of groups.entries()) {
    if (group.length > 1) {
      const allProcessed = group.every(t => processed.has(t.id));

      if (!allProcessed) {
        duplicateGroups.push({
          tracks: group,
          reason: "exact-match",
          confidence: 100,
        });
        group.forEach(t => processed.add(t.id));
      }
    }
  }

  const durationGroups: Map<number, ScannedTrack[]> = new Map();
  for (const track of tracks) {
    if (processed.has(track.id)) continue;

    const bucket = Math.round(track.duration / 5) * 5;
    if (!durationGroups.has(bucket)) {
      durationGroups.set(bucket, []);
    }
    durationGroups.get(bucket)!.push(track);
  }

  for (const [, group] of durationGroups.entries()) {
    if (group.length > 1) {
      const similarTracks: ScannedTrack[] = [];
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const t1 = group[i];
          const t2 = group[j];

          const titleSimilar = levenshteinDistance(t1.title, t2.title) <= 3;
          const artistSimilar = levenshteinDistance(t1.artist, t2.artist) <= 2;

          if ((titleSimilar || artistSimilar) && !processed.has(t1.id) && !processed.has(t2.id)) {
            if (!similarTracks.includes(t1)) similarTracks.push(t1);
            if (!similarTracks.includes(t2)) similarTracks.push(t2);
          }
        }
      }

      if (similarTracks.length > 1) {
        duplicateGroups.push({
          tracks: similarTracks,
          reason: "similar-duration",
          confidence: 70,
        });
        similarTracks.forEach(t => processed.add(t.id));
      }
    }
  }

  return duplicateGroups;
};

const checkIntegrity = async (tracks: ScannedTrack[]): Promise<IntegrityCheckResult> => {
  const missing: ScannedTrack[] = [];
  const valid: ScannedTrack[] = [];

  for (const track of tracks) {
    try {
      await fs.access(track.filePath);
      valid.push(track);
    } catch {
      missing.push(track);
    }
  }

  return {
    totalTracks: tracks.length,
    missingFiles: missing,
    validFiles: valid,
    stats: {
      missing: missing.length,
      valid: valid.length,
      percentage: tracks.length > 0 ? Math.round((valid.length / tracks.length) * 100) : 0,
    },
  };
};

const analyzeMetadata = async (tracks: ScannedTrack[]): Promise<MetadataCompletionReport> => {
  const withoutCover = tracks.filter(t => !t.coverUrl);
  const withoutGenre = tracks.filter(t => !t.genre);
  const withoutYear = tracks.filter(t => !t.year);
  const withoutArtist = tracks.filter(t => !t.artist || t.artist === "Artiste inconnu");

  const complete = tracks.filter(t =>
    t.coverUrl && t.genre && t.year && t.artist && t.artist !== "Artiste inconnu"
  );

  const totalMetadataFields = tracks.length * 4;
  const missingFields =
    withoutCover.length +
    withoutGenre.length +
    withoutYear.length +
    withoutArtist.length;
  const completionPercentage = totalMetadataFields > 0
    ? Math.round(((totalMetadataFields - missingFields) / totalMetadataFields) * 100)
    : 0;

  return {
    withoutCover,
    withoutGenre,
    withoutYear,
    withoutArtist,
    complete,
    stats: {
      totalTracks: tracks.length,
      missingCover: withoutCover.length,
      missingGenre: withoutGenre.length,
      missingYear: withoutYear.length,
      missingArtist: withoutArtist.length,
      complete: complete.length,
      completionPercentage,
    },
  };
};

function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const d: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) d[i][0] = i;
  for (let j = 0; j <= len2; j++) d[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
    }
  }

  return d[len1][len2];
}

const runTask = async (payload: WorkerPayload) => {
  switch (payload.task) {
    case "analyzeQuality":
      return analyzeQuality(payload.tracks);
    case "detectDuplicates":
      return detectDuplicates(payload.tracks);
    case "checkIntegrity":
      return checkIntegrity(payload.tracks);
    case "analyzeMetadata":
      return analyzeMetadata(payload.tracks);
    default:
      throw new Error(`Unknown task: ${payload.task}`);
  }
};

parentPort?.on("message", async (message: { id: number; payload: WorkerPayload }) => {
  try {
    const result = await runTask(message.payload);
    parentPort?.postMessage({ id: message.id, result });
  } catch (error) {
    parentPort?.postMessage({ id: message.id, error: (error as Error).message });
  }
});
