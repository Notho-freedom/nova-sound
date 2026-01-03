import * as fs from 'fs/promises';
import * as path from 'path';
import type { ScannedTrack } from './audio-scanner.js';
import { storage } from './storage.js';

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
  
  const highQuality: ScannedTrack[] = [];
  const mediumQuality: ScannedTrack[] = [];
  const lowQuality: ScannedTrack[] = [];
  const unknown: ScannedTrack[] = [];
  const formats: Record<string, number> = {};
  
  let totalBitrate = 0;
  let bitrateCount = 0;

  for (const track of tracks) {
    const bitrate = track.bitrate || 0;
    const format = track.format?.toUpperCase() || 'UNKNOWN';
    
    // Count format
    formats[format] = (formats[format] || 0) + 1;
    
    // Classify by quality
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
  const groups: Map<string, ScannedTrack[]> = new Map();
  const processed = new Set<string>();
  const duplicateGroups: DuplicateGroup[] = [];

  // Phase 1: Find exact matches (title + artist)
  for (const track of tracks) {
    const key = `${track.title}:${track.artist}`.toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(track);
  }

  // Phase 2: Find groups with duplicates
  for (const [key, group] of groups.entries()) {
    if (group.length > 1) {
      const [title, artist] = key.split(':');
      const allProcessed = group.every(t => processed.has(t.id));
      
      if (!allProcessed) {
        duplicateGroups.push({
          tracks: group,
          reason: 'exact-match',
          confidence: 100,
        });
        group.forEach(t => processed.add(t.id));
      }
    }
  }

  // Phase 3: Find similar duration matches (within ±3 seconds)
  const durationGroups: Map<number, ScannedTrack[]> = new Map();
  for (const track of tracks) {
    if (processed.has(track.id)) continue;
    
    // Round to nearest 5 seconds for grouping
    const bucket = Math.round(track.duration / 5) * 5;
    if (!durationGroups.has(bucket)) {
      durationGroups.set(bucket, []);
    }
    durationGroups.get(bucket)!.push(track);
  }

  for (const [, group] of durationGroups.entries()) {
    if (group.length > 1) {
      // Check for similar titles/artists
      const similarTracks: ScannedTrack[] = [];
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const t1 = group[i];
          const t2 = group[j];
          
          // Check if title or artist are similar
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
          reason: 'similar-duration',
          confidence: 70,
        });
        similarTracks.forEach(t => processed.add(t.id));
      }
    }
  }

  return duplicateGroups;
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
  
  const withoutCover = tracks.filter(t => !t.coverUrl);
  const withoutGenre = tracks.filter(t => !t.genre);
  const withoutYear = tracks.filter(t => !t.year);
  const withoutArtist = tracks.filter(t => !t.artist || t.artist === 'Artiste inconnu');
  
  // Calculate complete tracks (has all metadata)
  const complete = tracks.filter(t => 
    t.coverUrl && t.genre && t.year && t.artist && t.artist !== 'Artiste inconnu'
  );
  
  // Calculate completion percentage
  const totalMetadataFields = tracks.length * 4; // cover, genre, year, artist
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
}

/**
 * Helper: Calculate Levenshtein distance between two strings
 */
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
