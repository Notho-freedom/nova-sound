import { ipcMain, app } from 'electron';
import { net } from 'electron';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
const LRCLIB_BASE_URL = 'https://lrclib.net/api';
// Lyrics cache configuration
const CACHE_DIR = path.join(app.getPath('userData'), 'lyrics-cache');
const CACHE_MAX_AGE_DAYS = 30; // Cache lyrics for 30 days
/**
 * Generate a cache key for a track
 */
function generateCacheKey(artist, title) {
    const normalized = `${artist.toLowerCase().trim()}-${title.toLowerCase().trim()}`;
    return crypto.createHash('md5').update(normalized).digest('hex');
}
/**
 * Ensure cache directory exists
 */
async function ensureCacheDir() {
    try {
        await fs.mkdir(CACHE_DIR, { recursive: true });
    }
    catch (error) {
        // Directory may already exist
    }
}
/**
 * Get cached lyrics
 */
async function getCachedLyrics(artist, title) {
    try {
        const cacheKey = generateCacheKey(artist, title);
        const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
        const stat = await fs.stat(cachePath);
        const ageInDays = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24);
        // Check if cache is still valid
        if (ageInDays > CACHE_MAX_AGE_DAYS) {
            await fs.unlink(cachePath).catch(() => { }); // Delete expired cache
            return null;
        }
        const data = await fs.readFile(cachePath, 'utf-8');
        const cached = JSON.parse(data);
        cached.source = 'cache';
        return cached;
    }
    catch (error) {
        // Cache miss or error reading cache
        return null;
    }
}
/**
 * Save lyrics to cache
 */
async function cacheLyrics(artist, title, lyrics) {
    try {
        await ensureCacheDir();
        const cacheKey = generateCacheKey(artist, title);
        const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
        await fs.writeFile(cachePath, JSON.stringify(lyrics), 'utf-8');
    }
    catch (error) {
        console.error('Failed to cache lyrics:', error);
    }
}
/**
 * Clear expired cache entries
 */
async function cleanupCache() {
    let deleted = 0;
    let remaining = 0;
    try {
        await ensureCacheDir();
        const files = await fs.readdir(CACHE_DIR);
        for (const file of files) {
            if (!file.endsWith('.json'))
                continue;
            const filePath = path.join(CACHE_DIR, file);
            try {
                const stat = await fs.stat(filePath);
                const ageInDays = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24);
                if (ageInDays > CACHE_MAX_AGE_DAYS) {
                    await fs.unlink(filePath);
                    deleted++;
                }
                else {
                    remaining++;
                }
            }
            catch (error) {
                // Skip files that can't be accessed
            }
        }
    }
    catch (error) {
        console.error('Failed to cleanup lyrics cache:', error);
    }
    return { deleted, remaining };
}
/**
 * Get cache statistics
 */
async function getCacheStats() {
    let count = 0;
    let size = 0;
    try {
        await ensureCacheDir();
        const files = await fs.readdir(CACHE_DIR);
        for (const file of files) {
            if (!file.endsWith('.json'))
                continue;
            const filePath = path.join(CACHE_DIR, file);
            try {
                const stat = await fs.stat(filePath);
                count++;
                size += stat.size;
            }
            catch (error) {
                // Skip files that can't be accessed
            }
        }
    }
    catch (error) {
        console.error('Failed to get cache stats:', error);
    }
    return { count, size };
}
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
 * Get lyrics for a track from LRCLIB with caching
 */
async function getLyrics(artist, title, album, duration) {
    try {
        // Check cache first
        const cached = await getCachedLyrics(artist, title);
        if (cached) {
            console.log(`Lyrics cache hit for "${artist} - ${title}"`);
            return cached;
        }
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
        // Cache the result
        await cacheLyrics(artist, title, result);
        console.log(`Lyrics cached for "${artist} - ${title}"`);
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
    // Ensure cache directory exists on startup
    ensureCacheDir();
    // Cleanup expired cache on startup
    cleanupCache().then(({ deleted, remaining }) => {
        if (deleted > 0) {
            console.log(`Lyrics cache: cleaned ${deleted} expired entries, ${remaining} remaining`);
        }
    });
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
    ipcMain.handle('lyrics:getCacheStats', async () => {
        return getCacheStats();
    });
    ipcMain.handle('lyrics:clearCache', async () => {
        return cleanupCache();
    });
}
//# sourceMappingURL=lyrics-provider.js.map