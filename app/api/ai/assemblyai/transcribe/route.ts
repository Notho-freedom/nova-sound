/**
 * Route API pour la transcription audio avec AssemblyAI
 * Accessible uniquement aux utilisateurs Pro
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { verifyAuth } from '../../../auth/middleware';
import { qstash } from '@/lib/qstash-helpers';

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PRICE_PRO_MONTHLY = process.env.STRIPE_PRICE_PRO_MONTHLY || '';
const PRICE_PRO_YEARLY = process.env.STRIPE_PRICE_PRO_YEARLY || '';

const stripe = STRIPE_SECRET_KEY && STRIPE_SECRET_KEY.trim() !== ''
  ? new Stripe(STRIPE_SECRET_KEY.trim(), {
      apiVersion: '2025-11-17.clover',
    })
  : null;

interface TranscriptionRequest {
  audioUrl?: string;
  audioData?: string; // Base64 encoded audio
  languageCode?: string;
  speakerLabels?: boolean;
  sentimentAnalysis?: boolean;
  autoChapters?: boolean;
  entityDetection?: boolean;
  toxicityDetection?: boolean;
}

/**
 * POST /api/ai/assemblyai/transcribe
 * Transcrit un audio avec AssemblyAI
 */
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    // Vérifier que l'utilisateur est Pro (double vérification : Firestore + Stripe)
    const { getFirebaseAdmin } = await import('~/lib/firebaseAdmin');
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    const userRef = db.collection('users').doc(auth.userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const isProFirestore = userData?.plan === 'pro' && userData?.subscriptionStatus === 'active';

    // Vérifier aussi avec Stripe (source de vérité)
    let isProStripe = false;
    if (stripe) {
      try {
        const customers = await stripe.customers.list({ limit: 100 });
        const customer = customers.data.find(
          (c) => c.metadata?.userId === auth.userId
        );
        
        if (customer) {
          const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            limit: 1,
          });
          
          if (subscriptions.data.length > 0) {
            const subscription = subscriptions.data[0];
            const priceId = subscription.items.data[0]?.price.id;
            isProStripe = 
              subscription.status === 'active' &&
              (priceId === PRICE_PRO_MONTHLY || priceId === PRICE_PRO_YEARLY);
          }
        }
      } catch (stripeError) {
        console.warn('Erreur lors de la vérification Stripe:', stripeError);
      }
    }

    const isPro = isProFirestore || isProStripe;

    if (!isPro) {
      return NextResponse.json(
        { 
          error: 'Fonctionnalité réservée aux utilisateurs Pro',
          code: 'PRO_REQUIRED',
          message: 'Vous devez avoir un abonnement Pro actif pour utiliser cette fonctionnalité.'
        },
        { status: 403 }
      );
    }

    // Vérifier la clé API AssemblyAI
    if (!ASSEMBLYAI_API_KEY) {
      console.error('ASSEMBLYAI_API_KEY non configurée');
      return NextResponse.json(
        { error: 'Service IA non configuré' },
        { status: 500 }
      );
    }

    const body: TranscriptionRequest = await request.json();
    const { audioUrl, audioData, languageCode, speakerLabels, sentimentAnalysis, autoChapters, entityDetection, toxicityDetection } = body;

    if (!audioUrl && !audioData) {
      return NextResponse.json(
        { error: 'audioUrl ou audioData requis' },
        { status: 400 }
      );
    }

    // Si audioData est fourni (base64), on doit d'abord l'uploader
    let finalAudioUrl = audioUrl;
    
    if (audioData && !audioUrl) {
      // Upload temporaire de l'audio (à implémenter selon votre stockage)
      // Pour l'instant, on retourne une erreur
      return NextResponse.json(
        { error: 'Upload audio temporaire non encore implémenté. Utilisez audioUrl.' },
        { status: 501 }
      );
    }

    // Créer la transcription avec AssemblyAI
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'authorization': ASSEMBLYAI_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: finalAudioUrl,
        language_code: languageCode || 'fr',
        speaker_labels: speakerLabels ?? true,
        sentiment_analysis: sentimentAnalysis ?? true,
        auto_chapters: autoChapters ?? true,
        entity_detection: entityDetection ?? true,
        toxicity_detection: toxicityDetection ?? true,
      }),
    });

    if (!transcriptResponse.ok) {
      const errorData = await transcriptResponse.json().catch(() => ({}));
      console.error('Erreur AssemblyAI:', errorData);
      return NextResponse.json(
        { error: 'Erreur lors de la création de la transcription', details: errorData },
        { status: transcriptResponse.status }
      );
    }

    const transcriptData = await transcriptResponse.json();
    const transcriptId = transcriptData.id;

    // Déléguer le polling à QStash
    await qstash.task.publishDelayed(
      'assemblyai-poll',
      {
        transcriptId,
        userId: auth.userId,
        audioUrl: finalAudioUrl,
      },
      5
    );

    return NextResponse.json({
      id: transcriptId,
      status: 'processing',
      message: 'Transcription en cours. Utilisez /api/ai/assemblyai/transcript/[id] pour récupérer le résultat.',
    }, { status: 202 });

  } catch (error) {
    console.error('Erreur lors de la transcription:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

