import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

/**
 * Route API pour rafraîchir un access token OAuth
 * Cette route doit être utilisée côté serveur pour protéger le client_secret
 */
export async function POST(request: NextRequest) {
  try {
    // Vérifier que les credentials sont configurés
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return NextResponse.json(
        { 
          error: 'OAuth not configured',
          message: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in server environment variables'
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { refresh_token } = body;

    // Valider les paramètres requis
    if (!refresh_token) {
      return NextResponse.json(
        { 
          error: 'Missing required parameters',
          message: 'refresh_token is required'
        },
        { status: 400 }
      );
    }

    // Préparer les paramètres pour le rafraîchissement du token
    const tokenParams = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refresh_token,
      grant_type: 'refresh_token',
    });

    // Appeler l'endpoint Google OAuth pour rafraîchir le token
    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Token refresh failed';
      
      try {
        const errorObj = JSON.parse(errorText);
        errorMessage = errorObj.error_description || errorObj.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      console.error('OAuth token refresh failed:', {
        status: response.status,
        error: errorMessage,
      });

      return NextResponse.json(
        { 
          error: 'Token refresh failed',
          message: errorMessage
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Retourner les tokens (sans exposer le client_secret)
    return NextResponse.json({
      access_token: data.access_token,
      id_token: data.id_token,
      expires_in: data.expires_in,
      token_type: data.token_type,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Error in OAuth token refresh:', err);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: err.message || 'Failed to refresh OAuth token'
      },
      { status: 500 }
    );
  }
}
