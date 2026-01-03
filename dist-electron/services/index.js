// Export all services for easy importing
export { initAudioScanner, scanLibrary, startWatching, stopWatching } from './audio-scanner.js';
export { initMetadataExtractor, extractMetadata, extractArtwork, getAudioDuration } from './metadata-extractor.js';
export { initStorage, storage } from './storage.js';
export { initPlaylistManager } from './playlist-manager.js';
export { initEqualizer, EQUALIZER_FREQUENCIES, DEFAULT_PRESETS, interpolateEQCurve } from './equalizer.js';
export { initLyricsProvider, findCurrentLyricsLine } from './lyrics-provider.js';
export { initScrobbler, shouldScrobble } from './scrobbler.js';
export { analyzeQuality, detectDuplicates, checkIntegrity, cleanupMissingFiles, analyzeMetadata } from './library-tools.js';
//# sourceMappingURL=index.js.map