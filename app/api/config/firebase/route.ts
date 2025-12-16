import { NextResponse } from 'next/server';

/**
 * Route API pour exposer la configuration Firebase (clés publiques uniquement)
 * Cette route expose uniquement les clés publiques nécessaires au client
 * Les secrets (FIREBASE_PRIVATE_KEY) restent côté serveur
 */
export async function GET() {
  try {
    // Récupérer uniquement les clés publiques Firebase
    const firebaseConfig = {
      apiKey: process.env.FIREBASE_API_KEY || '',
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
      projectId: process.env.FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.FIREBASE_APP_ID || '',
    };

    // Vérifier que la configuration est valide
    const isConfigValid = Object.values(firebaseConfig).every(
      (value) => value && value !== '' && value !== 'undefined'
    );

    if (!isConfigValid) {
      return NextResponse.json(
        { 
          error: 'Firebase configuration incomplete',
          message: 'Some Firebase environment variables are missing'
        },
        { status: 503 }
      );
    }

    // Retourner uniquement les clés publiques (pas de secrets)
    return NextResponse.json(firebaseConfig, {
      headers: {
        'Cache-Control': 'public, max-age=3600', // Cache pendant 1 heure
      },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Error in Firebase config route:', err);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: err.message || 'Failed to get Firebase configuration'
      },
      { status: 500 }
    );
  }
}

