/**
 * Task progress streaming helpers
 * Publishes progress updates via Upstash KV for polling or SSE
 */

import { upstashSet } from "./upstash"

export type ProgressUpdate = {
  taskId: string
  status: "queued" | "processing" | "done" | "failed"
  progress?: number
  message?: string
  updatedAt: number
}

/**
 * Publish progress update for a task
 * Stored in KV with key `task:{id}:progress`
 */
export async function publishTaskProgress(
  update: ProgressUpdate,
  ttlSeconds: number = 3600
) {
  const key = `task:${update.taskId}:progress`
  const value = JSON.stringify(update)
  await upstashSet(key, value, ttlSeconds)
}
