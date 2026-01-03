// Export all services for easy importing
export { initAudioScanner, scanLibrary, startWatching, stopWatching } from './audio-scanner.js';
export { initMetadataExtractor, extractMetadata, extractArtwork, getAudioDuration } from './metadata-extractor.js';
export { initStorage, storage } from './storage.js';
export { initPlaylistManager } from './playlist-manager.js';
export { initEqualizer, EQUALIZER_FREQUENCIES, DEFAULT_PRESETS, interpolateEQCurve } from './equalizer.js';
export { initLyricsProvider, findCurrentLyricsLine } from './lyrics-provider.js';
export { initScrobbler, shouldScrobble } from './scrobbler.js';
export { analyzeQuality, detectDuplicates, checkIntegrity, cleanupMissingFiles, analyzeMetadata } from './library-tools.js';

// Type exports
export type { ScannedTrack } from './audio-scanner.js';
export type { ExtractedMetadata, ArtworkData } from './metadata-extractor.js';
export type { StoredTrack, Playlist, HistoryEntry, EqualizerPreset, Settings } from './storage.js';
export type { EqualizerState } from './equalizer.js';
export type { LyricsLine, LyricsResult, LyricsSearchResult } from './lyrics-provider.js';
export type { QualityAnalysis, DuplicateGroup, IntegrityCheckResult, MetadataCompletionReport } from './library-tools.js';

