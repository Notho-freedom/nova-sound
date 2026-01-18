/**
 * API endpoint for cache management
 * Allows users to view, invalidate, and stats on their cache
 */

import { NextRequest, NextResponse } from "next/server";
import {
  statsCache,
  genresCache,
  libraryScanCache,
  metadataCache,
  searchCache,
  getCacheStats,
  clearAllCaches,
} from "@/lib/upstash-cache";

/**
 * GET /api/cache - Get cache statistics
 * GET /api/cache?action=clear - Clear all caches
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const userId = searchParams.get("userId") || null;

    // Get cache stats
    if (action === "stats") {
      const stats = await getCacheStats(userId);
      return NextResponse.json({
        success: true,
        stats,
      });
    }

    // Clear all caches
    if (action === "clear") {
      const result = await clearAllCaches(userId);
      return NextResponse.json({
        success: result,
        message: result
          ? "✅ All caches cleared"
          : "❌ Failed to clear caches",
      });
    }

    // Default: return cache stats
    const stats = await getCacheStats(userId);
    return NextResponse.json({
      success: true,
      stats,
      endpoints: {
        stats: "/api/cache?action=stats",
        clear: "/api/cache?action=clear",
        health: "/api/cache?action=health",
      },
    });
  } catch (err) {
    console.error("[Cache API] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cache - Cache specific data
 * Body: { type: "stats" | "genres" | "metadata", data: {...} }
 */
export async function POST(request: NextRequest) {
  try {
    const { type, data, userId, trackIds, artistName, albumName } = await request.json();

    let result;

    switch (type) {
      case "stats":
        result = await statsCache.set(userId, trackIds || [], data);
        break;

      case "genres":
        result = await genresCache.set(userId, trackIds || [], data);
        break;

      case "metadata":
        if (data.type === "artist") {
          result = await metadataCache.setArtist(artistName, data);
        } else if (data.type === "album") {
          result = await metadataCache.setAlbum(albumName, artistName, data);
        }
        break;

      default:
        return NextResponse.json(
          { success: false, error: "Unknown cache type" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      type,
      message: `✅ Cached ${type}`,
    });
  } catch (err) {
    console.error("[Cache API] Post error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cache - Delete cache entries
 * Query: ?type=stats&userId=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const userId = searchParams.get("userId") || null;

    let result;

    switch (type) {
      case "stats":
        result = await statsCache.invalidate(userId);
        break;

      case "genres":
        result = await genresCache.invalidate(userId);
        break;

      case "all":
        result = await clearAllCaches(userId);
        break;

      default:
        return NextResponse.json(
          { success: false, error: "Unknown cache type" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      type,
      message: `✅ Invalidated ${type}`,
    });
  } catch (err) {
    console.error("[Cache API] Delete error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
