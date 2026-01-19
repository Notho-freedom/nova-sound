/**
 * Vector Stats API
 * 
 * Get vector index statistics
 * 
 * GET /api/vector/stats
 */

import { NextRequest, NextResponse } from "next/server";
import { vectorHelpers } from "@/lib/vector-helpers";
import { vectorConfig } from "@/lib/vector";
import * as Sentry from "@sentry/nextjs";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  try {
    if (!vectorConfig.enabled) {
      return NextResponse.json({
        enabled: false,
        message: "Vector not configured",
      });
    }

    const stats = await vectorHelpers.getIndexStats();

    return NextResponse.json({
      enabled: true,
      ...stats,
      config: {
        embeddingModel: vectorConfig.embeddingModel,
        dimension: vectorConfig.dimension,
        topK: vectorConfig.topK,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Vector Stats] Error:", message);
    Sentry.captureException(error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
