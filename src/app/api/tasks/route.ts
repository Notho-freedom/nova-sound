import { NextRequest, NextResponse } from "next/server"
import { publishTaskSmart } from "@/lib/event-bus-hybrid"
import { buildQueuedSnapshot, saveTaskSnapshot } from "@/lib/task-store"

export const runtime = "edge"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body.type !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const { type, payload } = body

  // Smart routing: QStash for critical tasks, Redis Streams for real-time
  const envelope = await publishTaskSmart(type, payload, { source: "api" })

  // Persist initial snapshot (queued)
  const snapshot = buildQueuedSnapshot(envelope.id, envelope.type, payload)
  await saveTaskSnapshot(snapshot)

  // Revalidation is handled by the worker via webhook or UI polling

  return NextResponse.json({ id: envelope.id, status: snapshot.status })
}
