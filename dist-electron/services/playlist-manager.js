import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { storage } from './storage.js';
/**
 * Parse M3U/M3U8 playlist file
 */
async function parseM3U(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    const trackPaths = [];
    const baseDir = path.dirname(filePath);
    for (const line of lines) {
        const trimmed = line.trim();
        // Skip empty lines, comments, and extended info
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }
        // Handle relative and absolute paths
        let trackPath = trimmed;
        if (!path.isAbsolute(trackPath)) {
            trackPath = path.resolve(baseDir, trackPath);
        }
        trackPaths.push(trackPath);
    }
    return trackPaths;
}
/**
 * Parse PLS playlist file
 */
async function parsePLS(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    const trackPaths = [];
    const baseDir = path.dirname(filePath);
    for (const line of lines) {
        const trimmed = line.trim();
        const match = trimmed.match(/^File\d+=(.+)$/i);
        if (match) {
            let trackPath = match[1];
            if (!path.isAbsolute(trackPath)) {
                trackPath = path.resolve(baseDir, trackPath);
            }
            trackPaths.push(trackPath);
        }
    }
    return trackPaths;
}
/**
 * Generate M3U content from track paths
 */
function generateM3U(tracks) {
    const lines = ['#EXTM3U'];
    for (const track of tracks) {
        lines.push(`#EXTINF:${track.duration},${track.artist} - ${track.title}`);
        lines.push(track.filePath);
    }
    return lines.join('\n');
}
/**
 * Generate PLS content from track paths
 */
function generatePLS(tracks) {
    const lines = ['[playlist]'];
    tracks.forEach((track, index) => {
        const num = index + 1;
        lines.push(`File${num}=${track.filePath}`);
        lines.push(`Title${num}=${track.artist} - ${track.title}`);
        lines.push(`Length${num}=${track.duration}`);
    });
    lines.push(`NumberOfEntries=${tracks.length}`);
    lines.push('Version=2');
    return lines.join('\n');
}
/**
 * Import playlist from file
 */
async function importPlaylist(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    let trackPaths = [];
    try {
        if (ext === '.m3u' || ext === '.m3u8') {
            trackPaths = await parseM3U(filePath);
        }
        else if (ext === '.pls') {
            trackPaths = await parsePLS(filePath);
        }
        else {
            throw new Error(`Format de playlist non supporté: ${ext}`);
        }
        // Get library to match file paths to track IDs
        const library = await storage.getLibrary();
        const trackIds = [];
        for (const trackPath of trackPaths) {
            const normalizedPath = path.normalize(trackPath);
            const track = library.find(t => path.normalize(t.filePath) === normalizedPath);
            if (track) {
                trackIds.push(track.id);
            }
        }
        // Create playlist with name from filename
        const playlistName = path.basename(filePath, ext);
        const playlist = await storage.createPlaylist(playlistName, trackIds);
        return playlist;
    }
    catch (error) {
        console.error(`Failed to import playlist ${filePath}:`, error);
        return null;
    }
}
/**
 * Export playlist to file
 */
async function exportPlaylist(playlistId, format) {
    try {
        const playlist = await storage.getPlaylist(playlistId);
        if (!playlist) {
            throw new Error('Playlist non trouvée');
        }
        const library = await storage.getLibrary();
        const tracks = playlist.trackIds
            .map(id => library.find(t => t.id === id))
            .filter((t) => !!t)
            .map(t => ({
            filePath: t.filePath,
            title: t.title,
            artist: t.artist,
            duration: t.duration,
        }));
        let content;
        let extension;
        if (format === 'm3u') {
            content = generateM3U(tracks);
            extension = '.m3u';
        }
        else {
            content = generatePLS(tracks);
            extension = '.pls';
        }
        // Show save dialog
        const mainWindow = BrowserWindow.getFocusedWindow();
        const result = await dialog.showSaveDialog(mainWindow, {
            title: 'Exporter la playlist',
            defaultPath: `${playlist.name}${extension}`,
            filters: [
                format === 'm3u'
                    ? { name: 'M3U Playlist', extensions: ['m3u', 'm3u8'] }
                    : { name: 'PLS Playlist', extensions: ['pls'] },
            ],
        });
        if (result.canceled || !result.filePath) {
            return null;
        }
        await fs.writeFile(result.filePath, content, 'utf-8');
        return result.filePath;
    }
    catch (error) {
        console.error(`Failed to export playlist:`, error);
        return null;
    }
}
/**
 * Create a smart playlist based on criteria
 */
async function createSmartPlaylist(name, criteria) {
    const library = await storage.getLibrary();
    let filteredTracks = [...library];
    switch (criteria.type) {
        case 'artist':
            filteredTracks = library.filter(t => t.artist.toLowerCase().includes((criteria.value || '').toLowerCase()));
            break;
        case 'album':
            filteredTracks = library.filter(t => t.album.toLowerCase().includes((criteria.value || '').toLowerCase()));
            break;
        case 'genre':
            filteredTracks = library.filter(t => t.genre?.toLowerCase().includes((criteria.value || '').toLowerCase()));
            break;
        case 'year':
            const year = parseInt(criteria.value || '', 10);
            if (!isNaN(year)) {
                filteredTracks = library.filter(t => t.year === year);
            }
            break;
        case 'recent':
            filteredTracks = [...library].sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
            break;
        case 'mostPlayed':
            // This would require play count tracking
            filteredTracks = library;
            break;
    }
    // Apply limit
    if (criteria.limit) {
        filteredTracks = filteredTracks.slice(0, criteria.limit);
    }
    const trackIds = filteredTracks.map(t => t.id);
    return storage.createPlaylist(name, trackIds);
}
/**
 * Initialize IPC handlers for playlist management
 */
export function initPlaylistManager() {
    ipcMain.handle('playlists:import', async (_event, filePath) => {
        return importPlaylist(filePath);
    });
    ipcMain.handle('playlists:export', async (_event, playlistId, format) => {
        return exportPlaylist(playlistId, format);
    });
    ipcMain.handle('playlists:createSmart', async (_event, name, criteria) => {
        return createSmartPlaylist(name, criteria);
    });
    ipcMain.handle('playlists:addTracks', async (_event, playlistId, trackIds) => {
        const playlist = await storage.getPlaylist(playlistId);
        if (!playlist)
            return null;
        const updatedTrackIds = [...new Set([...playlist.trackIds, ...trackIds])];
        return storage.updatePlaylist(playlistId, { trackIds: updatedTrackIds });
    });
    ipcMain.handle('playlists:removeTracks', async (_event, playlistId, trackIds) => {
        const playlist = await storage.getPlaylist(playlistId);
        if (!playlist)
            return null;
        const updatedTrackIds = playlist.trackIds.filter(id => !trackIds.includes(id));
        return storage.updatePlaylist(playlistId, { trackIds: updatedTrackIds });
    });
    ipcMain.handle('playlists:reorder', async (_event, playlistId, fromIndex, toIndex) => {
        const playlist = await storage.getPlaylist(playlistId);
        if (!playlist)
            return null;
        const trackIds = [...playlist.trackIds];
        const [removed] = trackIds.splice(fromIndex, 1);
        trackIds.splice(toIndex, 0, removed);
        return storage.updatePlaylist(playlistId, { trackIds });
    });
    ipcMain.handle('playlists:duplicate', async (_event, playlistId) => {
        const playlist = await storage.getPlaylist(playlistId);
        if (!playlist)
            return null;
        return storage.createPlaylist(`${playlist.name} (copie)`, [...playlist.trackIds]);
    });
}
//# sourceMappingURL=playlist-manager.js.map