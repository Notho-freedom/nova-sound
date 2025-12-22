/**
 * Route API pour récupérer une transcription existante
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '../../../../auth/middleware';

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

/**
 * GET /api/ai/assemblyai/transcript/[id]
 * Récupère une transcription par son ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const transcriptId = params.id;

    // Vérifier d'abord dans le cache Firestore
    const { getFirebaseAdmin } = await import('~/lib/firebaseAdmin');
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    const cacheRef = db.collection('ai_transcriptions').doc(transcriptId);
    const cacheDoc = await cacheRef.get();

    if (cacheDoc.exists) {
      const cacheData = cacheDoc.data();
      
      // Vérifier que l'utilisateur a accès à cette transcription
      if (cacheData?.userId === auth.userId) {
        return NextResponse.json(cacheData);
      }
    }

    // Si pas dans le cache, récupérer depuis AssemblyAI
    if (!ASSEMBLYAI_API_KEY) {
      return NextResponse.json(
        { error: 'Service IA non configuré' },
        { status: 500 }
      );
    }

    const response = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
      headers: {
        'authorization': ASSEMBLYAI_API_KEY,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Transcription non trouvée' },
        { status: response.status }
      );
    }

    const transcriptData = await response.json();

    return NextResponse.json({
      id: transcriptId,
      text: transcriptData.text,
      words: transcriptData.words || [],
      chapters: transcriptData.chapters || [],
      sentiment: transcriptData.sentiment_analysis_results || [],
      entities: transcriptData.entities || [],
      toxicity: transcriptData.toxicity || null,
      speakers: transcriptData.utterances || [],
      confidence: transcriptData.confidence || null,
      status: transcriptData.status,
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de la transcription:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

