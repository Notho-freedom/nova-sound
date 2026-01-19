/**
 * Upstash Workflow Integration (Ready for activation)
 * 
 * Workflow = Persistent multi-step processes
 * 
 * Use cases:
 *   - User onboarding flows
 *   - YouTube recovery pipelines
 *   - File processing workflows
 *   - Payment processing
 *   - Multi-step AI operations
 * 
 * Benefits:
 *   - State persists across steps
 *   - Automatic retry per step
 *   - Can pause/resume workflows
 *   - No worker process needed
 *   - Built on QStash + Redis
 */

import { qstash } from "@/lib/qstash-helpers";
import { redis } from "@/lib/redis";

const baseUrl =
  process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";

/**
 * Workflow configuration
 */
export const workflowConfig = {
  enabled: true, // Workflows use QStash + Redis (already configured)
  baseUrl,
};

/**
 * Start user onboarding workflow
 * 
 * Usage:
 *   const workflowId = await workflows.startOnboarding({
 *     userId: "123",
 *     email: "user@example.com",
 *     name: "John Doe"
 *   });
 */
export async function startOnboarding(params: {
  userId: string;
  email: string;
  name: string;
  signupSource?: string;
}): Promise<string> {
  const response = await fetch(`${baseUrl}/api/workflows/onboarding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Onboarding workflow failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.userId;
}

/**
 * Start YouTube recovery workflow
 * 
 * Usage:
 *   const workflowId = await workflows.startYouTubeRecovery({
 *     trackIds: ["123", "456"],
 *     userId: "user-123"
 *   });
 */
export async function startYouTubeRecovery(params: {
  trackIds: string[];
  userId: string;
  priority?: "low" | "normal" | "high";
}): Promise<string> {
  const response = await fetch(`${baseUrl}/api/workflows/youtube-recovery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`YouTube recovery workflow failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.workflowId;
}

/**
 * Get workflow status
 * 
 * Usage:
 *   const status = await workflows.getStatus("youtube-recovery", "workflow-123");
 */
export async function getWorkflowStatus(
  workflowType: string,
  workflowId: string
): Promise<Record<string, unknown>> {
  const response = await fetch(
    `${baseUrl}/api/workflows/${workflowType}?workflowId=${workflowId}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`Get workflow status failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Cancel workflow
 * 
 * Usage:
 *   await workflows.cancel("youtube-recovery", "workflow-123");
 */
export async function cancelWorkflow(
  workflowType: string,
  workflowId: string
): Promise<void> {
  // Delete workflow state from Redis
  if (redis) {
    await redis.del(`workflow:${workflowType}:${workflowId}`);
  }
  console.log(`[Workflow] Cancelled: ${workflowType}/${workflowId}`);
}

/**
 * List active workflows for a user
 * 
 * Usage:
 *   const workflows = await listUserWorkflows("user-123");
 */
export async function listUserWorkflows(
  userId: string
): Promise<Array<{ type: string; id: string; state: Record<string, unknown> }>> {
  // TODO: Implement workflow listing via Redis scan
  // For now, return empty array
  return [];
}

/**
 * Workflow helpers
 */
export const workflows = {
  startOnboarding,
  startYouTubeRecovery,
  getStatus: getWorkflowStatus,
  cancel: cancelWorkflow,
  listUserWorkflows,
};

/**
 * Workflow patterns available
 */
export const workflowPatterns = {
  /**
   * Onboarding: Create user → Wait → Send emails → Check upgrade
   */
  onboarding: {
    path: "app/api/workflows/onboarding/route.ts",
    steps: ["welcome", "tips", "check-pro"],
    duration: "7 days",
  },

  /**
   * YouTube Recovery: Validate → Fetch → Download → Process → Store → Notify
   */
  youtubeRecovery: {
    path: "app/api/workflows/youtube-recovery/route.ts",
    steps: ["validate", "fetch", "download", "process", "store", "notify"],
    duration: "Variable (depends on track count)",
  },

  /**
   * File Import: Upload → Scan → Extract metadata → Process → Store
   */
  fileImport: {
    path: "app/api/workflows/file-import/route.ts",
    steps: ["upload", "scan", "extract", "process", "store"],
    duration: "Variable (depends on file size)",
  },
};
