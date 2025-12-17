import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '../../auth/middleware';
import { isBunnyConfigured } from '~/lib/bunny';

/**
 * GET /api/storage/bunny-status
 * Check if Bunny Storage is configured on the server
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const configured = isBunnyConfigured();
    
    return NextResponse.json({
      configured,
      provider: 'bunny',
      // Don't expose actual config values for security
      message: configured 
        ? 'Bunny Storage is configured and ready' 
        : 'Bunny Storage is not configured. Please set BUNNY_STORAGE_NAME and BUNNY_API_KEY in .env',
    });
  } catch (error: unknown) {
    console.error('Error checking Bunny status:', error);
    return NextResponse.json({ 
      configured: false, 
      error: 'Failed to check Bunny status' 
    }, { status: 500 });
  }
}
