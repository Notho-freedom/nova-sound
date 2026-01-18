import { useEffect, useState } from "react"
import type { TaskSnapshot } from "@/lib/task-store"

export type UseTaskStatusOptions = {
  pollIntervalMs?: number
  enabled?: boolean
}

export function useTaskStatus<TResult = unknown>(
  taskId: string | null,
  opts: UseTaskStatusOptions = {}
) {
  const { pollIntervalMs = 1000, enabled = true } = opts
  const [snapshot, setSnapshot] = useState<TaskSnapshot<TResult> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!taskId || !enabled) return

    let interval: ReturnType<typeof setInterval> | undefined
    let mounted = true

    const fetchSnapshot = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          cache: "no-store",
          next: { tags: [`task:${taskId}`] },
        })

        if (!res.ok) {
          if (res.status === 404) {
            if (mounted) {
              setSnapshot(null)
              setError("Task not found")
            }
            return
          }
          throw new Error(`HTTP ${res.status}`)
        }

        const data = (await res.json()) as TaskSnapshot<TResult>
        if (mounted) {
          setSnapshot(data)
          setError(null)

          // Stop polling once task is done or failed
          if (data.status === "done" || data.status === "failed") {
            if (interval) clearInterval(interval)
          }
        }
      } catch (err: any) {
        const message = String(err?.message ?? err ?? "Unknown error")
        if (mounted) {
          setError(message)
        }
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    // Fetch immediately
    fetchSnapshot()

    // Poll periodically
    interval = setInterval(fetchSnapshot, pollIntervalMs)

    return () => {
      mounted = false
      if (interval) clearInterval(interval)
    }
  }, [taskId, enabled, pollIntervalMs])

  return { snapshot, isLoading, error }
}
