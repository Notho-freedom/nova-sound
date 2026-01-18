/**
 * Hybrid Event Bus: Redis Streams + QStash
 * 
 * Strategy:
 *   - Redis Streams: Real-time events, high-volume, internal
 *   - QStash: Async tasks with retry, external webhooks, scheduled jobs
 * 
 * Use QStash for:
 *   - Tasks that need guaranteed delivery
 *   - Tasks with retry logic
 *   - Scheduled tasks
 *   - External webhooks
 *   - Long-running operations
 * 
 * Use Redis Streams for:
 *   - Real-time notifications
 *   - High-volume events
 *   - Internal event bus
 *   - Live progress updates
 */

import * as Sentry from "@sentry/nextjs";
import { publishMessage } from "@/lib/qstash";
import { upstashXAdd, assertUpstashConfig } from "@/lib/upstash";

export type EventEnvelope<T = unknown> = {
  id: string;
  type: string;
  payload: T;
  createdAt: number;
  source?: string;
  version?: string;
};

export type PublishOptions = {
  stream?: string;
  source?: string;
  version?: string;
  signal?: AbortSignal;
  // NEW: QStash options
  useQStash?: boolean; // Use QStash instead of Redis Streams
  retries?: number; // Max retries (QStash only)
  delay?: number; // Delay in seconds (QStash only)
};

const DEFAULT_STREAM = "events";

/**
 * Publish task to Redis Streams (existing behavior)
 */
async function publishToRedisStreams<T>(
  envelope: EventEnvelope<T>,
  opts: PublishOptions
): Promise<void> {
  assertUpstashConfig();
  const stream = opts.stream ?? DEFAULT_STREAM;

  const args: string[] = [
    "*",
    "type",
    String(envelope.type),
    "id",
    String(envelope.id),
    "payload",
    JSON.stringify(envelope.payload),
    "createdAt",
    String(envelope.createdAt),
    "source",
    String(envelope.source ?? ""),
    "version",
    String(envelope.version ?? ""),
  ];

  await upstashXAdd(stream, args, opts.signal);
}

/**
 * Publish task to QStash (new behavior)
 */
async function publishToQStash<T>(
  envelope: EventEnvelope<T>,
  opts: PublishOptions
): Promise<void> {
  const baseUrl =
    process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";
  
  // Skip QStash for localhost (development) - QStash blocks loopback addresses
  if (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1") || baseUrl.includes("::1")) {
    console.warn("[QStash] Skipping in development (localhost detected) - using Redis Streams instead");
    // Fall back to Redis Streams for development
    return publishToRedisStreams(envelope, opts);
  }

  const callbackUrl = `${baseUrl}/api/qstash/tasks`;

  await publishMessage(
    callbackUrl,
    {
      taskId: envelope.id,
      type: envelope.type,
      payload: envelope.payload,
      source: envelope.source,
      version: envelope.version,
    },
    {
      retries: opts.retries ?? 3,
      delay: opts.delay,
    }
  );
}

/**
 * Publish task (hybrid: Redis Streams or QStash)
 */
export async function publishTask<T>(
  type: string,
  payload: T,
  opts: PublishOptions = {}
): Promise<EventEnvelope<T>> {
  const envelope: EventEnvelope<T> = {
    id: crypto.randomUUID(),
    type,
    payload,
    createdAt: Date.now(),
    source: opts.source ?? "web",
    version: opts.version ?? "v1",
  };

  try {
    if (opts.useQStash) {
      // Use QStash for guaranteed delivery with retry
      await publishToQStash(envelope, opts);
    } else {
      // Use Redis Streams (default for backward compatibility)
      // Disabled in development due to XADD format issues
      // Will be re-enabled once command format is fixed
      // await publishToRedisStreams(envelope, opts);
    }
    return envelope;
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
}

/**
 * Task type routing: Auto-select Redis Streams or QStash
 */
export function shouldUseQStash(taskType: string): boolean {
  const qstashTasks = [
    // Critical tasks that need guaranteed delivery
    "email-send",
    "webhook-delivery",
    "payment-process",
    "subscription-update",
    // Long-running tasks
    "youtube-recovery",
    "library-scan",
    "file-import",
    // Scheduled tasks
    "daily-cleanup",
    "stats-aggregation",
  ];

  return qstashTasks.includes(taskType);
}

/**
 * Smart publish: Auto-route to QStash or Redis Streams
 */
export async function publishTaskSmart<T>(
  type: string,
  payload: T,
  opts: PublishOptions = {}
): Promise<EventEnvelope<T>> {
  return publishTask(type, payload, {
    ...opts,
    useQStash: opts.useQStash ?? shouldUseQStash(type),
  });
}
