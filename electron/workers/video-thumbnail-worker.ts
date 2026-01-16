import { parentPort } from "worker_threads";
import * as fs from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import ffmpegStatic from "ffmpeg-static";

const execAsync = promisify(exec);

interface WorkerPayload {
  filePath: string;
  useFirstFrame?: boolean;
}

interface WorkerResult {
  thumbnailDataBase64?: string;
}

let ffmpegAvailable: boolean | null = null;
let ffmpegPath: string | null = null;

async function checkFfmpegAvailable(): Promise<boolean> {
  if (ffmpegAvailable !== null) return ffmpegAvailable;

  if (ffmpegStatic) {
    try {
      const fsSync = await import("fs");
      if (fsSync.existsSync(ffmpegStatic)) {
        ffmpegPath = ffmpegStatic;
        ffmpegAvailable = true;
        return true;
      }
    } catch {
      // ignore
    }
  }

  try {
    await execAsync("ffmpeg -version");
    ffmpegPath = "ffmpeg";
    ffmpegAvailable = true;
  } catch {
    ffmpegAvailable = false;
    ffmpegPath = null;
  }

  return ffmpegAvailable;
}

async function generateThumbnail(filePath: string, useFirstFrame?: boolean): Promise<WorkerResult | null> {
  const hasFfmpeg = await checkFfmpegAvailable();
  if (!hasFfmpeg || !ffmpegPath) return null;

  const os = await import("os");
  const tempDir = os.tmpdir();
  const thumbnailPath = path.join(tempDir, `nexus_thumb_${Date.now()}_${Math.random().toString(16).slice(2)}.jpg`);

  const timeOffsets = useFirstFrame ? ["00:00:00"] : ["00:00:02", "00:00:00"];

  for (const timeOffset of timeOffsets) {
    try {
      await execAsync(
        `"${ffmpegPath}" -y -hide_banner -loglevel error -ss ${timeOffset} -i "${filePath}" -vframes 1 -vf "scale=320:-1" "${thumbnailPath}"`,
        { timeout: 30000 }
      );

      const buffer = await fs.readFile(thumbnailPath);
      await fs.unlink(thumbnailPath).catch(() => undefined);
      return { thumbnailDataBase64: buffer.toString("base64") };
    } catch {
      // try next offset
    }
  }

  return null;
}

parentPort?.on("message", async (message: { id: number; payload: WorkerPayload }) => {
  try {
    const result = await generateThumbnail(message.payload.filePath, message.payload.useFirstFrame);
    parentPort?.postMessage({ id: message.id, result });
  } catch (error) {
    parentPort?.postMessage({ id: message.id, error: (error as Error).message });
  }
});
