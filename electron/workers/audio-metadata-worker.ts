import { parentPort } from "worker_threads";
import * as musicMetadata from "music-metadata";
import * as path from "path";

interface WorkerPayload {
  filePath: string;
}

interface WorkerResult {
  metadata: {
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
  } | null;
  artwork?: { dataBase64: string; format: string; type?: string; description?: string } | null;
}

const extract = async (filePath: string): Promise<WorkerResult> => {
  try {
    const metadata = await musicMetadata.parseFile(filePath, { duration: true });
    const { common, format } = metadata;

    let artwork: { dataBase64: string; format: string; type?: string; description?: string } | null = null;
    if (common.picture && common.picture.length > 0) {
      const pic = common.picture[0];
      artwork = {
        dataBase64: Buffer.from(pic.data).toString("base64"),
        format: pic.format,
        type: pic.type,
        description: pic.description,
      };
    }

    const ext = path.extname(filePath).slice(1).toUpperCase();

    return {
      metadata: {
        title: common.title,
        artist: common.artist || common.artists?.join(", "),
        album: common.album,
        year: common.year,
        genre: common.genre?.join(", "),
        duration: Math.round(format.duration || 0),
        bitrate: format.bitrate ? Math.round(format.bitrate / 1000) : undefined,
        sampleRate: format.sampleRate,
        channels: format.numberOfChannels,
        format: format.container || format.codec || ext,
        trackNumber: common.track?.no || undefined,
        discNumber: common.disk?.no || undefined,
        albumArtist: common.albumartist,
        composer: common.composer?.join(", "),
        comment: common.comment?.join(", "),
        lyrics: common.lyrics?.join("\n"),
      },
      artwork,
    };
  } catch (error) {
    return { metadata: null, artwork: null };
  }
};

parentPort?.on("message", async (message: { id: number; payload: WorkerPayload }) => {
  try {
    const result = await extract(message.payload.filePath);
    parentPort?.postMessage({ id: message.id, result });
  } catch (error) {
    parentPort?.postMessage({ id: message.id, error: (error as Error).message });
  }
});
