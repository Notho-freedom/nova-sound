import { NextRequest } from 'next/server';
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export interface AuthenticatedRequest extends NextRequest {
  userId?: string;
  userEmail?: string;
}

/**
 * Middleware to verify Google OAuth access token
 */
export async function verifyAuth(request: NextRequest): Promise<{ userId: string; userEmail?: string } | null> {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);

    // First, try to verify as ID token
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      
      if (payload) {
        return {
          userId: payload.sub,
          userEmail: payload.email,
        };
      }
    } catch (idTokenError) {
      // ID token verification failed, try as access token
      console.log('ID token verification failed, trying as access token...');
    }

    // Try to verify as access token
    try {
      const response = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${token}`);
      
      if (response.ok) {
        const userInfo = await response.json();
        return {
          userId: userInfo.id || userInfo.sub,
          userEmail: userInfo.email,
        };
      } else {
        const errorText = await response.text();
        console.error('Access token verification failed:', response.status, errorText);
      }
    } catch (accessTokenError) {
      console.error('Error verifying access token:', accessTokenError);
    }
    
    return null;
  } catch (error) {
    console.error('Auth middleware error:', error);
    return null;
  }
}

