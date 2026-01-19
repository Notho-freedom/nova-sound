/**
 * User Onboarding Workflow
 * 
 * Flow:
 *   1. Create user record
 *   2. Wait 2 minutes (let them explore)
 *   3. Send welcome email
 *   4. Wait 1 day
 *   5. Send tips & tricks email
 *   6. Wait 7 days
 *   7. Check if they upgraded to Pro
 *   8. Send upgrade reminder if not Pro
 * 
 * Benefits:
 *   - State persists across steps
 *   - Automatic retry on failure
 *   - Can pause/resume workflow
 *   - No worker process needed
 */

import { NextRequest, NextResponse } from "next/server";
import { qstash } from "@/lib/qstash-helpers";
import { redis } from "@/lib/redis";
import * as Sentry from "@sentry/nextjs";

export const runtime = "edge";

type OnboardingPayload = {
  userId: string;
  email: string;
  name: string;
  signupSource?: string;
};

type WorkflowState = {
  userId: string;
  email: string;
  name: string;
  welcomeEmailSent: boolean;
  tipsEmailSent: boolean;
  upgradeReminderSent: boolean;
  isPro: boolean;
  completedAt?: number;
};

export async function POST(req: NextRequest) {
  try {
    const body: OnboardingPayload = await req.json();
    const { userId, email, name } = body;

    if (!userId || !email) {
      return NextResponse.json(
        { error: "Missing userId or email" },
        { status: 400 }
      );
    }

    // Initialize workflow state
    const state: WorkflowState = {
      userId,
      email,
      name,
      welcomeEmailSent: false,
      tipsEmailSent: false,
      upgradeReminderSent: false,
      isPro: false,
    };

    // Store initial state
    await redis.set(
      `workflow:onboarding:${userId}`,
      JSON.stringify(state),
      { ex: 604800 } // 7 days
    );

    // Step 1: Send welcome email after 2 minutes
    await qstash.task.publishDelayed(
      "onboarding-welcome",
      { userId, email, name },
      120 // 2 minutes
    );

    // Step 2: Send tips email after 1 day
    await qstash.task.publishDelayed(
      "onboarding-tips",
      { userId, email, name },
      86400 // 1 day
    );

    // Step 3: Check Pro status after 7 days
    await qstash.task.publishDelayed(
      "onboarding-check-pro",
      { userId, email, name },
      604800 // 7 days
    );

    console.log(`[Onboarding] Workflow started for user: ${userId}`);

    return NextResponse.json({
      success: true,
      userId,
      message: "Onboarding workflow initiated",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Onboarding] Error:", message);
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
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      );
    }

    const stateRaw = await redis.get(`workflow:onboarding:${userId}`);
    if (!stateRaw) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    const state: WorkflowState = JSON.parse(stateRaw as string);

    return NextResponse.json({
      success: true,
      state,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Onboarding] Error getting status:", message);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
