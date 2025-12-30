/**
 * Catch-all route for Redis cache API with graceful degradation
 * Handles all /api/cache/redis/* paths with proper abort handling
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { slug?: string[] } }) {
  // Check if request was aborted
  if (req.signal.aborted) {
    return new NextResponse('Client closed request', { status: 499 });
  }

  // Always return 503 if Redis is not configured
  const hasRedisConfig = !!process.env.REDIS_HOST;
  
  return NextResponse.json(
    {
      status: 'unavailable',
      redis: 'not-configured',
      message: 'Redis cache not available - continuing with local cache only'
    },
    { status: 503 }
  );
}

export async function PUT(req: NextRequest, { params }: { params: { slug?: string[] } }) {
  // Check if request was aborted before processing
  if (req.signal.aborted) {
    console.debug('[Redis API] PUT request aborted before processing');\n    return new NextResponse('Client closed request', { status: 499 });\n  }\n\n  try {\n    // Check abort again before responding\n    if (req.signal.aborted) {\n      console.debug('[Redis API] PUT request aborted during processing');\n      return new NextResponse('Client closed request', { status: 499 });\n    }\n\n    // Silently accept PUT requests when Redis is unavailable\n    // Client-side will use localStorage as fallback\n    return NextResponse.json(\n      { success: false, reason: 'Redis not available - using localStorage' },\n      { status: 503 }\n    );\n  } catch (error: any) {\n    // Handle specific error cases\n    if (error?.code === 'ECONNRESET' || error?.name === 'AbortError') {\n      console.debug('[Redis API] Connection aborted:', error.code || error.name);\n      return new NextResponse('Client closed request', { status: 499 });\n    }\n    \n    console.error('[Redis API] PUT error:', error);\n    return NextResponse.json(\n      { success: false, reason: 'Redis error', error: String(error) },\n      { status: 503 }\n    );\n  }\n}\n\nexport async function POST(req: NextRequest, { params }: { params: { slug?: string[] } }) {\n  // Check if request was aborted\n  if (req.signal.aborted) {\n    return new NextResponse('Client closed request', { status: 499 });\n  }\n\n  return NextResponse.json(\n    { success: false, reason: 'Redis not available' },\n    { status: 503 }\n  );\n}
