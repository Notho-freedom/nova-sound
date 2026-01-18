/**
 * Ghost Backend style Event Bus built on Upstash Redis Streams.
 * - publishTask: XADD into stream
 * - stream name is configurable per use-case (default: "events")
 */

import * as Sentry from "@sentry/nextjs"
import { upstashXAdd, assertUpstashConfig } from "@/lib/upstash"

export type EventEnvelope<T = unknown> = {
  id: string
  type: string
  payload: T
  createdAt: number
  source?: string
  version?: string
}

export type PublishOptions = {
  stream?: string
  source?: string
  version?: string
  signal?: AbortSignal
}

const DEFAULT_STREAM = "events"

export async function publishTask<T>(type: string, payload: T, opts: PublishOptions = {}): Promise<EventEnvelope<T>> {
  assertUpstashConfig()
  const envelope: EventEnvelope<T> = {
    id: crypto.randomUUID(),
    type,
    payload,
    createdAt: Date.now(),
    source: opts.source ?? "web", // origin of emission
    version: opts.version ?? "v1",
  }

  const stream = opts.stream ?? DEFAULT_STREAM

  // XADD events * type <type> id <id> payload <json> createdAt <ts> source <src> version <ver>
  const args: (string | number)[] = ["*", "type", envelope.type, "id", envelope.id, "payload", JSON.stringify(envelope.payload), "createdAt", envelope.createdAt, "source", envelope.source ?? "", "version", envelope.version ?? ""]

  try {
    await upstashXAdd(stream, args, opts.signal)
    return envelope
  } catch (error) {
    Sentry.captureException(error)
    throw error
  }
}
