import { NextRequest, NextResponse } from "next/server";
import { qstash } from "@/lib/qstash-helpers";
import { redis } from "@/lib/redis";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, intervalSeconds = 3600 } = body ?? {};

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const lockKey = `backup:${userId}:loop`;
    const lock = await redis.set(lockKey, "scheduled", {
      ex: Math.max(Number(intervalSeconds) * 2, 7200),
      nx: true,
    });

    if (!lock) {
      return NextResponse.json({ scheduled: false, reason: "already-scheduled" });
    }

    await qstash.task.publishDelayed(
      "backup-snapshot",
      { userId },
      Math.max(60, Number(intervalSeconds))
    );

    return NextResponse.json({ scheduled: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[QStash Schedule Backup] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
