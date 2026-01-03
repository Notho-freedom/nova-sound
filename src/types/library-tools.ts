import type { Track } from './music';

/**
 * Quality Analysis - Classify tracks by bitrate and format
 */
export interface QualityAnalysis {
  highQuality: Track[];
  mediumQuality: Track[];
  lowQuality: Track[];
  unknown: Track[];
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

/**
 * Duplicate Detection - Find potential duplicate tracks
 */
export interface DuplicateGroup {
  tracks: Track[];
  reason: 'exact-match' | 'similar-duration' | 'title-artist';
  confidence: number; // 0-100
}

/**
 * Integrity Check - Verify all files exist
 */
export interface IntegrityCheckResult {
  totalTracks: number;
  missingFiles: Track[];
  validFiles: Track[];
  stats: {
    missing: number;
    valid: number;
    percentage: number;
  };
}

/**
 * Metadata Completion - Report on missing metadata
 */
export interface MetadataCompletionReport {
  withoutCover: Track[];
  withoutGenre: Track[];
  withoutYear: Track[];
  withoutArtist: Track[];
  complete: Track[];
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
