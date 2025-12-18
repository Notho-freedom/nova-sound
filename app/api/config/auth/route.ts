import { NextResponse } from 'next/server';

/**
 * Route API pour exposer la configuration OAuth (Client ID uniquement)
 * Cette route expose uniquement le Client ID OAuth
 * Le Client Secret (GOOGLE_CLIENT_SECRET) reste côté serveur
 */
export async function GET() {
  try {
    // Récupérer uniquement le Client ID (pas le secret)
    // Desktop app Client ID (from user): 925746643102-bknlkfarsfcrtmb8lvl11lnn0cprjvqv.apps.googleusercontent.com
    // Fallback Client ID: 925746643102-12b1lokc63s21fjm3sq25dprc0embfbo.apps.googleusercontent.com
    const authConfig = {
      googleClientId: process.env.GOOGLE_CLIENT_ID || 
                     process.env.GOOGLE_OAUTH_CLIENT_ID || 
                     '925746643102-bknlkfarsfcrtmb8lvl11lnn0cprjvqv.apps.googleusercontent.com',
    };

    // Vérifier que le Client ID est présent
    if (!authConfig.googleClientId || authConfig.googleClientId === 'undefined') {
      return NextResponse.json(
        { 
          error: 'OAuth configuration incomplete',
          message: 'GOOGLE_CLIENT_ID is missing'
        },
        { status: 503 }
      );
    }

    // Retourner uniquement le Client ID (pas de secrets)
    return NextResponse.json(authConfig, {
      headers: {
        'Cache-Control': 'public, max-age=3600', // Cache pendant 1 heure
      },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Error in Auth config route:', err);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: err.message || 'Failed to get OAuth configuration'
      },
      { status: 500 }
    );
  }
}

