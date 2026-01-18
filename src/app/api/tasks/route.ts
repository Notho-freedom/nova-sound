import { NextRequest, NextResponse } from "next/server"
import { publishTask } from "@/lib/event-bus"
import { buildQueuedSnapshot, saveTaskSnapshot } from "@/lib/task-store"

export const runtime = "edge"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body.type !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const { type, payload } = body

  // Publish into the event bus (fire & forget)
  const envelope = await publishTask(type, payload, { source: "api" })

  // Persist initial snapshot (queued)
  const snapshot = buildQueuedSnapshot(envelope.id, envelope.type, payload)
  await saveTaskSnapshot(snapshot)

  // Revalidation is handled by the worker via webhook or UI polling

  return NextResponse.json({ id: envelope.id, status: snapshot.status })
}
