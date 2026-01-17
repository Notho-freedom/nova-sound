import { NextRequest } from 'next/server';
import { createErrorResponse, ErrorCodes } from './validation';
import { verifyAuth } from '../app/api/auth/middleware';
import { verifyAuthAndPro } from './stripe-utils';

export interface AuthContext {
  userId: string;
  userEmail?: string;
  isPro?: boolean;
}

export async function requireAuth(request: NextRequest): Promise<{ auth?: AuthContext; error?: ReturnType<typeof createErrorResponse>; status?: number }> {
  const auth = await verifyAuth(request);
  if (!auth) {
    return {
      error: createErrorResponse(
        ErrorCodes.AUTHENTICATION_ERROR,
        'User not authenticated',
        401
      ),
      status: 401,
    };
  }
  return { auth };
}

export async function requirePro(request: NextRequest): Promise<{ auth?: AuthContext; error?: ReturnType<typeof createErrorResponse>; status?: number }> {
  const auth = await verifyAuthAndPro(request);
  if (!auth) {
    return {
      error: createErrorResponse(
        ErrorCodes.AUTHENTICATION_ERROR,
        'User not authenticated',
        401
      ),
      status: 401,
    };
  }
  if (!auth.isPro) {
    return {
      error: createErrorResponse(
        ErrorCodes.AUTHORIZATION_ERROR,
        'Pro subscription required',
        403
      ),
      status: 403,
    };
  }
  return { auth };
}

export function requireOwner(userId: string, resourceUserId: string): ReturnType<typeof createErrorResponse> | null {
  if (userId !== resourceUserId) {
    return createErrorResponse(
      ErrorCodes.AUTHORIZATION_ERROR,
      'Access denied: resource does not belong to user',
      403
    );
  }
  return null;
}
