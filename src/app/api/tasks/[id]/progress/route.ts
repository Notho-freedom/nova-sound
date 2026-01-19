import { NextRequest } from "next/server"
import { getTaskSnapshot } from "@/lib/task-store"
import { upstashXAck, upstashXGroupCreate, upstashXReadGroup } from "@/lib/upstash"

export const runtime = "edge"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  const timeoutSignal = AbortSignal.timeout(5 * 60 * 1000)

  const encoder = new TextEncoder()
  let isClosed = false

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send initial message
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected", taskId: id })}\n\n`))

        const progressStream = `task-progress:${id}`
        const group = `progress-${id}`
        const consumer = `sse-${crypto.randomUUID()}`

        try {
          await upstashXGroupCreate(progressStream, group, "$", timeoutSignal)
        } catch {
          // Group may already exist
        }

        const initialSnapshot = await getTaskSnapshot(id)
        if (initialSnapshot) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "progress",
                status: initialSnapshot.status,
                progress: initialSnapshot.progress,
                updatedAt: initialSnapshot.updatedAt,
                error: initialSnapshot.error,
              })}\n\n`
            )
          )
        }
        req.signal.addEventListener("abort", () => {
          isClosed = true
        })

        timeoutSignal.addEventListener("abort", () => {
          isClosed = true
        })

        while (!isClosed) {
          const result = await upstashXReadGroup(
            progressStream,
            group,
            consumer,
            { count: 1, blockMs: 30000 },
            timeoutSignal
          )

          if (!result || result.length === 0) {
            continue
          }

          const entries = result[0]?.[1] ?? []
          for (const [entryId, fields] of entries) {
            const payload: Record<string, string> = {}
            for (let i = 0; i < fields.length; i += 2) {
              payload[String(fields[i])] = String(fields[i + 1] ?? "")
            }

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "progress",
                  status: payload.status,
                  progress: payload.progress ? Number(payload.progress) : undefined,
                  updatedAt: payload.updatedAt ? Number(payload.updatedAt) : undefined,
                  message: payload.message || undefined,
                })}\n\n`
              )
            )

            await upstashXAck(progressStream, group, [entryId], timeoutSignal)

            if (payload.status === "done" || payload.status === "failed") {
              isClosed = true
              controller.close()
              return
            }
          }
        }
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
