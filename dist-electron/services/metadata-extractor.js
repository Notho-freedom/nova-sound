import { ipcMain } from 'electron';
import { WorkerPool } from './worker-pool.js';
import * as os from 'os';
const metadataWorkerPool = new WorkerPool(new URL('../workers/audio-metadata-worker.js', import.meta.url), Math.max(2, Math.min(4, Math.max(1, os.cpus().length - 1))));
/**
 * Extract metadata from an audio file
 */
export async function extractMetadata(filePath) {
    try {
        const workerResult = await metadataWorkerPool.runTask({ filePath });
        if (!workerResult?.metadata)
            return null;
        const artwork = workerResult.artwork
            ? {
                data: Buffer.from(workerResult.artwork.dataBase64, 'base64'),
                format: workerResult.artwork.format,
                type: workerResult.artwork.type,
                description: workerResult.artwork.description,
            }
            : undefined;
        return {
            ...workerResult.metadata,
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
        const workerResult = await metadataWorkerPool.runTask({ filePath });
        if (!workerResult?.artwork)
            return null;
        return {
            data: Buffer.from(workerResult.artwork.dataBase64, 'base64'),
            format: workerResult.artwork.format,
            type: workerResult.artwork.type,
            description: workerResult.artwork.description,
        };
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
        const workerResult = await metadataWorkerPool.runTask({ filePath });
        return workerResult?.metadata?.duration ?? 0;
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