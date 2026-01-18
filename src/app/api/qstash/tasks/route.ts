/**
 * QStash callback endpoint for task execution
 * 
 * Flow:
 *   1. Client publishes task via QStash
 *   2. QStash calls this endpoint with retry
 *   3. We execute task handler
 *   4. Update task status
 *   5. QStash auto-retries on failure
 * 
 * Benefits vs Redis Streams:
 *   - Automatic retries with exponential backoff
 *   - No worker process needed
 *   - Serverless-friendly
 *   - Built-in DLQ
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyQStashSignature } from "@/lib/qstash";
import { getTaskSnapshot, saveTaskSnapshot } from "@/lib/task-store";
import { publishTaskProgress } from "@/lib/task-progress";
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
    const { taskId, type, payload } = body;

    if (!taskId || !type) {
      return NextResponse.json(
        { error: "Missing taskId or type" },
        { status: 400 }
      );
    }

    // Get task snapshot
    const existing = await getTaskSnapshot(taskId);
    const now = Date.now();

    const base = existing ?? {
      id: taskId,
      type,
      status: "queued" as const,
      createdAt: now,
      updatedAt: now,
      payload,
    };

    // Mark as processing
    await saveTaskSnapshot({ ...base, status: "processing", updatedAt: now });
    await publishTaskProgress({
      taskId,
      status: "processing",
      progress: 0,
      updatedAt: now,
    });

    // Execute task handler
    const handler = TASK_HANDLERS[type] ?? defaultHandler;
    const result = await handler(payload, { id: taskId, type });

    // Mark as done
    await saveTaskSnapshot({
      ...base,
      status: "done",
      result,
      updatedAt: Date.now(),
    });

    await publishTaskProgress({
      taskId,
      status: "done",
      progress: 100,
      message: "Task completed",
      updatedAt: Date.now(),
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[QStash Tasks] Error:", message);
    Sentry.captureException(error);

    // QStash will retry automatically
    return NextResponse.json(
      { error: message },
      { status: 500 } // 5xx triggers retry
    );
  }
}
