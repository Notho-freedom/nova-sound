import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;

/**
 * Exchange OAuth authorization code for tokens
 * This endpoint handles the OAuth token exchange server-side
 * to keep the client_secret secure
 */
router.post('/oauth/token', async (req: Request, res: Response) => {
  try {
    const { code, redirect_uri, code_verifier } = req.body;

    console.log('🔍 [Backend Auth] OAuth token exchange request:', {
      hasCode: !!code,
      hasCodeVerifier: !!code_verifier,
      redirect_uri: redirect_uri || 'not provided',
    });

    // Log environment variables status (without exposing secrets)
    console.log('🔍 [Backend Auth] Environment check:', {
      hasGOOGLE_OAUTH_CLIENT_ID: !!process.env.GOOGLE_OAUTH_CLIENT_ID,
      hasGOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
      hasGOOGLE_OAUTH_CLIENT_SECRET: !!process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      hasGOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
      finalClientId: !!GOOGLE_CLIENT_ID,
      finalClientSecret: !!GOOGLE_CLIENT_SECRET,
    });

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    if (!GOOGLE_CLIENT_ID) {
      console.error('❌ [Backend Auth] GOOGLE_CLIENT_ID not configured');
      console.error('❌ [Backend Auth] Checked GOOGLE_OAUTH_CLIENT_ID:', !!process.env.GOOGLE_OAUTH_CLIENT_ID);
      console.error('❌ [Backend Auth] Checked GOOGLE_CLIENT_ID:', !!process.env.GOOGLE_CLIENT_ID);
      return res.status(500).json({ error: 'Google OAuth Client ID not configured on server' });
    }

    // PKCE flow (code_verifier provided) - some OAuth clients still require client_secret
    if (code_verifier) {
      console.log('🔍 [Backend Auth] Using PKCE flow');
      try {
        // PKCE flow: use code_verifier, but some OAuth clients still require client_secret
        // If client_secret is available, include it (some Google OAuth clients require it even with PKCE)
        const tokenParams: Record<string, string> = {
          client_id: GOOGLE_CLIENT_ID,
          code: code,
          redirect_uri: redirect_uri || 'http://localhost:3001',
          grant_type: 'authorization_code',
          code_verifier: code_verifier,
        };

        // Add client_secret if available (some OAuth clients require it even with PKCE)
        if (GOOGLE_CLIENT_SECRET) {
          tokenParams.client_secret = GOOGLE_CLIENT_SECRET;
        }

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(tokenParams),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error('❌ [Backend Auth] PKCE token exchange failed:', tokenResponse.status, errorText);
          return res.status(tokenResponse.status).json({
            error: 'Token exchange failed',
            message: errorText,
          });
        }

        const tokenData = await tokenResponse.json() as {
          access_token?: string;
          refresh_token?: string;
          id_token?: string;
          expires_in?: number;
        };
        console.log('✅ [Backend Auth] PKCE token exchange successful');
        
        return res.json({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          id_token: tokenData.id_token,
          expires_in: tokenData.expires_in || 3600,
        });
      } catch (fetchError) {
        console.error('❌ [Backend Auth] PKCE fetch error:', fetchError);
        return res.status(500).json({
          error: 'Token exchange failed',
          message: fetchError instanceof Error ? fetchError.message : 'Unknown error',
        });
      }
    }

    // Standard OAuth flow (requires client_secret)
    if (!GOOGLE_CLIENT_SECRET) {
      console.error('❌ [Backend Auth] GOOGLE_CLIENT_SECRET not configured (required for non-PKCE flow)');
      return res.status(500).json({ 
        error: 'Google OAuth Client Secret not configured on server',
        hint: 'Use PKCE flow (provide code_verifier) or configure GOOGLE_CLIENT_SECRET',
      });
    }

    console.log('🔍 [Backend Auth] Using standard OAuth flow with client_secret');
    try {
      const oauth2Client = new OAuth2Client(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        redirect_uri || 'http://localhost:3001'
      );

      const result = await oauth2Client.getToken(code);
      const tokens = result.tokens;

      if (!tokens.access_token) {
        return res.status(400).json({ error: 'Failed to get access token' });
      }

      console.log('✅ [Backend Auth] Standard OAuth token exchange successful');
      return res.json({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        id_token: tokens.id_token,
        expires_in: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600,
      });
    } catch (oauthError) {
      console.error('❌ [Backend Auth] Standard OAuth error:', oauthError);
      return res.status(500).json({
        error: 'Token exchange failed',
        message: oauthError instanceof Error ? oauthError.message : 'Unknown error',
      });
    }
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };
    console.error('❌ [Backend Auth] Unexpected error:', err);
    return res.status(500).json({
      error: 'Token exchange failed',
      message: err.message || 'Unknown error',
    });
  }
});

export default router;

