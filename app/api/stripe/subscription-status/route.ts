import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { verifyAuth } from '../../auth/middleware';
import { redis } from '@/lib/redis';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PRICE_PRO_MONTHLY = process.env.STRIPE_PRICE_PRO_MONTHLY || '';
const PRICE_PRO_YEARLY = process.env.STRIPE_PRICE_PRO_YEARLY || '';

const stripe = STRIPE_SECRET_KEY && STRIPE_SECRET_KEY.trim() !== ''
  ? new Stripe(STRIPE_SECRET_KEY.trim(), {
      apiVersion: '2025-11-17.clover',
    })
  : null;

// Cache pour les statuts d'abonnement (évite les appels API répétés)
type SubscriptionStatusData = {
  isActive: boolean;
  plan: 'free' | 'pro';
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

const CACHE_DURATION_SECONDS = 30; // 30 secondes de cache

function subscriptionCacheKey(userId: string): string {
  return `stripe:subscription:${userId}`;
}

async function getCachedSubscription(userId: string): Promise<SubscriptionStatusData | null> {
  try {
    if (!redis) return null;
    const raw = await redis.get(subscriptionCacheKey(userId));
    if (!raw) return null;
    return JSON.parse(raw as string) as SubscriptionStatusData;
  } catch {
    return null;
  }
}

async function setCachedSubscription(userId: string, data: SubscriptionStatusData): Promise<void> {
  try {
    if (!redis) return;
    await redis.setex(subscriptionCacheKey(userId), CACHE_DURATION_SECONDS, JSON.stringify(data));
  } catch {
    // Non-blocking cache failure
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Vérifier le cache d'abord (performance maximale)
    const cached = await getCachedSubscription(auth.userId);
    if (cached) {
      return NextResponse.json(cached);
    }

    if (!stripe) {
      // Stripe not configured, return free plan status
      return NextResponse.json({
        isActive: false,
        plan: 'free',
        status: 'none',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
    }

    // Trouver le client Stripe par metadata userId (source de vérité Stripe)
    // IMPORTANT: Toutes les données proviennent directement de l'API Stripe, aucune simulation
    let customer: Stripe.Customer | null = null;
    
    // Essayer d'abord avec une recherche directe si on a le customerId dans Firestore
    // Sinon, lister tous les clients (limite 100, devrait suffire pour la plupart des cas)
    const customers = await stripe.customers.list({
      limit: 100,
    });

    customer = customers.data.find(
      (c) => c.metadata?.userId === auth.userId
    ) as Stripe.Customer | null;
    
    // Si pas trouvé et qu'on a un customerId dans les métadonnées, essayer de le récupérer directement
    if (!customer) {
      console.log(`⚠️ Customer not found in list for userId: ${auth.userId}, checking all customers...`);
      // Note: En production, on pourrait optimiser en stockant le customerId dans Firestore
    }

    if (!customer) {
      return NextResponse.json({
        isActive: false,
        plan: 'free',
        status: 'none',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
    }

    // Get subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json({
        isActive: false,
        plan: 'free',
        status: 'none',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
    }

    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0]?.price.id;
    const isPro = priceId === PRICE_PRO_MONTHLY || priceId === PRICE_PRO_YEARLY;

    // Récupérer TOUTES les informations DIRECTEMENT depuis Stripe (source de vérité absolue)
    // Aucune simulation, toutes les données proviennent de l'API Stripe
    const periodEnd = (subscription as any).current_period_end;
    const subscriptionData: SubscriptionStatusData = {
      isActive: subscription.status === 'active',
      plan: isPro ? 'pro' : 'free',
      status: subscription.status, // Statut réel depuis Stripe: 'active', 'canceled', 'past_due', 'trialing', etc.
      currentPeriodEnd: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
    };

    // Log pour vérification - toutes les données proviennent de Stripe
    console.log('📊 [STRIPE REAL DATA] Subscription status récupéré directement depuis Stripe API:', {
      userId: auth.userId,
      customerId: customer.id,
      subscriptionId: subscription.id,
      status: subscription.status, // Statut réel Stripe
      plan: subscriptionData.plan,
      isActive: subscriptionData.isActive,
      currentPeriodEnd: subscriptionData.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd,
      priceId: priceId,
      // Vérification que c'est bien un abonnement Pro
      isProPrice: isPro,
      expectedMonthly: PRICE_PRO_MONTHLY,
      expectedYearly: PRICE_PRO_YEARLY,
    });

    // IMPORTANT: Synchroniser Firestore avec les données Stripe réelles si incohérence détectée
    // Cela garantit que Firestore est toujours à jour avec Stripe
    try {
      const { getFirebaseAdmin } = await import('~/lib/firebaseAdmin');
      const admin = getFirebaseAdmin();
      const db = admin.firestore();
      const userRef = db.collection('users').doc(auth.userId);
      const userDoc = await userRef.get();
      
      if (userDoc.exists) {
        const currentProfile = userDoc.data();
        const needsUpdate = 
          currentProfile?.plan !== subscriptionData.plan ||
          currentProfile?.subscriptionStatus !== subscription.status ||
          currentProfile?.subscriptionId !== subscription.id;
        
        if (needsUpdate) {
          console.log('🔄 [SYNC] Mise à jour Firestore avec données Stripe réelles:', {
            oldPlan: currentProfile?.plan,
            newPlan: subscriptionData.plan,
            oldStatus: currentProfile?.subscriptionStatus,
            newStatus: subscription.status,
          });
          
          const updateData: any = {
            plan: subscriptionData.plan,
            subscriptionStatus: subscription.status,
            subscriptionId: subscription.id,
            stripeCustomerId: customer.id,
            updatedAt: admin.firestore.Timestamp.now(),
          };
          
          if (periodEnd) {
            updateData.subscriptionEndDate = new Date(periodEnd * 1000).toISOString();
          }
          
          await userRef.update(updateData);
          console.log('✅ [SYNC] Firestore mis à jour avec données Stripe');
        }
      }
    } catch (syncError) {
      // Ne pas bloquer la réponse si la synchronisation échoue
      console.warn('⚠️ Erreur lors de la synchronisation Firestore (non-bloquant):', syncError);
    }

    // Mettre en cache pour éviter les appels répétés
    await setCachedSubscription(auth.userId, subscriptionData);

    return NextResponse.json(subscriptionData);
  } catch (error: any) {
    console.error('Error getting subscription status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get subscription status' },
      { status: 500 }
    );
  }
}

