/**
 * QStash Helpers: Simplified API for common patterns
 * 
 * Usage examples:
 * 
 *   // Send email with retry
 *   await qstash.email.send({
 *     to: "user@example.com",
 *     subject: "Welcome!",
 *     body: "Hello world"
 *   });
 * 
 *   // Schedule daily cleanup
 *   await qstash.schedule.daily("daily-cleanup", {});
 * 
 *   // Send webhook with retry
 *   await qstash.webhook.deliver({
 *     url: "https://api.example.com/webhook",
 *     body: { event: "user.created" }
 *   });
 */

import { publishMessage, scheduleCronJob } from "@/lib/qstash";

const baseUrl =
  process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";

/**
 * Email helpers
 */
export const email = {
  /**
   * Send email with automatic retry
   */
  async send(params: {
    to: string;
    subject: string;
    body: string;
    template?: string;
    retries?: number;
  }) {
    return publishMessage(
      `${baseUrl}/api/qstash/tasks`,
      {
        taskId: crypto.randomUUID(),
        type: "email-send",
        payload: params,
      },
      {
        retries: params.retries ?? 3,
      }
    );
  },
};

/**
 * Webhook helpers
 */
export const webhook = {
  /**
   * Deliver webhook with automatic retry
   */
  async deliver(params: {
    url: string;
    method?: string;
    body: Record<string, unknown>;
    headers?: Record<string, string>;
    retries?: number;
  }) {
    return publishMessage(
      `${baseUrl}/api/qstash/tasks`,
      {
        taskId: crypto.randomUUID(),
        type: "webhook-delivery",
        payload: params,
      },
      {
        retries: params.retries ?? 5, // Webhooks need more retries
      }
    );
  },
};

/**
 * Scheduled tasks helpers
 */
export const schedule = {
  /**
   * Schedule daily task (runs at midnight UTC)
   */
  async daily(taskType: string, payload: Record<string, unknown>) {
    return scheduleCronJob(
      `${baseUrl}/api/qstash/scheduled`,
      "0 0 * * *", // Midnight UTC
      { task: taskType, payload }
    );
  },

  /**
   * Schedule hourly task
   */
  async hourly(taskType: string, payload: Record<string, unknown>) {
    return scheduleCronJob(
      `${baseUrl}/api/qstash/scheduled`,
      "0 * * * *", // Every hour
      { task: taskType, payload }
    );
  },

  /**
   * Schedule weekly task (Sunday midnight UTC)
   */
  async weekly(taskType: string, payload: Record<string, unknown>) {
    return scheduleCronJob(
      `${baseUrl}/api/qstash/scheduled`,
      "0 0 * * 0", // Sunday midnight
      { task: taskType, payload }
    );
  },

  /**
   * Custom cron schedule
   */
  async custom(
    taskType: string,
    cronExpression: string,
    payload: Record<string, unknown>
  ) {
    return scheduleCronJob(`${baseUrl}/api/qstash/scheduled`, cronExpression, {
      task: taskType,
      payload,
    });
  },
};

/**
 * Task helpers
 */
export const task = {
  /**
   * Publish task with retry (generic)
   */
  async publish<T>(
    taskType: string,
    payload: T,
    options?: { retries?: number; delay?: number }
  ) {
    return publishMessage(
      `${baseUrl}/api/qstash/tasks`,
      {
        taskId: crypto.randomUUID(),
        type: taskType,
        payload,
      },
      options
    );
  },

  /**
   * Publish task with delay
   */
  async publishDelayed<T>(
    taskType: string,
    payload: T,
    delaySeconds: number
  ) {
    return this.publish(taskType, payload, { delay: delaySeconds });
  },
};

/**
 * Export all helpers
 */
export const qstash = {
  email,
  webhook,
  schedule,
  task,
};
