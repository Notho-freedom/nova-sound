import * as Sentry from "@sentry/nextjs"
import { upstashGet, upstashSet, assertUpstashConfig } from "@/lib/upstash"

export type TaskStatus = "queued" | "processing" | "done" | "failed"

export interface TaskSnapshot<TPayload = unknown, TResult = unknown> {
  id: string
  type: string
  status: TaskStatus
  createdAt: number
  updatedAt: number
  payload?: TPayload
  result?: TResult
  error?: string
  progress?: number
  version?: string
  source?: string
}

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 // 24h

function taskKey(id: string) {
  return `task:${id}`
}

export async function saveTaskSnapshot(snapshot: TaskSnapshot, ttlSeconds: number = DEFAULT_TTL_SECONDS) {
  assertUpstashConfig()
  try {
    const value = JSON.stringify(snapshot)
    await upstashSet(taskKey(snapshot.id), value, ttlSeconds)
  } catch (error) {
    Sentry.captureException(error)
    throw error
  }
}

export async function getTaskSnapshot<TResult = unknown>(id: string): Promise<TaskSnapshot<TResult> | null> {
  assertUpstashConfig()
  try {
    const raw = await upstashGet(taskKey(id))
    if (!raw) return null
    return JSON.parse(raw) as TaskSnapshot<TResult>
  } catch (error) {
    Sentry.captureException(error)
    throw error
  }
}

export function buildQueuedSnapshot<TPayload>(id: string, type: string, payload?: TPayload): TaskSnapshot<TPayload> {
  const now = Date.now()
  return {
    id,
    type,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    payload,
  }
}
