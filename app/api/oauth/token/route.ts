import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

/**
 * Route API pour échanger un code d'autorisation OAuth contre des tokens
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
    const { code, redirect_uri, code_verifier } = body;

    // Valider les paramètres requis
    if (!code || !redirect_uri || !code_verifier) {
      return NextResponse.json(
        { 
          error: 'Missing required parameters',
          message: 'code, redirect_uri, and code_verifier are required'
        },
        { status: 400 }
      );
    }

    // Préparer les paramètres pour l'échange de token
    const tokenParams = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code: code,
      redirect_uri: redirect_uri,
      grant_type: 'authorization_code',
      code_verifier: code_verifier,
    });

    // Appeler l'endpoint Google OAuth pour échanger le code
    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Token exchange failed';
      
      try {
        const errorObj = JSON.parse(errorText);
        errorMessage = errorObj.error_description || errorObj.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      console.error('OAuth token exchange failed:', {
        status: response.status,
        error: errorMessage,
      });

      return NextResponse.json(
        { 
          error: 'Token exchange failed',
          message: errorMessage
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Retourner les tokens (sans exposer le client_secret)
    return NextResponse.json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      id_token: data.id_token,
      expires_in: data.expires_in,
      token_type: data.token_type,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Error in OAuth token exchange:', err);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: err.message || 'Failed to exchange OAuth token'
      },
      { status: 500 }
    );
  }
}

