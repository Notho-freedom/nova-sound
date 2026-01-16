import { ipcMain, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
// Storage paths
const DATA_DIR = path.join(app.getPath('userData'), 'nexus-data');
const ARTWORK_DIR = path.join(DATA_DIR, 'artwork');
const THUMBNAILS_DIR = path.join(DATA_DIR, 'thumbnails');
const THUMBNAIL_CACHE_TTL_MS = 30000;
const THUMBNAIL_CACHE_MAX = 2000;
const PATHS = {
    library: path.join(DATA_DIR, 'library.json'),
    videos: path.join(DATA_DIR, 'videos.json'),
    playlists: path.join(DATA_DIR, 'playlists.json'),
    favorites: path.join(DATA_DIR, 'favorites.json'),
    history: path.join(DATA_DIR, 'history.json'),
    settings: path.join(DATA_DIR, 'settings.json'),
    equalizer: path.join(DATA_DIR, 'equalizer.json'),
    scrobbleQueue: path.join(DATA_DIR, 'scrobble-queue.json'),
};
// Default values
const DEFAULT_SETTINGS = {
    musicDirectories: [],
    equalizerEnabled: false,
    equalizerPreset: 'Flat',
    customEqualizer: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    scrobblingEnabled: false,
    lastFmConnected: false,
    libreFmConnected: false,
    theme: 'dark',
    language: 'fr',
    audioQuality: 'high',
    crossfadeEnabled: false,
    crossfadeDuration: 3,
    gaplessPlayback: true,
    normalizeVolume: false,
    showLyrics: true,
    miniPlayerEnabled: false,
    notificationsEnabled: true,
    autoScanOnStartup: true,
};
const DEFAULT_EQUALIZER_PRESETS = [
    { name: 'Flat', bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], preamp: 0, isCustom: false },
    { name: 'Rock', bands: [5, 4, 3, 1, -1, -1, 0, 2, 3, 4], preamp: 0, isCustom: false },
    { name: 'Pop', bands: [-2, -1, 0, 2, 4, 4, 2, 0, -1, -2], preamp: 0, isCustom: false },
    { name: 'Jazz', bands: [4, 3, 1, 2, -2, -2, 0, 1, 3, 4], preamp: 0, isCustom: false },
    { name: 'Classical', bands: [5, 4, 3, 2, -1, -1, 0, 2, 3, 4], preamp: 0, isCustom: false },
    { name: 'Bass Boost', bands: [6, 5, 4, 3, 1, 0, 0, 0, 0, 0], preamp: 0, isCustom: false },
    { name: 'Treble Boost', bands: [0, 0, 0, 0, 0, 1, 3, 4, 5, 6], preamp: 0, isCustom: false },
    { name: 'Electronic', bands: [5, 4, 1, 0, -2, 2, 1, 1, 4, 5], preamp: 0, isCustom: false },
    { name: 'Vocal', bands: [-2, -3, -3, 1, 4, 4, 3, 1, 0, -2], preamp: 0, isCustom: false },
    { name: 'Hip-Hop', bands: [5, 4, 1, 3, -1, -1, 1, -1, 2, 3], preamp: 0, isCustom: false },
];
// Helper functions
async function ensureDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    }
    catch (error) {
        // Directory might already exist
    }
}
async function readJSON(filePath, defaultValue) {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    }
    catch {
        return defaultValue;
    }
}
async function writeJSON(filePath, data) {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
// Storage class
class Storage {
    initialized = false;
    thumbnailCache = new Map();
    pruneThumbnailCache() {
        const now = Date.now();
        for (const [key, value] of this.thumbnailCache.entries()) {
            if (now - value.checkedAt > THUMBNAIL_CACHE_TTL_MS) {
                this.thumbnailCache.delete(key);
            }
        }
        while (this.thumbnailCache.size > THUMBNAIL_CACHE_MAX) {
            const firstKey = this.thumbnailCache.keys().next().value;
            if (!firstKey)
                break;
            this.thumbnailCache.delete(firstKey);
        }
    }
    async init() {
        if (this.initialized)
            return;
        await ensureDir(DATA_DIR);
        await ensureDir(ARTWORK_DIR);
        await ensureDir(THUMBNAILS_DIR);
        // Initialize files with defaults if they don't exist
        const settings = await this.getSettings();
        if (!settings.musicDirectories) {
            await this.updateSettings(DEFAULT_SETTINGS);
        }
        const presets = await this.getEqualizerPresets();
        if (presets.length === 0) {
            await writeJSON(PATHS.equalizer, DEFAULT_EQUALIZER_PRESETS);
        }
        this.initialized = true;
    }
    // Utility function to remove duplicate tracks by ID
    removeDuplicateTracks(tracks) {
        const seen = new Map();
        for (const track of tracks) {
            // Keep the first occurrence, or the one with the most recent addedAt
            if (!seen.has(track.id)) {
                seen.set(track.id, track);
            }
            else {
                const existing = seen.get(track.id);
                const existingDate = existing.addedAt ? new Date(existing.addedAt).getTime() : 0;
                const trackDate = track.addedAt ? new Date(track.addedAt).getTime() : 0;
                // Keep the most recent one
                if (trackDate > existingDate) {
                    seen.set(track.id, track);
                }
            }
        }
        return Array.from(seen.values());
    }
    // Library
    async getLibrary() {
        const tracks = await readJSON(PATHS.library, []);
        return this.removeDuplicateTracks(tracks);
    }
    async saveLibrary(tracks) {
        const uniqueTracks = this.removeDuplicateTracks(tracks);
        await writeJSON(PATHS.library, uniqueTracks);
    }
    async getTrack(trackId) {
        const library = await this.getLibrary();
        return library.find(t => t.id === trackId) || null;
    }
    async addTrack(track) {
        const library = await this.getLibrary();
        // Check by filePath first, then by ID to avoid duplicates
        const existingByPath = library.findIndex(t => t.filePath === track.filePath);
        const existingById = library.findIndex(t => t.id === track.id);
        if (existingByPath >= 0) {
            // Update existing track by filePath
            library[existingByPath] = { ...library[existingByPath], ...track };
        }
        else if (existingById >= 0) {
            // Update existing track by ID (duplicate with different path)
            library[existingById] = { ...library[existingById], ...track };
        }
        else {
            library.push(track);
        }
        // saveLibrary will remove any remaining duplicates
        await this.saveLibrary(library);
    }
    async removeTrackByPath(filePath) {
        const library = await this.getLibrary();
        const filtered = library.filter(t => t.filePath !== filePath);
        await this.saveLibrary(filtered);
    }
    async updateTrackByPath(filePath, track) {
        const library = await this.getLibrary();
        const index = library.findIndex(t => t.filePath === filePath);
        if (index >= 0) {
            library[index] = { ...library[index], ...track };
            await this.saveLibrary(library);
        }
    }
    async updateTrack(trackId, track) {
        const library = await this.getLibrary();
        const index = library.findIndex(t => t.id === trackId);
        if (index >= 0) {
            library[index] = { ...library[index], ...track };
            await this.saveLibrary(library);
        }
    }
    // Videos
    async getVideos() {
        return readJSON(PATHS.videos, []);
    }
    async saveVideos(videos) {
        await writeJSON(PATHS.videos, videos);
    }
    async addVideos(videos) {
        const existing = await this.getVideos();
        const existingPaths = new Set(existing.map(v => v.filePath));
        for (const video of videos) {
            if (!existingPaths.has(video.filePath)) {
                existing.push(video);
            }
        }
        await this.saveVideos(existing);
    }
    async getVideo(videoId) {
        const videos = await this.getVideos();
        return videos.find(v => v.id === videoId) || null;
    }
    async removeVideoByPath(filePath) {
        const videos = await this.getVideos();
        const filtered = videos.filter(v => v.filePath !== filePath);
        await this.saveVideos(filtered);
    }
    async updateVideoByPath(filePath, video) {
        const videos = await this.getVideos();
        const index = videos.findIndex(v => v.filePath === filePath);
        if (index >= 0) {
            videos[index] = { ...videos[index], ...video };
            await this.saveVideos(videos);
        }
    }
    async updateVideo(videoId, updates) {
        const videos = await this.getVideos();
        const index = videos.findIndex(v => v.id === videoId);
        if (index >= 0) {
            videos[index] = { ...videos[index], ...updates };
            await this.saveVideos(videos);
        }
    }
    // Artwork
    async saveArtwork(artwork, sourceFilePath) {
        await ensureDir(ARTWORK_DIR);
        // Generate unique filename based on source file hash
        const hash = crypto.createHash('md5').update(sourceFilePath).digest('hex');
        const ext = artwork.format.includes('png') ? 'png' : 'jpg';
        const filename = `${hash}.${ext}`;
        const artworkPath = path.join(ARTWORK_DIR, filename);
        await fs.writeFile(artworkPath, artwork.data);
        // Return file:// URL for Electron
        return `file://${artworkPath.replace(/\\/g, '/')}`;
    }
    // Video Thumbnails
    async saveThumbnail(thumbnailData, sourceFilePath) {
        await ensureDir(THUMBNAILS_DIR);
        // Generate unique filename based on source file hash
        const hash = crypto.createHash('md5').update(sourceFilePath).digest('hex');
        const filename = `${hash}.jpg`;
        const thumbnailPath = path.join(THUMBNAILS_DIR, filename);
        await fs.writeFile(thumbnailPath, thumbnailData);
        // Return local-image:// URL for custom protocol (works better with CSP)
        const url = `local-image://${encodeURIComponent(thumbnailPath)}`;
        this.thumbnailCache.set(sourceFilePath, { url, checkedAt: Date.now() });
        this.pruneThumbnailCache();
        return url;
    }
    async getThumbnailPath(sourceFilePath) {
        const cached = this.thumbnailCache.get(sourceFilePath);
        if (cached && Date.now() - cached.checkedAt < THUMBNAIL_CACHE_TTL_MS) {
            return cached.url;
        }
        const hash = crypto.createHash('md5').update(sourceFilePath).digest('hex');
        const filename = `${hash}.jpg`;
        const thumbnailPath = path.join(THUMBNAILS_DIR, filename);
        try {
            await fs.access(thumbnailPath);
            // Return local-image:// URL for custom protocol (works better with CSP)
            const url = `local-image://${encodeURIComponent(thumbnailPath)}`;
            this.thumbnailCache.set(sourceFilePath, { url, checkedAt: Date.now() });
            this.pruneThumbnailCache();
            return url;
        }
        catch {
            this.thumbnailCache.set(sourceFilePath, { url: null, checkedAt: Date.now() });
            this.pruneThumbnailCache();
            return null;
        }
    }
    // Playlists
    async getPlaylists() {
        return readJSON(PATHS.playlists, []);
    }
    async savePlaylists(playlists) {
        await writeJSON(PATHS.playlists, playlists);
    }
    async createPlaylist(name, trackIds = []) {
        const playlists = await this.getPlaylists();
        const now = new Date().toISOString();
        const playlist = {
            id: crypto.randomUUID(),
            name,
            trackIds,
            createdAt: now,
            updatedAt: now,
        };
        playlists.push(playlist);
        await this.savePlaylists(playlists);
        return playlist;
    }
    async updatePlaylist(id, data) {
        const playlists = await this.getPlaylists();
        const index = playlists.findIndex(p => p.id === id);
        if (index < 0)
            return null;
        playlists[index] = {
            ...playlists[index],
            ...data,
            updatedAt: new Date().toISOString(),
        };
        await this.savePlaylists(playlists);
        return playlists[index];
    }
    async deletePlaylist(id) {
        const playlists = await this.getPlaylists();
        const filtered = playlists.filter(p => p.id !== id);
        await this.savePlaylists(filtered);
    }
    async getPlaylist(id) {
        const playlists = await this.getPlaylists();
        return playlists.find(p => p.id === id) || null;
    }
    // Favorites
    async getFavorites() {
        return readJSON(PATHS.favorites, []);
    }
    async saveFavorites(favorites) {
        await writeJSON(PATHS.favorites, favorites);
    }
    async addFavorite(trackId) {
        const favorites = await this.getFavorites();
        if (!favorites.includes(trackId)) {
            favorites.push(trackId);
            await this.saveFavorites(favorites);
        }
    }
    async removeFavorite(trackId) {
        const favorites = await this.getFavorites();
        const filtered = favorites.filter(id => id !== trackId);
        await this.saveFavorites(filtered);
    }
    async isFavorite(trackId) {
        const favorites = await this.getFavorites();
        return favorites.includes(trackId);
    }
    // History
    async getHistory() {
        return readJSON(PATHS.history, []);
    }
    async addToHistory(entry) {
        const history = await this.getHistory();
        history.unshift(entry);
        // Keep only last 1000 entries
        const trimmed = history.slice(0, 1000);
        await writeJSON(PATHS.history, trimmed);
    }
    async clearHistory() {
        await writeJSON(PATHS.history, []);
    }
    // Settings
    async getSettings() {
        return readJSON(PATHS.settings, DEFAULT_SETTINGS);
    }
    async updateSettings(updates) {
        const settings = await this.getSettings();
        const updated = { ...settings, ...updates };
        await writeJSON(PATHS.settings, updated);
        return updated;
    }
    async resetSettings() {
        await writeJSON(PATHS.settings, DEFAULT_SETTINGS);
        return DEFAULT_SETTINGS;
    }
    // Equalizer
    async getEqualizerPresets() {
        return readJSON(PATHS.equalizer, DEFAULT_EQUALIZER_PRESETS);
    }
    async saveEqualizerPreset(name, bands, preamp = 0) {
        const presets = await this.getEqualizerPresets();
        const existingIndex = presets.findIndex(p => p.name === name && p.isCustom);
        const preset = { name, bands, preamp, isCustom: true };
        if (existingIndex >= 0) {
            presets[existingIndex] = preset;
        }
        else {
            presets.push(preset);
        }
        await writeJSON(PATHS.equalizer, presets);
    }
    async deleteEqualizerPreset(name) {
        const presets = await this.getEqualizerPresets();
        const filtered = presets.filter(p => !(p.name === name && p.isCustom));
        await writeJSON(PATHS.equalizer, filtered);
    }
    // Scrobble Queue (for offline scrobbling)
    async getScrobbleQueue() {
        return readJSON(PATHS.scrobbleQueue, []);
    }
    async addToScrobbleQueue(scrobble) {
        const queue = await this.getScrobbleQueue();
        queue.push(scrobble);
        await writeJSON(PATHS.scrobbleQueue, queue);
    }
    async clearScrobbleQueue() {
        await writeJSON(PATHS.scrobbleQueue, []);
    }
    async removeFromScrobbleQueue(index) {
        const queue = await this.getScrobbleQueue();
        queue.splice(index, 1);
        await writeJSON(PATHS.scrobbleQueue, queue);
    }
}
// Singleton instance
export const storage = new Storage();
// Initialize IPC handlers
export function initStorage() {
    // Initialize storage on app ready
    storage.init();
    // Settings
    ipcMain.handle('settings:get', async () => {
        return storage.getSettings();
    });
    ipcMain.handle('settings:update', async (_event, settings) => {
        return storage.updateSettings(settings);
    });
    // Playlists
    ipcMain.handle('playlists:get', async () => {
        return storage.getPlaylists();
    });
    ipcMain.handle('playlists:create', async (_event, name, trackIds) => {
        return storage.createPlaylist(name, trackIds);
    });
    ipcMain.handle('playlists:update', async (_event, id, data) => {
        return storage.updatePlaylist(id, data);
    });
    ipcMain.handle('playlists:delete', async (_event, id) => {
        return storage.deletePlaylist(id);
    });
    // Favorites
    ipcMain.handle('favorites:get', async () => {
        return storage.getFavorites();
    });
    ipcMain.handle('favorites:add', async (_event, trackId) => {
        return storage.addFavorite(trackId);
    });
    ipcMain.handle('favorites:remove', async (_event, trackId) => {
        return storage.removeFavorite(trackId);
    });
    ipcMain.handle('favorites:check', async (_event, trackId) => {
        return storage.isFavorite(trackId);
    });
    // History
    ipcMain.handle('history:get', async () => {
        return storage.getHistory();
    });
    ipcMain.handle('history:add', async (_event, trackId) => {
        return storage.addToHistory({
            trackId,
            playedAt: new Date().toISOString(),
            duration: 0,
            completedPercentage: 0,
        });
    });
    ipcMain.handle('history:clear', async () => {
        return storage.clearHistory();
    });
    // Equalizer
    ipcMain.handle('equalizer:presets', async () => {
        return storage.getEqualizerPresets();
    });
    ipcMain.handle('equalizer:save', async (_event, name, bands) => {
        return storage.saveEqualizerPreset(name, bands);
    });
    ipcMain.handle('equalizer:delete', async (_event, name) => {
        return storage.deleteEqualizerPreset(name);
    });
}
//# sourceMappingURL=storage.js.map