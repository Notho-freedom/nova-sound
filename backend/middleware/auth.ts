import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { getFirebaseAdmin, isFirebaseAdminInitialized } from '../lib/firebaseAdmin.js';

const client = new OAuth2Client(process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID);

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

/**
 * Verify Firebase ID token
 */
async function verifyFirebaseToken(token: string): Promise<{ userId: string; userEmail?: string } | null> {
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

/**
 * Middleware to verify Google OAuth access token
 */
export async function verifyAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const token = authHeader.substring(7);

    // First, try to verify as Firebase ID token (recommended for Firebase Auth users)
    const firebaseAuth = await verifyFirebaseToken(token);
    if (firebaseAuth) {
      req.userId = firebaseAuth.userId;
      req.userEmail = firebaseAuth.userEmail;
      next();
      return;
    }

    // Try to verify as Google OAuth ID token
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      
      if (payload) {
        req.userId = payload.sub;
        req.userEmail = payload.email;
        next();
        return;
      }
    } catch (idTokenError) {
      // ID token verification failed, try as access token
      console.log('Google ID token verification failed, trying as access token...');
    }

    // Try to verify as access token
    try {
      const response = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${token}`);
      
      if (response.ok) {
        const userInfo = await response.json() as { id?: string; sub?: string; email?: string };
        req.userId = userInfo.id || userInfo.sub || '';
        req.userEmail = userInfo.email;
        next();
        return;
      } else {
        const errorText = await response.text();
        console.error('Access token verification failed:', response.status, errorText);
      }
    } catch (accessTokenError) {
      console.error('Error verifying access token:', accessTokenError);
    }
    
    res.status(401).json({ error: 'User not authenticated' });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Auth middleware error:', err.message || error);
    res.status(401).json({ error: 'User not authenticated' });
  }
}

/**
 * Helper function to verify auth and return user info (for use in route handlers)
 */
export async function getAuthUser(req: Request): Promise<{ userId: string; userEmail?: string } | null> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);

    // First, try to verify as Firebase ID token
    const firebaseAuth = await verifyFirebaseToken(token);
    if (firebaseAuth) {
      return firebaseAuth;
    }

    // Try to verify as Google OAuth ID token
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
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
    }

    // Try to verify as access token
    try {
      const response = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${token}`);
      
      if (response.ok) {
        const userInfo = await response.json() as { id?: string; sub?: string; email?: string };
        return {
          userId: userInfo.id || userInfo.sub || '',
          userEmail: userInfo.email,
        };
      }
    } catch (accessTokenError) {
      console.error('Error verifying access token:', accessTokenError);
    }
    
    return null;
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Auth error:', err.message || error);
    return null;
  }
}

