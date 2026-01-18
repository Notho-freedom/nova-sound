"use server"

import { publishTask } from "@/lib/event-bus"
import { buildQueuedSnapshot, saveTaskSnapshot } from "@/lib/task-store"

export async function spawnTask<T>(type: string, payload: T) {
  // Edge-friendly server action to enqueue a task
  const envelope = await publishTask(type, payload, { source: "action" })
  const snapshot = buildQueuedSnapshot(envelope.id, envelope.type, payload)
  await saveTaskSnapshot(snapshot)
  
  // Revalidation is handled by the worker via webhook or UI polling
  // No need to call revalidateTag here—it will happen when task completes
  
  return envelope
}
