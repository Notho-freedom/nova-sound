/**
 * QStash scheduled tasks endpoint
 * 
 * Use cases:
 *   - Daily cleanup
 *   - Stats aggregation
 *   - Backup operations
 *   - Subscription checks
 * 
 * Setup:
 *   1. Get QSTASH_TOKEN from Upstash console
 *   2. Create cron schedule in Upstash dashboard:
 *      - URL: https://yourdomain.com/api/qstash/scheduled
 *      - Schedule: 0 0 * * * (daily at midnight)
 *      - Body: { "task": "daily-cleanup", "payload": {} }
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyQStashSignature } from "@/lib/qstash";
import { TASK_HANDLERS, defaultHandler } from "@/lib/task-handlers";
import * as Sentry from "@sentry/nextjs";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    // Verify QStash signature
    const isValid = await verifyQStashSignature(req);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = await req.json();
    const { task, payload = {} } = body;

    if (!task) {
      return NextResponse.json({ error: "Missing task" }, { status: 400 });
    }

    console.log(`[QStash Scheduled] Running task: ${task}`);

    // Execute task handler
    const handler = TASK_HANDLERS[task] ?? defaultHandler;
    const result = await handler(payload, {
      id: `scheduled-${Date.now()}`,
      type: task,
      source: "qstash-cron",
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[QStash Scheduled] Error:", message);
    Sentry.captureException(error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
