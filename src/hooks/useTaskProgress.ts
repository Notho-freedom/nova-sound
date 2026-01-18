import { useEffect, useState } from "react"

export type TaskProgressMessage = {
  type: "connected" | "progress" | "not-found"
  status?: "queued" | "processing" | "done" | "failed"
  progress?: number
  updatedAt?: number
  error?: string
  taskId?: string
}

export type UseTaskProgressOptions = {
  enabled?: boolean
}

export function useTaskProgress(
  taskId: string | null,
  opts: UseTaskProgressOptions = {}
) {
  const { enabled = true } = opts
  const [status, setStatus] = useState<TaskProgressMessage["status"] | null>(null)
  const [progress, setProgress] = useState<number | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!taskId || !enabled) return

    let eventSource: EventSource | undefined
    let mounted = true

    try {
      eventSource = new EventSource(`/api/tasks/${taskId}/progress`)

      eventSource.addEventListener("open", () => {
        if (mounted) setIsConnected(true)
      })

      eventSource.addEventListener("message", (event) => {
        if (!mounted) return

        try {
          const data = JSON.parse(event.data) as TaskProgressMessage

          if (data.type === "connected") {
            setIsConnected(true)
          } else if (data.type === "progress") {
            setStatus(data.status || null)
            setProgress(data.progress)
            setError(data.error || null)

            // Close stream when done
            if (data.status === "done" || data.status === "failed") {
              if (eventSource) eventSource.close()
            }
          } else if (data.type === "not-found") {
            setError("Task not found")
            if (eventSource) eventSource.close()
          }
        } catch (err) {
          console.error("[useTaskProgress] Error parsing message:", err)
        }
      })

      eventSource.addEventListener("error", () => {
        if (mounted) {
          setIsConnected(false)
          if (eventSource) eventSource.close()
        }
      })
    } catch (err: any) {
      const message = String(err?.message ?? err ?? "Failed to connect")
      if (mounted) {
        setError(message)
        setIsConnected(false)
      }
    }

    return () => {
      mounted = false
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [taskId, enabled])

  return { status, progress, error, isConnected }
}
