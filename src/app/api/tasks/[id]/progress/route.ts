import { NextRequest } from "next/server"
import { getTaskSnapshot } from "@/lib/task-store"

export const runtime = "edge"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  const controller = new AbortController()

  // Close SSE after 5 minutes
  const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000)

  const encoder = new TextEncoder()
  let isClosed = false

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send initial message
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected", taskId: id })}\n\n`))

        // Poll task status every 500ms
        const pollInterval = setInterval(async () => {
          if (isClosed) {
            clearInterval(pollInterval)
            controller.close()
            return
          }

          try {
            const snapshot = await getTaskSnapshot(id)

            if (!snapshot) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "not-found" })}\n\n`))
              clearInterval(pollInterval)
              controller.close()
              return
            }

            // Send progress update
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "progress",
                  status: snapshot.status,
                  progress: snapshot.progress,
                  updatedAt: snapshot.updatedAt,
                  error: snapshot.error,
                })}\n\n`
              )
            )

            // Close when done
            if (snapshot.status === "done" || snapshot.status === "failed") {
              clearInterval(pollInterval)
              controller.close()
            }
          } catch (err) {
            console.error(`[SSE] Error polling task ${id}:`, err)
            clearInterval(pollInterval)
            controller.close()
          }
        }, 500)

        req.signal.addEventListener("abort", () => {
          isClosed = true
          clearInterval(pollInterval)
          clearTimeout(timeout)
        })
      } catch (err) {
        console.error(`[SSE] Error starting stream for task ${id}:`, err)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
