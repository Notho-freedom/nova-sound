import type { ScannedTrack } from './audio-scanner.js';
import { storage } from './storage.js';
import { WorkerPool } from './worker-pool.js';
import * as os from 'os';

type LibraryToolsTask = 'analyzeQuality' | 'detectDuplicates' | 'checkIntegrity' | 'analyzeMetadata';

interface WorkerPayload {
  task: LibraryToolsTask;
  tracks: ScannedTrack[];
}

const libraryToolsWorkerPool = new WorkerPool<WorkerPayload, unknown>(
  new URL('../workers/library-tools-worker.js', import.meta.url),
  Math.max(2, Math.min(4, Math.max(1, os.cpus().length - 1)))
);

/**
 * Quality Analysis - Classify tracks by bitrate and format
 */
export interface QualityAnalysis {
  highQuality: ScannedTrack[];      // >= 320 kbps
  mediumQuality: ScannedTrack[];    // 128-320 kbps
  lowQuality: ScannedTrack[];       // < 128 kbps
  unknown: ScannedTrack[];          // No bitrate info
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

export async function analyzeQuality(): Promise<QualityAnalysis> {
  const tracks = await storage.getLibrary();
  const result = await libraryToolsWorkerPool.runTask({ task: 'analyzeQuality', tracks });
  if (result) return result as QualityAnalysis;

  return {
    highQuality: [],
    mediumQuality: [],
    lowQuality: [],
    unknown: [],
    stats: {
      totalTracks: tracks.length,
      highQualityCount: 0,
      mediumQualityCount: 0,
      lowQualityCount: 0,
      unknownCount: 0,
      averageBitrate: 0,
      formats: {},
    },
  };
}

/**
 * Duplicate Detection - Find potential duplicate tracks
 */
export interface DuplicateGroup {
  tracks: ScannedTrack[];
  reason: 'exact-match' | 'similar-duration' | 'title-artist';
  confidence: number; // 0-100
}

export async function detectDuplicates(): Promise<DuplicateGroup[]> {
  const tracks = await storage.getLibrary();
  const result = await libraryToolsWorkerPool.runTask({ task: 'detectDuplicates', tracks });
  return (result as DuplicateGroup[]) || [];
}

/**
 * Integrity Check - Verify all files exist and clean up missing ones
 */
export interface IntegrityCheckResult {
  totalTracks: number;
  missingFiles: ScannedTrack[];
  validFiles: ScannedTrack[];
  stats: {
    missing: number;
    valid: number;
    percentage: number;
  };
}

export async function checkIntegrity(): Promise<IntegrityCheckResult> {
  const tracks = await storage.getLibrary();
  const result = await libraryToolsWorkerPool.runTask({ task: 'checkIntegrity', tracks });
  if (result) return result as IntegrityCheckResult;

  return {
    totalTracks: tracks.length,
    missingFiles: [],
    validFiles: tracks,
    stats: {
      missing: 0,
      valid: tracks.length,
      percentage: tracks.length > 0 ? 100 : 0,
    },
  };
}

/**
 * Clean up missing files from library
 */
export async function cleanupMissingFiles(): Promise<{ removed: number; remaining: number }> {
  const integrity = await checkIntegrity();
  
  if (integrity.missingFiles.length === 0) {
    return { removed: 0, remaining: integrity.validFiles.length };
  }

  // Remove missing tracks from storage
  await storage.saveLibrary(integrity.validFiles);
  
  return {
    removed: integrity.missingFiles.length,
    remaining: integrity.validFiles.length,
  };
}

/**
 * Metadata Completion - Report on missing metadata
 */
export interface MetadataCompletionReport {
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

export async function analyzeMetadata(): Promise<MetadataCompletionReport> {
  const tracks = await storage.getLibrary();
  const result = await libraryToolsWorkerPool.runTask({ task: 'analyzeMetadata', tracks });
  if (result) return result as MetadataCompletionReport;

  return {
    withoutCover: [],
    withoutGenre: [],
    withoutYear: [],
    withoutArtist: [],
    complete: [],
    stats: {
      totalTracks: tracks.length,
      missingCover: 0,
      missingGenre: 0,
      missingYear: 0,
      missingArtist: 0,
      complete: 0,
      completionPercentage: 0,
    },
  };
}
