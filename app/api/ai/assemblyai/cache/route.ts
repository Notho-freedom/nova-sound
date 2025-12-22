/**
 * Route API pour gérer le cache des transcriptions
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '../../../auth/middleware';

/**
 * GET /api/ai/assemblyai/cache?audioUrl=...
 * Récupère une transcription depuis le cache si elle existe
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const audioUrl = searchParams.get('audioUrl');

    if (!audioUrl) {
      return NextResponse.json(
        { error: 'audioUrl requis' },
        { status: 400 }
      );
    }

    // Chercher dans le cache Firestore
    const { getFirebaseAdmin } = await import('~/lib/firebaseAdmin');
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    const cacheQuery = await db.collection('ai_transcriptions')
      .where('audioUrl', '==', audioUrl)
      .where('userId', '==', auth.userId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (!cacheQuery.empty) {
      const cachedDoc = cacheQuery.docs[0];
      const cachedData = cachedDoc.data();

      // Vérifier que le cache n'est pas expiré
      const expiresAt = cachedData.expiresAt?.toDate();
      if (expiresAt && expiresAt > new Date()) {
        return NextResponse.json({
          cached: true,
          id: cachedDoc.id,
          ...cachedData,
        });
      }
    }

    return NextResponse.json({
      cached: false,
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du cache:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

