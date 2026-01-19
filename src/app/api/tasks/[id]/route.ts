import { NextRequest, NextResponse } from "next/server"
import { getTaskSnapshot } from "@/lib/task-store"

export const runtime = "edge"
export const revalidate = 0

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const snapshot = await getTaskSnapshot(params.id)
  if (!snapshot) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(snapshot, { status: 200 })
}
