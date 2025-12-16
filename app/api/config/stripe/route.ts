import { NextResponse } from 'next/server';

/**
 * Route API pour exposer la configuration Stripe (clé publique uniquement)
 * Cette route expose uniquement la clé publique Stripe et les Price IDs
 * La clé secrète (STRIPE_SECRET_KEY) reste côté serveur
 */
export async function GET() {
  try {
    // Récupérer uniquement les clés publiques Stripe
    const stripeConfig = {
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      priceProMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
      priceProYearly: process.env.STRIPE_PRICE_PRO_YEARLY || '',
    };

    // Vérifier que la clé publique est présente (les Price IDs sont optionnels)
    if (!stripeConfig.publishableKey || stripeConfig.publishableKey === 'undefined') {
      return NextResponse.json(
        { 
          error: 'Stripe configuration incomplete',
          message: 'STRIPE_PUBLISHABLE_KEY is missing'
        },
        { status: 503 }
      );
    }

    // Retourner uniquement les clés publiques (pas de secrets)
    return NextResponse.json(stripeConfig, {
      headers: {
        'Cache-Control': 'public, max-age=3600', // Cache pendant 1 heure
      },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Error in Stripe config route:', err);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: err.message || 'Failed to get Stripe configuration'
      },
      { status: 500 }
    );
  }
}

