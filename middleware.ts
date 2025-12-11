import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware pour optimiser les rechargements et le cache
 * Empêche les recompilations inutiles pour certaines routes
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Empêcher les rechargements inutiles pour certaines routes
  if (request.nextUrl.pathname.startsWith('/api/') || 
      request.nextUrl.pathname.startsWith('/_next/')) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
  }
  
  // Ajouter des headers pour optimiser les ressources statiques
  if (request.nextUrl.pathname.startsWith('/_next/static/')) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

