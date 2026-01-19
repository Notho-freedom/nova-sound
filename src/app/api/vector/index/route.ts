/**
 * Vector Index API
 * 
 * Index tracks or documentation into vector database
 * 
 * POST /api/vector/index
 * Body: {
 *   type: "track" | "documentation",
 *   data: Track[] | Doc[]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { vectorHelpers } from "@/lib/vector-helpers";
import * as Sentry from "@sentry/nextjs";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json(
        { error: "Missing type or data" },
        { status: 400 }
      );
    }

    if (!Array.isArray(data)) {
      return NextResponse.json(
        { error: "Data must be an array" },
        { status: 400 }
      );
    }

    let indexed = 0;

    if (type === "track") {
      await vectorHelpers.indexTracks(data);
      indexed = data.length;
    } else if (type === "documentation") {
      await vectorHelpers.indexDocumentation(data);
      indexed = data.length;
    } else {
      return NextResponse.json(
        { error: "Invalid type parameter" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      type,
      indexed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Vector Index] Error:", message);
    Sentry.captureException(error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Delete vectors
 * 
 * DELETE /api/vector/index?ids=track-123,track-456
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get("ids");

    if (!idsParam) {
      return NextResponse.json(
        { error: "Missing ids parameter" },
        { status: 400 }
      );
    }

    const ids = idsParam.split(",").map((id) => id.trim());

    await vectorHelpers.deleteTrackVectors(ids);

    return NextResponse.json({
      success: true,
      deleted: ids.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Vector Delete] Error:", message);
    Sentry.captureException(error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
