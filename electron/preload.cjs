const { contextBridge, ipcRenderer } = require('electron');

// Log that preload is loading
console.log('[Preload] Preload script is loading...');

// Expose protected methods for window controls
try {
  contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // File dialogs
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  openFile: (filters) =>
    ipcRenderer.invoke('dialog:openFile', filters),
  openVideoFile: (multiSelect) =>
    ipcRenderer.invoke('dialog:openVideoFile', multiSelect),

  // Audio library
  scanLibrary: (directories) => ipcRenderer.invoke('library:scan', directories),
  getLibrary: () => ipcRenderer.invoke('library:get'),
  onScanProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('library:scan-progress', listener);
    return () => ipcRenderer.removeListener('library:scan-progress', listener);
  },
  onTrackAdded: (callback) => {
    const listener = (_event, track) => callback(track);
    ipcRenderer.on('library:track-added', listener);
    return () => ipcRenderer.removeListener('library:track-added', listener);
  },
  onTrackRemoved: (callback) => {
    const listener = (_event, filePath) => callback(filePath);
    ipcRenderer.on('library:track-removed', listener);
    return () => ipcRenderer.removeListener('library:track-removed', listener);
  },
  onTrackUpdated: (callback) => {
    const listener = (_event, track) => callback(track);
    ipcRenderer.on('library:track-updated', listener);
    return () => ipcRenderer.removeListener('library:track-updated', listener);
  },

  // Video library
  scanVideos: (directories) => ipcRenderer.invoke('videos:scan', directories),
  getVideos: () => ipcRenderer.invoke('videos:get'),
  getVideo: (videoId) => ipcRenderer.invoke('videos:getVideo', videoId),
  updateVideoMetadata: (videoId, metadata) => ipcRenderer.invoke('videos:updateMetadata', videoId, metadata),
  addVideoFiles: (filePaths) => ipcRenderer.invoke('videos:addFiles', filePaths),
  addVideoFromUrl: (url, title) => ipcRenderer.invoke('videos:addFromUrl', url, title),
  regenerateVideoThumbnail: (videoId) => ipcRenderer.invoke('videos:regenerateThumbnail', videoId),
  regenerateAllVideoThumbnails: () => ipcRenderer.invoke('videos:regenerateAllThumbnails'),
  generateMissingVideoThumbnails: () => ipcRenderer.invoke('videos:generateMissingThumbnails'),
  onVideoScanProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('videos:scan-progress', listener);
    return () => ipcRenderer.removeListener('videos:scan-progress', listener);
  },
  onVideoAdded: (callback) => {
    const listener = (_event, video) => callback(video);
    ipcRenderer.on('videos:new', listener);
    return () => ipcRenderer.removeListener('videos:new', listener);
  },
  onVideoRemoved: (callback) => {
    const listener = (_event, filePath) => callback(filePath);
    ipcRenderer.on('videos:removed', listener);
    return () => ipcRenderer.removeListener('videos:removed', listener);
  },
  onVideoUpdated: (callback) => {
    const listener = (_event, video) => callback(video);
    ipcRenderer.on('videos:updated', listener);
    return () => ipcRenderer.removeListener('videos:updated', listener);
  },

  // Track metadata
  getTrackMetadata: (filePath) => ipcRenderer.invoke('metadata:get', filePath),
  getAlbumArt: (filePath) => ipcRenderer.invoke('metadata:artwork', filePath),

  // Playlists
  getPlaylists: () => ipcRenderer.invoke('playlists:get'),
  createPlaylist: (name, trackIds) =>
    ipcRenderer.invoke('playlists:create', name, trackIds),
  updatePlaylist: (id, data) =>
    ipcRenderer.invoke('playlists:update', id, data),
  deletePlaylist: (id) => ipcRenderer.invoke('playlists:delete', id),
  importPlaylist: (filePath) => ipcRenderer.invoke('playlists:import', filePath),
  exportPlaylist: (id, format) =>
    ipcRenderer.invoke('playlists:export', id, format),

  // Favorites
  getFavorites: () => ipcRenderer.invoke('favorites:get'),
  addFavorite: (trackId) => ipcRenderer.invoke('favorites:add', trackId),
  removeFavorite: (trackId) => ipcRenderer.invoke('favorites:remove', trackId),
  isFavorite: (trackId) => ipcRenderer.invoke('favorites:check', trackId),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) =>
    ipcRenderer.invoke('settings:update', settings),

  // History
  getHistory: () => ipcRenderer.invoke('history:get'),
  addToHistory: (trackId) => ipcRenderer.invoke('history:add', trackId),
  clearHistory: () => ipcRenderer.invoke('history:clear'),

  // Equalizer
  getEqualizerPresets: () => ipcRenderer.invoke('equalizer:presets'),
  saveEqualizerPreset: (name, bands) =>
    ipcRenderer.invoke('equalizer:save', name, bands),
  deleteEqualizerPreset: (name) => ipcRenderer.invoke('equalizer:delete', name),

  // Lyrics
  getLyrics: (artist, title, duration) =>
    ipcRenderer.invoke('lyrics:get', artist, title, duration),
  searchLyrics: (query) => ipcRenderer.invoke('lyrics:search', query),

  // Scrobbling
  scrobbleTrack: (track) =>
    ipcRenderer.invoke('scrobbler:scrobble', track),
  updateNowPlaying: (track) =>
    ipcRenderer.invoke('scrobbler:nowPlaying', track),
  getScrobblerStatus: () => ipcRenderer.invoke('scrobbler:status'),
  authenticateLastFm: () => ipcRenderer.invoke('scrobbler:authenticate', 'lastfm'),
  authenticateLibreFm: () => ipcRenderer.invoke('scrobbler:authenticate', 'librefm'),
  disconnectScrobbler: (service) =>
    ipcRenderer.invoke('scrobbler:disconnect', service),

  // File system
  fileExists: (filePath) => ipcRenderer.invoke('fs:exists', filePath),
  getAudioDuration: (filePath) => ipcRenderer.invoke('audio:duration', filePath),
  readFileAsBase64: (filePath) => ipcRenderer.invoke('file:readAsBase64', filePath),
  openPath: (filePath) => ipcRenderer.invoke('fs:openPath', filePath),
  getFileInfo: (filePath) => ipcRenderer.invoke('file:getInfo', filePath),
  uploadToCloud: (options) => ipcRenderer.invoke('file:uploadToCloud', options),
  
  // File open event (from "Open with..." or command line)
  onFileOpen: (callback) => {
    const listener = (_event, filePath) => callback(filePath);
    ipcRenderer.on('file:open', listener);
    return () => ipcRenderer.removeListener('file:open', listener);
  },
  
  // Update notifications
  onUpdateAvailable: (callback) => {
    const listener = (_event, updateInfo) => callback(updateInfo);
    ipcRenderer.on('update:available', listener);
    return () => ipcRenderer.removeListener('update:available', listener);
  },
  
  // Music recognition
  recognizeAll: () => ipcRenderer.invoke('recognize:all'),
  applyRecognition: (results) => ipcRenderer.invoke('recognize:apply', results),
  detectPatterns: () => ipcRenderer.invoke('recognize:detect-patterns'),
  applyDetectedGroup: (group) => ipcRenderer.invoke('recognize:apply-group', group),
  recognizeTrack: (trackId) => ipcRenderer.invoke('recognize:track', trackId),
  onRecognitionUpdated: (callback) => {
    const listener = (_event, updated) => callback(updated);
    ipcRenderer.on('recognize:updated', listener);
    return () => ipcRenderer.removeListener('recognize:updated', listener);
  },
  });
  
  console.log('[Preload] ✅ electronAPI successfully exposed to window');
} catch (error) {
  console.error('[Preload] ❌ Error exposing electronAPI:', error);
  // Still expose a minimal API to prevent app crashes
  contextBridge.exposeInMainWorld('electronAPI', {
    minimize: () => console.warn('[Preload] electronAPI not fully initialized'),
    maximize: () => console.warn('[Preload] electronAPI not fully initialized'),
    close: () => console.warn('[Preload] electronAPI not fully initialized'),
  });
}

console.log('[Preload] ✅ Preload script loaded successfully');

