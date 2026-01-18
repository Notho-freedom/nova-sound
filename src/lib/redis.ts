/**
 * Upstash Redis Client (Vercel-optimized)
 * 
 * Pattern officiel Vercel + Upstash:
 * - Redis.fromEnv() charge automatiquement les variables d'env
 * - Edge-compatible
 * - Serverless-ready
 * 
 * Variables requises:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */

import { Redis } from "@upstash/redis";

export const redis = Redis.fromEnv();

/**
 * Health check - vérifie la connexion Redis
 */
export async function redisHealthCheck(): Promise<boolean> {
  try {
    await redis.set("_health", "ok", { ex: 10 });
    const result = await redis.get("_health");
    return result === "ok";
  } catch (error) {
    console.error("[Redis] Health check failed:", error);
    return false;
  }
}

/**
 * Type-safe queue helpers
 */
export const queues = {
  /**
   * Push job to queue
   */
  async push<T>(queueName: string, job: T): Promise<void> {
    await redis.lpush(`queue:${queueName}`, JSON.stringify(job));
  },

  /**
   * Pop job from queue (non-blocking)
   */
  async pop<T>(queueName: string): Promise<T | null> {
    const result = await redis.rpop(`queue:${queueName}`);
    return result ? (JSON.parse(result as string) as T) : null;
  },

  /**
   * Blocking pop (for workers)
   */
  async bpop<T>(queueName: string, timeout: number = 0): Promise<T | null> {
    const result = await redis.brpop(`queue:${queueName}`, timeout);
    return result ? (JSON.parse(result[1] as string) as T) : null;
  },
};

/**
 * Job snapshot helpers
 */
export const jobs = {
  /**
   * Store job snapshot
   */
  async snapshot<T extends Record<string, any>>(
    jobId: string,
    data: T,
    ttlSeconds: number = 3600
  ): Promise<void> {
    await redis.setex(`job:${jobId}`, ttlSeconds, JSON.stringify(data));
  },

  /**
   * Get job snapshot
   */
  async get<T extends Record<string, any>>(jobId: string): Promise<T | null> {
    const data = await redis.get(`job:${jobId}`);
    return data ? (JSON.parse(data as string) as T) : null;
  },

  /**
   * Update job progress
   */
  async progress(jobId: string, progress: number): Promise<void> {
    const job = await jobs.get(jobId);
    if (job) {
      await jobs.snapshot(jobId, { ...job, progress });
    }
  },

  /**
   * Mark job as done
   */
  async done<T extends Record<string, any>>(
    jobId: string,
    result: T
  ): Promise<void> {
    const job = await jobs.get(jobId);
    if (job) {
      await jobs.snapshot(jobId, { ...job, status: "done", result }, 86400); // 24h
    }
  },

  /**
   * Mark job as failed
   */
  async failed(jobId: string, error: string): Promise<void> {
    const job = await jobs.get(jobId);
    if (job) {
      await jobs.snapshot(jobId, { ...job, status: "failed", error }, 86400);
    }
  },
};

/**
 * Cache helpers (simple key-value)
 */
export const cache = {
  /**
   * Set cache with TTL
   */
  async set<T>(key: string, value: T, ttlSeconds: number = 3600): Promise<void> {
    await redis.setex(`cache:${key}`, ttlSeconds, JSON.stringify(value));
  },

  /**
   * Get cache
   */
  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(`cache:${key}`);
    return data ? (JSON.parse(data as string) as T) : null;
  },

  /**
   * Delete cache
   */
  async delete(key: string): Promise<void> {
    await redis.del(`cache:${key}`);
  },

  /**
   * Clear all cache with prefix
   */
  async clearPattern(pattern: string): Promise<void> {
    // Note: KEYS * is bad, but for dev/admin only
    const keys = await redis.keys(`cache:${pattern}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  },
};
