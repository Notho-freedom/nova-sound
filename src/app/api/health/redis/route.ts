/**
 * Redis Health Check Endpoint
 * 
 * Usage:
 *   GET /api/health/redis
 * 
 * Response:
 *   { status: "ok" | "error", timestamp, latency }
 */

import { NextRequest, NextResponse } from "next/server";
import { redisHealthCheck } from "@/lib/redis";

export async function GET(request: NextRequest) {
  const startTime = performance.now();

  try {
    const isHealthy = await redisHealthCheck();
    const latency = performance.now() - startTime;

    if (!isHealthy) {
      return NextResponse.json(
        {
          status: "error",
          message: "Redis health check failed",
          timestamp: new Date().toISOString(),
          latency: `${latency.toFixed(2)}ms`,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: "ok",
      message: "Redis is connected and healthy",
      timestamp: new Date().toISOString(),
      latency: `${latency.toFixed(2)}ms`,
      redis: {
        url: process.env.UPSTASH_REDIS_REST_URL?.split("://")[1]?.split(".")[0] + "...",
        configured: !!process.env.UPSTASH_REDIS_REST_URL,
      },
    });
  } catch (error) {
    const latency = performance.now() - startTime;
    console.error("[Redis Health Check] Error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        latency: `${latency.toFixed(2)}ms`,
      },
      { status: 503 }
    );
  }
}
