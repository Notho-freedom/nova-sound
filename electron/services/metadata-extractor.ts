import { ipcMain } from 'electron';
import { Redis } from '@upstash/redis';
import { WorkerPool } from './worker-pool.js';
import * as os from 'os';
import { promises as fs } from 'fs';

export interface ExtractedMetadata {
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  genre?: string;
  duration: number;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  format: string;
  trackNumber?: number;
  discNumber?: number;
  albumArtist?: string;
  composer?: string;
  comment?: string;
  lyrics?: string;
  artwork?: ArtworkData;
}

export interface ArtworkData {
  data: Buffer;
  format: string;
  type?: string;
  description?: string;
}

type CachedMetadata = Omit<ExtractedMetadata, 'artwork'> & {
  artworkBase64?: string;
  artworkFormat?: string;
  artworkType?: string;
  artworkDescription?: string;
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const memoryCache = {
  metadata: new Map<string, CacheEntry<ExtractedMetadata | null>>(),
  artwork: new Map<string, CacheEntry<string | null>>(),
  duration: new Map<string, CacheEntry<number>>(),
};

const CACHE_TTL = {
  metadata: 10 * 60 * 1000,
  artwork: 30 * 60 * 1000,
  duration: 60 * 60 * 1000,
};

const MAX_ARTWORK_REDIS_BYTES = 512 * 1024; // 512KB

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? Redis.fromEnv()
  : null;

function getFromMemory<T>(map: Map<string, CacheEntry<T>>, key: string): { hit: boolean; value: T | null } {
  const entry = map.get(key);
  if (!entry) return { hit: false, value: null };
  if (entry.expiresAt < Date.now()) {
    map.delete(key);
    return { hit: false, value: null };
  }
  return { hit: true, value: entry.value };
}

function setInMemory<T>(map: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number) {
  map.set(key, { value, expiresAt: Date.now() + ttlMs });
}

async function getFileSignature(filePath: string): Promise<string> {
  try {
    const stats = await fs.stat(filePath);
    return `${stats.mtimeMs}:${stats.size}`;
  } catch {
    return '0:0';
  }
}

function makeCacheKey(prefix: string, filePath: string, signature: string): string {
  return `electron:${prefix}:${encodeURIComponent(filePath)}:${signature}`;
}

async function getFromRedis<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    return await redis.get<T>(key);
  } catch {
    return null;
  }
}

async function setInRedis<T>(key: string, value: T, ttlMs: number): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, value, { ex: Math.max(1, Math.floor(ttlMs / 1000)) });
  } catch {
    // Silent fail - cache is best-effort
  }
}

const metadataWorkerPool = new WorkerPool<
  { filePath: string },
  { metadata: ExtractedMetadata | null; artwork?: { dataBase64: string; format: string; type?: string; description?: string } | null }
>(
  new URL('../workers/audio-metadata-worker.js', import.meta.url),
  Math.max(2, Math.min(4, Math.max(1, os.cpus().length - 1)))
);

/**
 * Extract metadata from an audio file
 */
export async function extractMetadata(filePath: string): Promise<ExtractedMetadata | null> {
  try {
    const workerResult = await metadataWorkerPool.runTask({ filePath });
    if (!workerResult?.metadata) return null;

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
  } catch (error) {
    console.error(`Failed to extract metadata from ${filePath}:`, error);
    return null;
  }
}

/**
 * Extract only the album artwork from a file
 */
export async function extractArtwork(filePath: string): Promise<ArtworkData | null> {
  try {
    const workerResult = await metadataWorkerPool.runTask({ filePath });
    if (!workerResult?.artwork) return null;

    return {
      data: Buffer.from(workerResult.artwork.dataBase64, 'base64'),
      format: workerResult.artwork.format,
      type: workerResult.artwork.type,
      description: workerResult.artwork.description,
    };
  } catch (error) {
    console.error(`Failed to extract artwork from ${filePath}:`, error);
    return null;
  }
}

