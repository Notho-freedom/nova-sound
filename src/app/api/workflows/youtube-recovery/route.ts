/**
 * YouTube Recovery Workflow
 * 
 * Complex multi-step process:
 *   1. Validate track IDs
 *   2. Fetch metadata from YouTube API
 *   3. Download audio streams
 *   4. Process audio (normalize, convert)
 *   5. Extract metadata (title, artist, thumbnail)
 *   6. Store in library
 *   7. Update cache
 *   8. Notify user
 * 
 * Benefits:
 *   - Each step can retry independently
 *   - State persists between steps
 *   - Can handle large batches
 *   - Automatic failure recovery
 */

import { NextRequest, NextResponse } from "next/server";
import { qstash } from "@/lib/qstash-helpers";
import { redis } from "@/lib/redis";
import * as Sentry from "@sentry/nextjs";

export const runtime = "edge";

type YouTubeRecoveryPayload = {
  trackIds: string[];
  userId: string;
  priority?: "low" | "normal" | "high";
};

type RecoveryState = {
  trackIds: string[];
  userId: string;
  totalTracks: number;
  processedTracks: number;
  recoveredTracks: number;
  failedTracks: number;
  startedAt: number;
  completedAt?: number;
  status: "queued" | "processing" | "completed" | "failed";
  steps: {
    validate?: boolean;
    fetch?: boolean;
    download?: boolean;
    process?: boolean;
    store?: boolean;
    notify?: boolean;
  };
};

export async function POST(req: NextRequest) {
  try {
    const body: YouTubeRecoveryPayload = await req.json();
    const { trackIds, userId, priority = "normal" } = body;

    if (!trackIds || trackIds.length === 0) {
      return NextResponse.json(
        { error: "Missing trackIds" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      );
    }

    const workflowId = `youtube-recovery-${Date.now()}-${userId}`;

    // Initialize workflow state
    const state: RecoveryState = {
      trackIds,
      userId,
      totalTracks: trackIds.length,
      processedTracks: 0,
      recoveredTracks: 0,
      failedTracks: 0,
      startedAt: Date.now(),
      status: "queued",
      steps: {},
    };

    // Store state
    await redis.set(
      `workflow:youtube-recovery:${workflowId}`,
      JSON.stringify(state),
      86400 // 24 hours
    );

    // Start workflow steps with QStash
    // Step 1: Validate track IDs
    await qstash.task.publish("youtube-validate", {
      workflowId,
      trackIds,
      userId,
    });

    console.log(`[YouTube Recovery] Workflow started: ${workflowId}`);

    return NextResponse.json({
      success: true,
      workflowId,
      totalTracks: trackIds.length,
      message: "YouTube recovery workflow initiated",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[YouTube Recovery] Error:", message);
    Sentry.captureException(error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Get workflow status
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workflowId = searchParams.get("workflowId");

    if (!workflowId) {
      return NextResponse.json(
        { error: "Missing workflowId" },
        { status: 400 }
      );
    }

    const stateRaw = await redis.get(`workflow:youtube-recovery:${workflowId}`);
    if (!stateRaw) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    const state: RecoveryState = JSON.parse(stateRaw as string);

    // Calculate progress
    const progress = Math.round(
      (state.processedTracks / state.totalTracks) * 100
    );

    return NextResponse.json({
      success: true,
      state,
      progress,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[YouTube Recovery] Error getting status:", message);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
