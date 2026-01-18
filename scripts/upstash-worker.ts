import "dotenv/config"
import os from "node:os"
import process from "node:process"
import * as Sentry from "@sentry/node"

import { upstashXAck, upstashXGroupCreate, upstashXReadGroup, type XReadGroupResult } from "@/lib/upstash"
import { getTaskSnapshot, saveTaskSnapshot, type TaskSnapshot } from "@/lib/task-store"

const STREAM = process.env.TASK_STREAM ?? "events"
const GROUP = process.env.TASK_GROUP ?? "ghost-workers"
const CONSUMER = process.env.TASK_CONSUMER ?? `worker-${os.hostname()}-${process.pid}`
const BATCH_SIZE = Number(process.env.TASK_BATCH_SIZE ?? 10)
const BLOCK_MS = Number(process.env.TASK_BLOCK_MS ?? 20000)
const REVALIDATE_WEBHOOK = process.env.TASK_REVALIDATE_WEBHOOK

// Init Sentry for the worker runtime (no-op if DSN absent)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.05,
    environment: process.env.NODE_ENV ?? "development",
  })
}

function log(...args: unknown[]) {
  console.log(`[worker:${CONSUMER}]`, ...args)
}

function warn(...args: unknown[]) {
  console.warn(`[worker:${CONSUMER}]`, ...args)
}

function errorLog(...args: unknown[]) {
  console.error(`[worker:${CONSUMER}]`, ...args)
}

type ParsedEntry = {
  entryId: string
  fields: Record<string, string>
}

type TaskHandler = (payload: any, meta: { id: string; type: string; source?: string; version?: string }) => Promise<any>

// Register handlers per task type (extend in future sprints)
const handlers: Record<string, TaskHandler> = {
  // Example: "open-files": async (payload) => { ... }
}

const defaultHandler: TaskHandler = async (payload, meta) => {
  // Placeholder handler; extend with real work per task type
  return { ok: true, receivedType: meta.type, receivedPayload: payload }
}

function parseFields(fields: Array<string | number>): Record<string, string> {
  const obj: Record<string, string> = {}
  for (let i = 0; i < fields.length; i += 2) {
    const key = String(fields[i])
    const value = fields[i + 1] !== undefined ? String(fields[i + 1]) : ""
    obj[key] = value
  }
  return obj
}

function parseXRead(raw: XReadGroupResult | null): ParsedEntry[] {
  if (!raw) return []
  const entries: ParsedEntry[] = []
  for (const [, streamEntries] of raw) {
    for (const [entryId, fields] of streamEntries) {
      entries.push({ entryId, fields: parseFields(fields) })
    }
  }
  return entries
}

function safeJsonParse<T>(raw?: string): T | undefined {
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as T
  } catch (err) {
    warn("Failed to parse payload JSON", raw, err)
    return undefined
  }
}

async function notifyRevalidate(taskId: string) {
  if (!REVALIDATE_WEBHOOK) return
  try {
    await fetch(REVALIDATE_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag: `task:${taskId}`, id: taskId }),
    })
  } catch (err) {
    warn("Revalidate webhook failed", err)
  }
}

async function ensureGroup() {
  try {
    await upstashXGroupCreate(STREAM, GROUP, "$")
    log(`Created consumer group ${GROUP} on stream ${STREAM}`)
  } catch (err: any) {
    const message = String(err?.message ?? err ?? "")
    if (message.toUpperCase().includes("BUSYGROUP")) {
      return
    }
    throw err
  }
}

async function handleEntry(entry: ParsedEntry) {
  const { entryId, fields } = entry
  const taskId = fields.id ?? entryId
  const type = fields.type ?? "unknown"
  const payload = safeJsonParse(fields.payload)
  const now = Date.now()

  const existing = (await getTaskSnapshot(taskId)) as TaskSnapshot | null
  const base: TaskSnapshot = existing ?? {
    id: taskId,
    type,
    status: "queued",
    createdAt: Number(fields.createdAt ?? now),
    updatedAt: now,
    payload,
    source: fields.source,
    version: fields.version,
  }

  // Mark as processing
  await saveTaskSnapshot({ ...base, status: "processing", updatedAt: now })

  try {
    const handler = handlers[type] ?? defaultHandler
    const result = await handler(payload, { id: taskId, type, source: base.source, version: base.version })

    await saveTaskSnapshot({
      ...base,
      status: "done",
      updatedAt: Date.now(),
      result,
      payload: base.payload ?? payload,
    })
  } catch (err: any) {
    const message = String(err?.message ?? err ?? "Unknown error")
    await saveTaskSnapshot({
      ...base,
      status: "failed",
      updatedAt: Date.now(),
      error: message.slice(0, 500),
      payload: base.payload ?? payload,
    })
    Sentry.captureException(err)
    throw err
  } finally {
    await upstashXAck(STREAM, GROUP, [entryId])
    await notifyRevalidate(taskId)
  }
}

async function main() {
  log(`Starting worker on stream=${STREAM} group=${GROUP} consumer=${CONSUMER}`)
  await ensureGroup()

  while (true) {
    try {
      const raw = await upstashXReadGroup(STREAM, GROUP, CONSUMER, { count: BATCH_SIZE, blockMs: BLOCK_MS })
      const entries = parseXRead(raw)

      if (!entries.length) {
        continue
      }

      for (const entry of entries) {
        await handleEntry(entry)
      }
    } catch (err) {
      errorLog("Worker loop error", err)
      Sentry.captureException(err)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

main().catch(err => {
  errorLog("Worker failed to start", err)
  Sentry.captureException(err)
  process.exit(1)
})