/**
 * Get audio duration only (faster than full metadata extraction)
 */
export async function getAudioDuration(filePath: string): Promise<number> {
  try {
    const workerResult = await metadataWorkerPool.runTask({ filePath });
    return workerResult?.metadata?.duration ?? 0;
  } catch (error) {
    console.error(`Failed to get duration from ${filePath}:`, error);
    return 0;
  }
}

/**
 * Initialize IPC handlers for metadata extraction
 */
export function initMetadataExtractor() {
  ipcMain.handle('metadata:get', async (_event, filePath: string) => {
    const signature = await getFileSignature(filePath);
    const key = makeCacheKey('metadata', filePath, signature);

    const memoryHit = getFromMemory(memoryCache.metadata, key);
    if (memoryHit.hit) return memoryHit.value;

    const redisHit = await getFromRedis<CachedMetadata | null>(key);
    if (redisHit !== null) {
      const reconstructed: ExtractedMetadata = {
        ...redisHit,
        artwork: redisHit.artworkBase64
          ? {
              data: Buffer.from(redisHit.artworkBase64, 'base64'),
              format: redisHit.artworkFormat || 'image/jpeg',
              type: redisHit.artworkType,
              description: redisHit.artworkDescription,
            }
          : undefined,
      };
      setInMemory(memoryCache.metadata, key, reconstructed, CACHE_TTL.metadata);
      return reconstructed;
    }

    const fresh = await extractMetadata(filePath);
    setInMemory(memoryCache.metadata, key, fresh, CACHE_TTL.metadata);

    if (fresh) {
      const { artwork, ...rest } = fresh;
      const cached: CachedMetadata = {
        ...rest,
        artworkBase64: artwork?.data?.toString('base64'),
        artworkFormat: artwork?.format,
        artworkType: artwork?.type,
        artworkDescription: artwork?.description,
      };
      await setInRedis(key, cached, CACHE_TTL.metadata);
    }

    return fresh;
  });

  ipcMain.handle('metadata:artwork', async (_event, filePath: string) => {
    const signature = await getFileSignature(filePath);
    const key = makeCacheKey('artwork', filePath, signature);

    const memoryHit = getFromMemory(memoryCache.artwork, key);
    if (memoryHit.hit) return memoryHit.value;

    const redisHit = await getFromRedis<string | null>(key);
    if (redisHit !== null) {
      setInMemory(memoryCache.artwork, key, redisHit, CACHE_TTL.artwork);
      return redisHit;
    }

    const artwork = await extractArtwork(filePath);
    if (!artwork) {
      setInMemory(memoryCache.artwork, key, null, CACHE_TTL.artwork);
      return null;
    }

    const dataUrl = `data:${artwork.format};base64,${artwork.data.toString('base64')}`;
    setInMemory(memoryCache.artwork, key, dataUrl, CACHE_TTL.artwork);

    if (Buffer.byteLength(dataUrl, 'utf8') <= MAX_ARTWORK_REDIS_BYTES) {
      await setInRedis(key, dataUrl, CACHE_TTL.artwork);
    }

    return dataUrl;
  });

  ipcMain.handle('audio:duration', async (_event, filePath: string) => {
    const signature = await getFileSignature(filePath);
    const key = makeCacheKey('duration', filePath, signature);

    const memoryHit = getFromMemory(memoryCache.duration, key);
    if (memoryHit.hit) return memoryHit.value;

    const redisHit = await getFromRedis<number>(key);
    if (typeof redisHit === 'number') {
      setInMemory(memoryCache.duration, key, redisHit, CACHE_TTL.duration);
      return redisHit;
    }

    const duration = await getAudioDuration(filePath);
    setInMemory(memoryCache.duration, key, duration, CACHE_TTL.duration);
    await setInRedis(key, duration, CACHE_TTL.duration);
    return duration;
  });
}

