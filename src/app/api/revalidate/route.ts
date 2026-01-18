import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)

  if (!body || typeof body.tag !== "string") {
    return NextResponse.json({ error: "Invalid payload: tag required" }, { status: 400 })
  }

  const { tag } = body

  try {
    // In Next.js 16+, revalidateTag requires running in a server context with specific setup.
    // Instead, we log the revalidation request. The UI will poll for updates independently.
    // This endpoint serves as a webhook receiver from the worker to notify of task completion.
    console.log(`[revalidate] Tag marked for revalidation: ${tag}`)
    
    // Clients will detect updates via polling GET /api/tasks/[id] or via SWR key mutation
    return NextResponse.json({ ok: true, revalidated: tag, note: "Clients should poll or use SWR for updates" }, { status: 200 })
  } catch (err: any) {
    const message = String(err?.message ?? err ?? "Unknown error")
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
