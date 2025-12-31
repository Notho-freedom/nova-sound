import { NextRequest, NextResponse } from 'next/server';

/**
 * Health check endpoint for Redis connection
 * Returns connection status and basic info
 */
export async function GET(req: NextRequest) {
  const isConfigured = !!process.env.REDIS_HOST && !!process.env.REDIS_PORT;
  
  if (!isConfigured) {
    return NextResponse.json({
      status: 'not-configured',
      redis: {
        configured: false,
        connected: false,
        message: 'Redis not configured - set REDIS_HOST and REDIS_PORT in .env',
      },
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // Dynamic import to ensure server-side only
    const { redisCacheServer } = await import('@/services/redis-cache-server');
    
    console.log('[Redis Health] Attempting to connect...');
    
    // Attempt to connect if not already connected
    await redisCacheServer.connect();
    
    console.log('[Redis Health] Connected, testing operations...');
    
    // Test connection with a simple operation
    const testValue = { timestamp: Date.now(), test: true };
    
    await redisCacheServer.setVideo('health-test', testValue);
    const retrieved = await redisCacheServer.getVideo('health-test');
    
    const isHealthy = retrieved !== null;
    
    console.log('[Redis Health] Test complete:', isHealthy ? 'success' : 'failed');
    
    return NextResponse.json({
      status: isHealthy ? 'connected' : 'degraded',
      redis: {
        configured: true,
        connected: isHealthy,
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        tls: process.env.REDIS_TLS === 'true',
        database: process.env.REDIS_DB || '0',
      },
      test: {
        write: true,
        read: isHealthy,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Redis Health] Check failed:', error);
    
    return NextResponse.json({
      status: 'error',
      redis: {
        configured: true,
        connected: false,
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        tls: process.env.REDIS_TLS === 'true',
      },
      error: {
        message: error.message,
        code: error.code,
        type: error.name,
        stack: error.stack?.split('\n').slice(0, 3).join('\n'),
      },
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }
}
