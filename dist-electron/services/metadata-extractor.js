import { ipcMain } from 'electron';
import * as musicMetadata from 'music-metadata';
import * as path from 'path';
/**
 * Extract metadata from an audio file
 */
export async function extractMetadata(filePath) {
    try {
        const metadata = await musicMetadata.parseFile(filePath, { duration: true });
        const { common, format } = metadata;
        // Extract artwork
        let artwork;
        if (common.picture && common.picture.length > 0) {
            const pic = common.picture[0];
            artwork = {
                data: Buffer.from(pic.data),
                format: pic.format,
                type: pic.type,
                description: pic.description,
            };
        }
        // Get file extension as format fallback
        const ext = path.extname(filePath).slice(1).toUpperCase();
        return {
            title: common.title,
            artist: common.artist || common.artists?.join(', '),
            album: common.album,
            year: common.year,
            genre: common.genre?.join(', '),
            duration: Math.round(format.duration || 0),
            bitrate: format.bitrate ? Math.round(format.bitrate / 1000) : undefined,
            sampleRate: format.sampleRate,
            channels: format.numberOfChannels,
            format: format.container || format.codec || ext,
            trackNumber: common.track?.no || undefined,
            discNumber: common.disk?.no || undefined,
            albumArtist: common.albumartist,
            composer: common.composer?.join(', '),
            comment: common.comment?.join(', '),
            lyrics: common.lyrics?.join('\n'),
            artwork,
        };
    }
    catch (error) {
        console.error(`Failed to extract metadata from ${filePath}:`, error);
        return null;
    }
}
/**
 * Extract only the album artwork from a file
 */
export async function extractArtwork(filePath) {
    try {
        const metadata = await musicMetadata.parseFile(filePath, {
            duration: false,
            skipCovers: false,
        });
        if (metadata.common.picture && metadata.common.picture.length > 0) {
            const pic = metadata.common.picture[0];
            return {
                data: Buffer.from(pic.data),
                format: pic.format,
                type: pic.type,
                description: pic.description,
            };
        }
        return null;
    }
    catch (error) {
        console.error(`Failed to extract artwork from ${filePath}:`, error);
        return null;
    }
}
/**
 * Get audio duration only (faster than full metadata extraction)
 */
export async function getAudioDuration(filePath) {
    try {
        const metadata = await musicMetadata.parseFile(filePath, {
            duration: true,
            skipCovers: true,
        });
        return Math.round(metadata.format.duration || 0);
    }
    catch (error) {
        console.error(`Failed to get duration from ${filePath}:`, error);
        return 0;
    }
}
/**
 * Initialize IPC handlers for metadata extraction
 */
export function initMetadataExtractor() {
    ipcMain.handle('metadata:get', async (_event, filePath) => {
        return extractMetadata(filePath);
    });
    ipcMain.handle('metadata:artwork', async (_event, filePath) => {
        const artwork = await extractArtwork(filePath);
        if (artwork) {
            // Return as base64 data URL
            return `data:${artwork.format};base64,${artwork.data.toString('base64')}`;
        }
        return null;
    });
    ipcMain.handle('audio:duration', async (_event, filePath) => {
        return getAudioDuration(filePath);
    });
}
//# sourceMappingURL=metadata-extractor.js.map