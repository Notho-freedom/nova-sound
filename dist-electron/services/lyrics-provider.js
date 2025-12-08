import { ipcMain } from 'electron';
import { net } from 'electron';
const LRCLIB_BASE_URL = 'https://lrclib.net/api';
/**
 * Parse LRC format lyrics into timestamped lines
 * LRC format: [mm:ss.xx]text or [mm:ss]text
 */
function parseLRC(lrcContent) {
    const lines = [];
    const lineRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)$/;
    const rawLines = lrcContent.split('\n');
    for (const line of rawLines) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        // Handle multiple timestamps on same line
        const timestamps = [];
        let text = trimmed;
        let match;
        const timestampRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
        while ((match = timestampRegex.exec(trimmed)) !== null) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const milliseconds = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
            const time = minutes * 60 + seconds + milliseconds / 1000;
            timestamps.push(time);
            text = text.replace(match[0], '');
        }
        text = text.trim();
        // Create a line entry for each timestamp
        for (const time of timestamps) {
            if (text) {
                lines.push({ time, text });
            }
        }
    }
    // Sort by time
    lines.sort((a, b) => a.time - b.time);
    return lines;
}
/**
 * Make HTTP request using Electron's net module
 */
async function fetchJSON(url) {
    return new Promise((resolve) => {
        const request = net.request(url);
        let data = '';
        request.on('response', (response) => {
            if (response.statusCode !== 200) {
                resolve(null);
                return;
            }
            response.on('data', (chunk) => {
                data += chunk.toString();
            });
            response.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                }
                catch {
                    resolve(null);
                }
            });
        });
        request.on('error', () => {
            resolve(null);
        });
        request.end();
    });
}
/**
 * Get lyrics for a track from LRCLIB
 */
async function getLyrics(artist, title, album, duration) {
    try {
        // Build query parameters
        const params = new URLSearchParams({
            artist_name: artist,
            track_name: title,
        });
        if (album) {
            params.append('album_name', album);
        }
        if (duration) {
            params.append('duration', Math.round(duration).toString());
        }
        const url = `${LRCLIB_BASE_URL}/get?${params.toString()}`;
        const response = await fetchJSON(url);
        if (!response) {
            return null;
        }
        const result = {
            id: response.id,
            trackName: response.trackName,
            artistName: response.artistName,
            albumName: response.albumName,
            duration: response.duration,
            source: 'lrclib',
        };
        // Parse synced lyrics if available
        if (response.syncedLyrics) {
            result.syncedLyrics = parseLRC(response.syncedLyrics);
        }
        // Include plain lyrics as fallback
        if (response.plainLyrics) {
            result.plainLyrics = response.plainLyrics;
        }
        return result;
    }
    catch (error) {
        console.error('Failed to fetch lyrics:', error);
        return null;
    }
}
/**
 * Search for lyrics
 */
async function searchLyrics(query) {
    try {
        const params = new URLSearchParams({ q: query });
        const url = `${LRCLIB_BASE_URL}/search?${params.toString()}`;
        const response = await fetchJSON(url);
        return response || [];
    }
    catch (error) {
        console.error('Failed to search lyrics:', error);
        return [];
    }
}
/**
 * Get lyrics by LRCLIB ID
 */
async function getLyricsById(id) {
    try {
        const url = `${LRCLIB_BASE_URL}/get/${id}`;
        const response = await fetchJSON(url);
        if (!response) {
            return null;
        }
        const result = {
            id: response.id,
            trackName: response.trackName,
            artistName: response.artistName,
            albumName: response.albumName,
            duration: response.duration,
            source: 'lrclib',
        };
        if (response.syncedLyrics) {
            result.syncedLyrics = parseLRC(response.syncedLyrics);
        }
        if (response.plainLyrics) {
            result.plainLyrics = response.plainLyrics;
        }
        return result;
    }
    catch (error) {
        console.error('Failed to fetch lyrics by ID:', error);
        return null;
    }
}
/**
 * Find current lyrics line based on playback time
 */
export function findCurrentLyricsLine(lyrics, currentTime, offset = 0) {
    const adjustedTime = currentTime + offset;
    let currentIndex = -1;
    for (let i = 0; i < lyrics.length; i++) {
        if (lyrics[i].time <= adjustedTime) {
            currentIndex = i;
        }
        else {
            break;
        }
    }
    return {
        currentIndex,
        currentLine: currentIndex >= 0 ? lyrics[currentIndex] : null,
        nextLine: currentIndex < lyrics.length - 1 ? lyrics[currentIndex + 1] : null,
    };
}
/**
 * Initialize IPC handlers for lyrics
 */
export function initLyricsProvider() {
    ipcMain.handle('lyrics:get', async (_event, artist, title, duration) => {
        return getLyrics(artist, title, undefined, duration);
    });
    ipcMain.handle('lyrics:getWithAlbum', async (_event, artist, title, album, duration) => {
        return getLyrics(artist, title, album, duration);
    });
    ipcMain.handle('lyrics:search', async (_event, query) => {
        return searchLyrics(query);
    });
    ipcMain.handle('lyrics:getById', async (_event, id) => {
        return getLyricsById(id);
    });
}
//# sourceMappingURL=lyrics-provider.js.map