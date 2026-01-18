/**
 * Upstash Workflow Integration (Ready for activation)
 * 
 * Workflow = Temporal-lite (serverless)
 * 
 * Use cases:
 *   - Multi-step processes
 *   - Onboarding flows
 *   - AI pipelines
 *   - Long-running operations
 *   - State persistence
 * 
 * To enable:
 *   1. Get WORKFLOW_CLIENT from Upstash console
 *   2. Add to Vercel environment variables
 *   3. Create workflow handlers in app/api/workflows/
 * 
 * Pattern:
 *   - Define steps declaratively
 *   - Upstash handles retries, state, resumption
 *   - No worker process needed
 */

/**
 * Example Workflow Pattern
 * 
 * Place in app/api/workflows/onboarding/route.ts
 * 
 * import { serve } from "@upstash/workflow/nextjs";
 * import { redis } from "@/lib/redis";
 * 
 * export const POST = serve<{ userId: string; email: string }>(
 *   async (context) => {
 *     const data = context.requestPayload;
 * 
 *     // Step 1: Create user
 *     const user = await context.run("create-user", async () => {
 *       return await db.user.create({ email: data.email });
 *     });
 * 
 *     // Step 2: Wait 60 seconds
 *     await context.sleep("wait-confirmation", 60);
 * 
 *     // Step 3: Send welcome email
 *     const emailSent = await context.run("send-email", async () => {
 *       return await sendWelcome(user.email);
 *     });
 * 
 *     // Step 4: Store in Redis
 *     await context.run("store-workflow", async () => {
 *       await redis.set(`workflow:onboarding:${user.id}`, {
 *         userId: user.id,
 *         emailSent,
 *         completedAt: new Date(),
 *       }, 86400);
 *     });
 * 
 *     return { success: true, userId: user.id };
 *   }
 * );
 */

export const workflowConfig = {
  enabled: !!process.env.WORKFLOW_CLIENT,
  baseUrl: process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000",
};

/**
 * Helper to trigger a workflow
 * 
 * Usage:
 *   await triggerWorkflow("onboarding", { userId: "123", email: "test@example.com" })
 */
export async function triggerWorkflow<T extends Record<string, any>>(
  workflowName: string,
  payload: T
): Promise<string | null> {
  if (!workflowConfig.enabled) {
    console.warn("[Workflow] Not configured");
    return null;
  }

  try {
    const url = `${workflowConfig.baseUrl}/api/workflows/${workflowName}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Workflow trigger failed: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[Workflow] ${workflowName} triggered:`, data);
    return data.id || null;
  } catch (error) {
    console.error(`[Workflow] Error triggering ${workflowName}:`, error);
    throw error;
  }
}

/**
 * Workflow patterns to implement
 */
export const workflowPatterns = {
  /**
   * Onboarding: Create user → Wait → Send email → Store
   */
  onboarding: "app/api/workflows/onboarding/route.ts",

  /**
   * AI Pipeline: Validate → Process → Generate → Store → Notify
   */
  aiPipeline: "app/api/workflows/ai-pipeline/route.ts",

  /**
   * Cleanup: Run every day, delete old data
   */
  dailyCleanup: "app/api/workflows/cleanup/route.ts",
};
