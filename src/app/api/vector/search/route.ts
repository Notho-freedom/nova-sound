/**
 * Vector Search API
 * 
 * Semantic search for tracks, documentation, etc.
 * 
 * GET /api/vector/search?q=energetic rock song&limit=10
 */

import { NextRequest, NextResponse } from "next/server";
import { vectorHelpers } from "@/lib/vector-helpers";
import * as Sentry from "@sentry/nextjs";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");
    const limitParam = searchParams.get("limit");
    const typeParam = searchParams.get("type") || "track";

    if (!query) {
      return NextResponse.json(
        { error: "Missing query parameter 'q'" },
        { status: 400 }
      );
    }

    const limit = limitParam ? parseInt(limitParam, 10) : 10;

    let results;

    if (typeParam === "track") {
      // Search tracks
      results = await vectorHelpers.searchTracks(query, limit);
    } else if (typeParam === "documentation") {
      // Search documentation
      const context = await vectorHelpers.getRAGContext(query, limit);
      results = { context };
    } else {
      return NextResponse.json(
        { error: "Invalid type parameter" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      query,
      type: typeParam,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Vector Search] Error:", message);
    Sentry.captureException(error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
