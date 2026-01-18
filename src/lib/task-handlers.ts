/**
 * Shared Task Handlers (Edge-compatible)
 * 
 * Used by:
 *   - QStash callback endpoint (serverless)
 *   - Upstash worker (Node.js)
 * 
 * Pattern:
 *   - Each handler is a pure function
 *   - No Node.js-specific APIs (for Edge runtime)
 *   - Async operations only
 */

export type TaskHandlerMeta = {
  id: string;
  type: string;
  source?: string;
  version?: string;
};

export type TaskHandler = (payload: any, meta: TaskHandlerMeta) => Promise<any>;

/**
 * Handler: open-files
 * Process selected audio files
 */
export const handleOpenFiles: TaskHandler = async (payload, meta) => {
  const { fileCount, files, action } = payload;

  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("No files provided");
  }

  // Process file metadata
  const processedFiles = files.map((f: any, idx: number) => ({
    index: idx,
    name: f.name,
    size: f.size,
    type: f.type,
    id: `file-${Date.now()}-${idx}`,
  }));

  return {
    processed: processedFiles.length,
    action,
    files: processedFiles,
    timestamp: Date.now(),
  };
};

/**
 * Handler: youtube-recovery
 * Recover missing YouTube tracks
 */
export const handleYouTubeRecovery: TaskHandler = async (payload, meta) => {
  const { trackIds } = payload;

  if (!Array.isArray(trackIds) || trackIds.length === 0) {
    return { recovered: 0, failed: 0, results: [] };
  }

  // Note: This needs dynamic import to avoid bundling issues
  // Import moved to runtime in QStash callback
  try {
    const { recoverMissingYouTubeTracks } = await import(
      "@/lib/youtube-track-recovery"
    );
    const recoveredMap = await recoverMissingYouTubeTracks(trackIds);
    const recovered = recoveredMap.size;
    const failed = trackIds.length - recovered;

    const results = Array.from(recoveredMap.values()).map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      youtubeVideoId: track.youtubeVideoId,
    }));

    return {
      recovered,
      failed,
      results,
      timestamp: Date.now(),
    };
  } catch (err: any) {
    return {
      recovered: 0,
      failed: trackIds.length,
      results: [],
      error: String(err?.message ?? err),
    };
  }
};

/**
 * Handler: import-library
 * Scan local library
 */
export const handleImportLibrary: TaskHandler = async (payload, meta) => {
  const { scan = true } = payload;

  return {
    status: "initiated",
    scan,
    timestamp: Date.now(),
    note: "Library scan initiated; client should poll library state",
  };
};

/**
 * Handler: email-send
 * Send email notification (QStash optimized)
 */
export const handleEmailSend: TaskHandler = async (payload, meta) => {
  const { to, subject, body, template } = payload;

  // TODO: Integrate with email provider (Resend, SendGrid, etc.)
  console.log(`[email-send] Sending to ${to}: ${subject}`);

  return {
    sent: true,
    to,
    subject,
    timestamp: Date.now(),
  };
};

/**
 * Handler: webhook-delivery
 * Deliver webhook to external service
 */
export const handleWebhookDelivery: TaskHandler = async (payload, meta) => {
  const { url, method = "POST", body, headers = {} } = payload;

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  return {
    success: response.ok,
    status: response.status,
    statusText: response.statusText,
    timestamp: Date.now(),
  };
};

/**
 * Handler: daily-cleanup
 * Clean up old data (scheduled task)
 */
export const handleDailyCleanup: TaskHandler = async (payload, meta) => {
  const { daysToKeep = 30 } = payload;

  // TODO: Cleanup logic
  console.log(`[daily-cleanup] Cleaning data older than ${daysToKeep} days`);

  return {
    cleaned: 0,
    daysToKeep,
    timestamp: Date.now(),
  };
};

/**
 * Default handler for unknown tasks
 */
export const defaultHandler: TaskHandler = async (payload, meta) => {
  return {
    ok: true,
    message: `Task type '${meta.type}' not yet implemented`,
    receivedPayload: payload,
  };
};

/**
 * Task handler registry
 */
export const TASK_HANDLERS: Record<string, TaskHandler> = {
  "open-files": handleOpenFiles,
  "youtube-recovery": handleYouTubeRecovery,
  "import-library": handleImportLibrary,
  "email-send": handleEmailSend,
  "webhook-delivery": handleWebhookDelivery,
  "daily-cleanup": handleDailyCleanup,
};
