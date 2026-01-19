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

export type TaskHandler = (
  payload: Record<string, unknown>,
  meta: TaskHandlerMeta
) => Promise<Record<string, unknown>>;

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
  const processedFiles = files.map((f: Record<string, unknown>, idx: number) => ({
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
  } catch (err: unknown) {
    return {
      recovered: 0,
      failed: trackIds.length,
      results: [],
      error: err instanceof Error ? err.message : String(err),
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

  if (typeof url !== "string") {
    throw new Error("Invalid URL");
  }

  const response = await fetch(url, {
    method: method as string,
    headers: {
      "Content-Type": "application/json",
      ...(headers as Record<string, string>),
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
 * Handler: stats-aggregation
 * Aggregate metrics or analytics on schedule
 */
export const handleStatsAggregation: TaskHandler = async () => {
  // TODO: Implement aggregation (analytics, cache warmup, etc.)
  return {
    aggregated: true,
    timestamp: Date.now(),
  };
};

/**
 * Handler: sync-deferred
 * Merge client patches into Upstash latest backup
 */
export const handleSyncDeferred: TaskHandler = async (payload) => {
  const { userId, type, data } = payload;

  if (typeof userId !== "string" || !userId || typeof type !== "string") {
    return { ok: false, error: "Missing userId or type" };
  }

  const { redis } = await import("@/lib/redis");
  if (!redis) {
    return { ok: false, error: "Redis not configured" };
  }
  const latestKey = `backup:${userId}:latest`;
  const latestRaw = await redis.get(latestKey);

  const latest = latestRaw ? JSON.parse(latestRaw as string) : { data: {}, playlists: [] };
  const now = Date.now();

  const dataMap: Record<string, string> = {
    settings: "settings",
    favorites: "favorites",
    history: "history",
    theme: "theme",
    notifications: "notificationsEnabled",
    volume: "volume",
    searchHistory: "searchHistory",
    uploadedMedia: "uploadedMedia",
    cloudinary: "cloudinaryConfig",
    equalizer: "equalizerPresets",
    scrobbler: "scrobblerSettings",
  };

  if (type === "playlists") {
    latest.playlists = Array.isArray(data) ? data : latest.playlists;
  } else if (dataMap[type]) {
    latest.data = latest.data || {};
    latest.data[dataMap[type]] = data;
  } else {
    return { ok: false, error: `Unknown sync type: ${type}` };
  }

  latest.data = latest.data || {};
  latest.data.lastSyncAt = new Date(now).toISOString();
  latest.data.version = (Number(latest.data.version) || 0) + 1;

  await redis.setex(latestKey, 60 * 60 * 24 * 30, JSON.stringify(latest));

  return { ok: true, updatedAt: now };
};

/**
 * Handler: assemblyai-poll
 * Poll AssemblyAI status and cache result
 */
export const handleAssemblyAIPoll: TaskHandler = async (payload) => {
  const { transcriptId, userId, audioUrl } = payload;

  if (typeof transcriptId !== "string" || !transcriptId || typeof userId !== "string") {
    return { ok: false, error: "Missing transcriptId or userId" };
  }

  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "AssemblyAI not configured" };
  }

  const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
    headers: { authorization: apiKey },
  });

  if (!statusResponse.ok) {
    return { ok: false, error: "Failed to fetch transcript status" };
  }

  const transcriptResult = await statusResponse.json();

  if (transcriptResult.status === "completed") {
    const { redis } = await import("@/lib/redis");
    if (redis) {
      const cacheKey = `ai:transcript:${transcriptId}`;
      const payloadToStore = {
        userId,
        audioUrl,
        transcript: transcriptResult.text,
        words: transcriptResult.words || [],
        chapters: transcriptResult.chapters || [],
        sentiment_analysis_results: transcriptResult.sentiment_analysis_results || [],
        entities: transcriptResult.entities || [],
        toxicity: transcriptResult.toxicity || null,
        speakers: transcriptResult.utterances || [],
        createdAt: new Date().toISOString(),
        status: "completed",
      };

      await redis.setex(cacheKey, 60 * 60 * 24 * 30, JSON.stringify(payloadToStore));
    }

    return { ok: true, status: "completed" };
  }

  if (transcriptResult.status === "error") {
    return { ok: false, status: "error", details: transcriptResult.error };
  }

  const { qstash } = await import("@/lib/qstash-helpers");
  await qstash.task.publishDelayed('assemblyai-poll', { transcriptId, userId, audioUrl }, 5);

  return { ok: true, status: transcriptResult.status };
};

/**
 * Handler: backup-snapshot
 * Create a periodic backup from the latest Upstash snapshot
 */
export const handleBackupSnapshot: TaskHandler = async (payload, meta) => {
  const { userId, intervalSeconds } = payload;

  if (typeof userId !== "string" || !userId) {
    return { ok: false, error: "Missing userId" };
  }

  const { redis } = await import("@/lib/redis");
  const { qstash } = await import("@/lib/qstash-helpers");
  
  if (!redis) {
    return { ok: false, error: "Redis not configured" };
  }

  const lockKey = `backup:${userId}:loop`;
  await redis.set(lockKey, String(meta.id), { ex: 7200 });

  const latestKey = `backup:${userId}:latest`;
  const latestRaw = await redis.get(latestKey);

  const nextInterval = Math.max(60, Number(intervalSeconds) || 3600);

  if (!latestRaw) {
    // Reschedule and exit if nothing to snapshot yet
    await qstash.task.publishDelayed("backup-snapshot", { userId, intervalSeconds: nextInterval }, nextInterval);
    return { ok: true, skipped: true };
  }

  const latest = JSON.parse(latestRaw as string);
  const timestamp = Date.now();
  const backupId = `backup_appdata_${timestamp}`;

  const backup = {
    ...latest,
    id: backupId,
    backupCreatedAt: new Date(timestamp).toISOString(),
    backupTimestamp: timestamp,
  };

  const indexKey = `backup:${userId}:index`;
  const itemKey = `backup:${userId}:item:${backupId}`;

  await redis.setex(itemKey, 60 * 60 * 24 * 30, JSON.stringify(backup));
  await redis.zadd(indexKey, { score: timestamp, member: backupId });

  const count = await redis.zcard(indexKey);
  if (count > 10) {
    const excess = count - 10;
    const oldIds = await redis.zrange(indexKey, 0, excess - 1);
    if (oldIds.length > 0) {
      await redis.zrem(indexKey, ...oldIds);
      const oldKeys = oldIds.map((id) => `backup:${userId}:item:${String(id)}`);
      await redis.del(...oldKeys);
    }
  }

  // Reschedule next snapshot
  await qstash.task.publishDelayed("backup-snapshot", { userId, intervalSeconds: nextInterval }, nextInterval);

  return {
    ok: true,
    backupId,
    timestamp,
  };
};

/**
 * Handler: onboarding-welcome
 * Send welcome email (step 1 of onboarding workflow)
 */
export const handleOnboardingWelcome: TaskHandler = async (payload, meta) => {
  const { userId, email, name } = payload;

  // Send welcome email
  console.log(`[onboarding-welcome] Sending welcome email to ${email}`);

  // TODO: Integrate with email provider (Resend, SendGrid, etc.)
  // For now, just log
  const emailSent = true;

  // Update workflow state
  try {
    const { redis } = await import("@/lib/redis");
    if (redis) {
      const stateRaw = await redis.get(`workflow:onboarding:${userId}`);
      if (stateRaw) {
        const state = JSON.parse(stateRaw as string);
        state.welcomeEmailSent = true;
        await redis.set(
          `workflow:onboarding:${userId}`,
          JSON.stringify(state),
          { ex: 604800 }
        );
      }
    }
  } catch (error) {
    console.error("[onboarding-welcome] Failed to update state:", error);
  }

  return {
    sent: emailSent,
    userId,
    email,
    step: "welcome",
    timestamp: Date.now(),
  };
};

/**
 * Handler: onboarding-tips
 * Send tips & tricks email (step 2 of onboarding workflow)
 */
export const handleOnboardingTips: TaskHandler = async (payload, meta) => {
  const { userId, email, name } = payload;

  console.log(`[onboarding-tips] Sending tips email to ${email}`);

  // TODO: Send tips email
  const emailSent = true;

  // Update workflow state
  try {
    const { redis } = await import("@/lib/redis");
    if (redis) {
      const stateRaw = await redis.get(`workflow:onboarding:${userId}`);
      if (stateRaw) {
        const state = JSON.parse(stateRaw as string);
        state.tipsEmailSent = true;
        await redis.set(
          `workflow:onboarding:${userId}`,
          JSON.stringify(state),
          { ex: 604800 }
        );
      }
    }
  } catch (error) {
    console.error("[onboarding-tips] Failed to update state:", error);
  }

  return {
    sent: emailSent,
    userId,
    email,
    step: "tips",
    timestamp: Date.now(),
  };
};

/**
 * Handler: onboarding-check-pro
 * Check if user upgraded to Pro (step 3 of onboarding workflow)
 */
export const handleOnboardingCheckPro: TaskHandler = async (payload, meta) => {
  const { userId, email, name } = payload;

  console.log(`[onboarding-check-pro] Checking Pro status for ${userId}`);

  // TODO: Check Firebase user subscription status
  const isPro = false; // Placeholder

  // Update workflow state
  try {
    const { redis } = await import("@/lib/redis");
    if (redis) {
      const stateRaw = await redis.get(`workflow:onboarding:${userId}`);
      if (stateRaw) {
        const state = JSON.parse(stateRaw as string);
        state.isPro = isPro;

        if (!isPro) {
          // Send upgrade reminder
          console.log(`[onboarding-check-pro] Sending upgrade reminder to ${email}`);
          // TODO: Send upgrade reminder email
          state.upgradeReminderSent = true;
        }

        state.completedAt = Date.now();
        await redis.set(
          `workflow:onboarding:${userId}`,
          JSON.stringify(state),
          { ex: 604800 }
        );
      }
    }
  } catch (error) {
    console.error("[onboarding-check-pro] Failed to update state:", error);
  }

  return {
    userId,
    isPro,
    upgradeReminderSent: !isPro,
    step: "check-pro",
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
  "stats-aggregation": handleStatsAggregation,
  "backup-snapshot": handleBackupSnapshot,
  "sync-deferred": handleSyncDeferred,
  "assemblyai-poll": handleAssemblyAIPoll,
  "onboarding-welcome": handleOnboardingWelcome,
  "onboarding-tips": handleOnboardingTips,
  "onboarding-check-pro": handleOnboardingCheckPro,
};
