/**
 * Vector RAG API
 * 
 * Retrieval Augmented Generation for SkyOS assistant
 * 
 * POST /api/vector/rag
 * Body: {
 *   query: "How do I add tracks?",
 *   topK: 5
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { vectorHelpers } from "@/lib/vector-helpers";
import * as Sentry from "@sentry/nextjs";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, topK = 5 } = body;

    if (!query) {
      return NextResponse.json(
        { error: "Missing query" },
        { status: 400 }
      );
    }

    // Get context from vector search
    const context = await vectorHelpers.getRAGContext(query, topK);

    // TODO: Send to LLM for response generation
    // For now, just return context

    return NextResponse.json({
      success: true,
      query,
      context,
      message: "Context retrieved. Integrate with LLM for response generation.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Vector RAG] Error:", message);
    Sentry.captureException(error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
