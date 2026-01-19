import { NextRequest } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { getFirebaseAdmin, isFirebaseAdminInitialized } from '~/lib/firebaseAdmin';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verify Firebase ID token
 */
async function verifyFirebaseToken(token: string): Promise<{ userId: string; userEmail?: string } | null> {
  // Only try to verify Firebase tokens on the server side
  if (typeof window !== 'undefined') {
    return null;
  }
  
  try {
    // Check if Firebase Admin is configured
    if (!isFirebaseAdminInitialized()) {
      // Try to initialize (will throw if env vars are missing, which is fine)
      try {
        getFirebaseAdmin();
      } catch (error: unknown) {
        // Firebase Admin not configured, skip Firebase verification
        return null;
      }
    }
    
    const admin = getFirebaseAdmin();
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    return {
      userId: decodedToken.uid,
      userEmail: decodedToken.email || undefined,
    };
  } catch (error: unknown) {
    // Not a Firebase token or verification failed
    // This is expected if the token is a Google OAuth token
    const firebaseError = error as { code?: string; message?: string };
    if (firebaseError.code !== 'auth/argument-error' && firebaseError.code !== 'auth/id-token-expired') {
      console.log('Firebase token verification failed:', firebaseError.message || 'Unknown error');
    }
  }
  
  return null;
}

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

    // First, try to verify as Firebase ID token (recommended for Firebase Auth users)
    const firebaseAuth = await verifyFirebaseToken(token);
    if (firebaseAuth) {
      return firebaseAuth;
    }

    // Try to verify as Google OAuth ID token
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
      console.log('Google ID token verification failed, trying as access token...');
    }

    // Try to verify as access token
    try {
      const signal = AbortSignal.timeout(5000); // 5 second timeout
      
      const response = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${token}`, {
        signal,
      });
      
      if (response.ok) {
        const userInfo = await response.json() as { id?: string; sub?: string; email?: string };
        return {
          userId: userInfo.id || userInfo.sub || '',
          userEmail: userInfo.email,
        };
      } else {
        const errorText = await response.text();
        console.error('Access token verification failed:', response.status, errorText);
      }
    } catch (accessTokenError: unknown) {
      const err = accessTokenError as { code?: string; cause?: { code?: string } };
      // Only log if it's not a network/timeout error (these are expected during connectivity issues)
      if (err.code !== 'ENOTFOUND' && err.cause?.code !== 'ENOTFOUND' && 
          err.code !== 'ABORT_ERR' && err.code !== 'ETIMEDOUT') {
        console.error('Error verifying access token:', accessTokenError);
      } else {
        console.warn('⚠️ Network issue verifying access token (this is normal during connectivity issues)');
      }
    }
    
    return null;
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Auth middleware error:', err.message || error);
    return null;
  }
}

