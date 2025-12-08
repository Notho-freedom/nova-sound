const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods for window controls
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // File dialogs
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  openFile: (filters) =>
    ipcRenderer.invoke('dialog:openFile', filters),

  // Audio library
  scanLibrary: (directories) => ipcRenderer.invoke('library:scan', directories),
  getLibrary: () => ipcRenderer.invoke('library:get'),
  onScanProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('library:scan-progress', listener);
    return () => ipcRenderer.removeListener('library:scan-progress', listener);
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
});

console.log('Preload script loaded successfully');

