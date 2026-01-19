import { NextRequest, NextResponse } from "next/server";
import { qstash } from "@/lib/qstash-helpers";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, type, data, delaySeconds = 2 } = body ?? {};

    if (!userId || !type) {
      return NextResponse.json({ error: "Missing userId or type" }, { status: 400 });
    }

    await qstash.task.publishDelayed(
      "sync-deferred",
      { userId, type, data },
      Math.max(1, Number(delaySeconds))
    );

    return NextResponse.json({ scheduled: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[QStash Sync Deferred] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
