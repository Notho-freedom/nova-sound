"use server"

import { publishTaskSmart } from "@/lib/event-bus-hybrid"
import { buildQueuedSnapshot, saveTaskSnapshot } from "@/lib/task-store"

export async function spawnTask<T>(type: string, payload: T) {
  // Smart routing: QStash for critical tasks, Redis Streams for real-time
  const envelope = await publishTaskSmart(type, payload, { source: "action" })
  const snapshot = buildQueuedSnapshot(envelope.id, envelope.type, payload)
  await saveTaskSnapshot(snapshot)
  
  // Revalidation is handled by the worker via webhook or UI polling
  // No need to call revalidateTag here—it will happen when task completes
  
  return envelope
}
