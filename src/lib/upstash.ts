/**
 * Lightweight Upstash Redis REST client (Edge-safe).
 * Uses command-per-URL style (/{command}) with JSON array args.
 */

import * as Sentry from "@sentry/nextjs"

const endpoint = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN

export function assertUpstashConfig() {
  if (!endpoint || !token) {
    throw new Error("Upstash Redis REST env vars missing (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN)")
  }
}

export type UpstashResponse<T = unknown> = { result: T; error?: string }

async function upstashFetch<T>(path: string, args: (string | number)[], signal?: AbortSignal): Promise<T> {
  assertUpstashConfig()
  const url = `${endpoint!.replace(/\/$/, "")}/${path.replace(/^\//, "")}`

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
      signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`Upstash request failed (${res.status}): ${text}`)
    }

    const json = (await res.json()) as UpstashResponse<T>
    if ((json as any)?.error) {
      throw new Error(String((json as any).error))
    }
    return json.result
  } catch (error) {
    Sentry.captureException(error)
    throw error
  }
}

/** XADD helper (streams). */
export async function upstashXAdd(stream: string, args: (string | number)[], signal?: AbortSignal) {
  return upstashFetch<string>(`xadd/${stream}`, args, signal)
}

/** XGROUP CREATE helper. */
export async function upstashXGroupCreate(stream: string, group: string, start: string = "$", signal?: AbortSignal) {
  // XGROUP CREATE <stream> <group> <id> MKSTREAM
  return upstashFetch<string>("xgroup", ["CREATE", stream, group, start, "MKSTREAM"], signal)
}

export type XReadGroupResult = Array<
  [
    stream: string,
    entries: Array<
      [
        id: string,
        fields: Array<string | number>
      ]
    >
  ]
>

/** XREADGROUP helper (streams). */
export async function upstashXReadGroup(
  stream: string,
  group: string,
  consumer: string,
  opts: { count?: number; blockMs?: number } = {},
  signal?: AbortSignal
) {
  const args: (string | number)[] = ["GROUP", group, consumer]
  if (opts.count) {
    args.push("COUNT", opts.count)
  }
  if (opts.blockMs) {
    args.push("BLOCK", opts.blockMs)
  }
  args.push("STREAMS", stream, ">")
  return upstashFetch<XReadGroupResult>("xreadgroup", args, signal)
}

/** XACK helper. */
export async function upstashXAck(stream: string, group: string, ids: string[], signal?: AbortSignal) {
  return upstashFetch<number>("xack", [stream, group, ...ids], signal)
}

/** Set helper (simple KV). */
export async function upstashSet(key: string, value: string, ttlSeconds?: number, signal?: AbortSignal) {
  const payload = ttlSeconds ? [key, value, "EX", ttlSeconds] : [key, value]
  return upstashFetch<"OK">("set", payload, signal)
}

/** Get helper (simple KV). */
export async function upstashGet(key: string, signal?: AbortSignal) {
  return upstashFetch<string | null>("get", [key], signal)
}

/** Ping helper. */
export async function upstashPing(signal?: AbortSignal) {
  return upstashFetch<"PONG">("ping", [], signal)
}
