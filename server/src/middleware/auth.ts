import { Request, Response, NextFunction } from "express";
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

/**
 * Middleware to verify Google OAuth access token
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid authorization header" });
      return;
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
        // Attach user info to request
        req.userId = payload.sub;
        req.userEmail = payload.email || undefined;
        next();
        return;
      }
    } catch (idTokenError) {
      // ID token verification failed, try as access token
      console.log("ID token verification failed, trying as access token...");
    }

    // Try to verify as access token
    try {
      const response = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${token}`);
      
      if (response.ok) {
        const userInfo = await response.json();
        req.userId = userInfo.id || userInfo.sub;
        req.userEmail = userInfo.email;
        next();
        return;
      } else {
        const errorText = await response.text();
        console.error("Access token verification failed:", response.status, errorText);
      }
    } catch (accessTokenError) {
      console.error("Error verifying access token:", accessTokenError);
    }
    
    res.status(401).json({ error: "Invalid or expired token" });
  } catch (error: any) {
    console.error("Auth middleware error:", error);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

