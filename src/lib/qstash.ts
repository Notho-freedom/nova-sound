/**
 * Upstash QStash Integration (Ready for activation)
 * 
 * QStash = Message Queue + Scheduler + Retry engine (serverless)
 * 
 * Use cases:
 *   - Email delivery
 *   - Webhooks with automatic retry
 *   - Scheduled tasks
 *   - Fan-out events
 *   - Delayed processing
 * 
 * To enable:
 *   1. Get QSTASH_TOKEN from Upstash console
 *   2. Add to Vercel environment variables
 *   3. Create callback routes (examples below)
 */

import { Client as QStashClient } from "@upstash/qstash";

// Initialize QStash (will fail gracefully if token not set)
const getQStash = () => {
  if (!process.env.QSTASH_TOKEN) {
    console.warn("[QStash] Token not configured - functionality disabled");
    return null;
  }
  return new QStashClient({ token: process.env.QSTASH_TOKEN });
};

/**
 * Publish a message to QStash
 * 
 * @param callbackUrl - The endpoint that will receive the message
 * @param payload - The data to send
 * @param options - delay, retry, headers, etc.
 */
export async function publishMessage<T extends Record<string, any>>(
  callbackUrl: string,
  payload: T,
  options?: {
    delay?: number; // seconds
    retries?: number;
    headers?: Record<string, string>;
  }
) {
  // Skip QStash for localhost (development) - QStash blocks loopback addresses
  if (callbackUrl.includes("localhost") || callbackUrl.includes("127.0.0.1") || callbackUrl.includes("::1")) {
    console.warn("[QStash] Skipping localhost URL in development mode");
    return { id: "dev-mock", url: callbackUrl };
  }

  const qstash = getQStash();
  if (!qstash) {
    console.warn("[QStash] Not configured - message not published");
    return null;
  }

  try {
    const result = await qstash.publish({
      url: callbackUrl,
      body: JSON.stringify(payload),
      delay: options?.delay,
      retries: options?.retries ?? 3,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    console.log("[QStash] Message published:", result);
    return result;
  } catch (error) {
    console.error("[QStash] Publish failed:", error);
    throw error;
  }
}

/**
 * Schedule a cron job
 * 
 * @param callbackUrl - The endpoint to call
 * @param cronExpression - cron format (e.g., "0 3 * * *" = 3am daily)
 * @param payload - optional data to send
 */
export async function scheduleCronJob<T extends Record<string, any>>(
  callbackUrl: string,
  cronExpression: string,
  payload?: T
) {
  const qstash = getQStash();
  if (!qstash) {
    console.warn("[QStash] Not configured - cron job not scheduled");
    return null;
  }

  try {
    const result = await qstash.publish({
      url: callbackUrl,
      cron: cronExpression,
      body: JSON.stringify(payload || {}),
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("[QStash] Cron job scheduled:", result);
    return result;
  } catch (error) {
    console.error("[QStash] Schedule failed:", error);
    throw error;
  }
}

/**
 * Middleware to verify QStash signatures
 * Use this in your callback routes to ensure messages are legitimate
 */
export function verifyQStashSignature(req: any): boolean {
  const signature = req.headers.get("upstash-signature") || 
                   req.headers.get("authorization")?.replace("Bearer ", "");
  
  if (!signature) {
    console.warn("[QStash] No signature provided");
    return false;
  }

  // Actual verification should use QSTASH_CURRENT_SIGNING_KEY
  // This is a placeholder - implement full verification in production
  return !!signature;
}

/**
 * Example callback route (use this pattern for your endpoints)
 * 
 * Place in app/api/qstash/[endpoint]/route.ts
 * 
 * export async function POST(req: NextRequest) {
 *   // Verify signature
 *   if (!verifyQStashSignature(req)) {
 *     return new Response("Unauthorized", { status: 401 });
 *   }
 *   
 *   const data = await req.json();
 *   
 *   try {
 *     // Do your work
 *     await doWork(data);
 *     return new Response("OK", { status: 200 });
 *   } catch (error) {
 *     // Return 5xx to trigger retry
 *     return new Response("Error", { status: 500 });
 *   }
 * }
 */

export const qstashConfig = {
  enabled: !!process.env.QSTASH_TOKEN,
  token: process.env.QSTASH_TOKEN || "not-configured",
  baseUrl: process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000",
};
