/**
 * QStash Usage Examples
 * 
 * Copy-paste examples for common QStash patterns
 */

import { qstash } from "@/lib/qstash-helpers";
import { publishTaskSmart } from "@/lib/event-bus-hybrid";

/**
 * Example 1: Send welcome email after user signup
 */
export async function sendWelcomeEmail(userEmail: string, userName: string) {
  await qstash.email.send({
    to: userEmail,
    subject: `Welcome to Nova Sound, ${userName}!`,
    body: "Thanks for signing up...",
    template: "welcome",
  });
}

/**
 * Example 2: Notify external service via webhook
 */
export async function notifyWebhook(event: string, data: Record<string, unknown>) {
  await qstash.webhook.deliver({
    url: "https://api.example.com/webhooks/nova-sound",
    body: {
      event,
      data,
      timestamp: Date.now(),
    },
    retries: 5, // Retry 5 times on failure
  });
}

/**
 * Example 3: Schedule daily cleanup (setup once)
 */
export async function setupDailyCleanup() {
  await qstash.schedule.daily("daily-cleanup", {
    daysToKeep: 30,
  });
}

/**
 * Example 4: Process YouTube recovery with retry
 */
export async function recoverYouTubeTracks(trackIds: string[]) {
  // Auto-routed to QStash because task type matches rules
  const envelope = await publishTaskSmart("youtube-recovery", {
    trackIds,
  });

  return envelope.id; // Use this to poll status
}

/**
 * Example 5: Import library with delay (wait for upload)
 */
export async function importLibraryDelayed(uploadId: string) {
  await qstash.task.publishDelayed(
    "import-library",
    { uploadId, scan: true },
    300 // Wait 5 minutes for upload to complete
  );
}

/**
 * Example 6: Send notification immediately (Redis Streams)
 */
export async function sendNotification(userId: string, message: string) {
  // Auto-routed to Redis Streams for real-time delivery
  await publishTaskSmart("notification", {
    userId,
    message,
    timestamp: Date.now(),
  });
}

/**
 * Example 7: Custom scheduled task (every 6 hours)
 */
export async function setupStatsAggregation() {
  await qstash.schedule.custom(
    "stats-aggregation",
    "0 */6 * * *", // Every 6 hours
    {
      includeDeleted: false,
    }
  );
}

/**
 * Example 8: Batch email sending with individual retry
 */
export async function sendBatchEmails(
  recipients: Array<{ email: string; name: string }>
) {
  const promises = recipients.map((recipient) =>
    qstash.email.send({
      to: recipient.email,
      subject: `Hello ${recipient.name}`,
      body: "Your content here",
    })
  );

  // All emails sent independently with retry
  await Promise.allSettled(promises);
}

/**
 * Example 9: Manual routing (force QStash)
 */
export async function sendCriticalTask<T>(taskType: string, payload: T) {
  await qstash.task.publish(taskType, payload, {
    retries: 10, // Max retries for critical tasks
  });
}

/**
 * Example 10: Chain tasks with delays
 */
export async function chainedWorkflow(userId: string) {
  // Step 1: Send welcome email (immediate)
  await qstash.email.send({
    to: "user@example.com",
    subject: "Welcome!",
    body: "Step 1",
  });

  // Step 2: Send reminder (1 hour later)
  await qstash.task.publishDelayed(
    "email-send",
    {
      to: "user@example.com",
      subject: "Reminder",
      body: "Step 2",
    },
    3600 // 1 hour delay
  );

  // Step 3: Send follow-up (1 day later)
  await qstash.task.publishDelayed(
    "email-send",
    {
      to: "user@example.com",
      subject: "Follow-up",
      body: "Step 3",
    },
    86400 // 1 day delay
  );
}
