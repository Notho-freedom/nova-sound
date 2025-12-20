import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { verifyAuth } from '../../auth/middleware';
import { getFirebaseAdmin } from '~/lib/firebaseAdmin';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PRICE_PRO_MONTHLY = process.env.STRIPE_PRICE_PRO_MONTHLY || '';
const PRICE_PRO_YEARLY = process.env.STRIPE_PRICE_PRO_YEARLY || '';

const stripe = STRIPE_SECRET_KEY && STRIPE_SECRET_KEY.trim() !== ''
  ? new Stripe(STRIPE_SECRET_KEY.trim(), {
      apiVersion: '2025-11-17.clover',
    })
  : null;

/**
 * Update user profile in Firestore based on Stripe subscription data
 */
async function syncUserProfileFromStripe(userId: string): Promise<void> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    // Find customer by metadata
    const customers = await stripe.customers.list({
      limit: 100,
    });

    const customer = customers.data.find(
      (c) => c.metadata?.userId === userId
    );

    if (!customer) {
      console.log(`ℹ️ No Stripe customer found for userId: ${userId}`);
      // Update Firestore to free if no customer exists
      const userRef = db.collection('users').doc(userId);
      await userRef.update({
        plan: 'free',
        subscriptionStatus: 'none',
        updatedAt: admin.firestore.Timestamp.now(),
      });
      return;
    }

    // Get subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      console.log(`ℹ️ No subscription found for customer: ${customer.id}`);
      // Update Firestore to free if no subscription exists
      const userRef = db.collection('users').doc(userId);
      await userRef.update({
        plan: 'free',
        subscriptionStatus: 'none',
        updatedAt: admin.firestore.Timestamp.now(),
      });
      return;
    }

    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0]?.price.id;
    const isPro = priceId === PRICE_PRO_MONTHLY || priceId === PRICE_PRO_YEARLY;

    // Update Firestore with REAL Stripe data
    const userRef = db.collection('users').doc(userId);
    const updateData: any = {
      subscriptionStatus: subscription.status, // Statut réel depuis Stripe
      subscriptionId: subscription.id,
      stripeCustomerId: customer.id,
      updatedAt: admin.firestore.Timestamp.now(),
    };

    const periodEnd = (subscription as any).current_period_end;
    if (isPro && subscription.status === 'active') {
      updateData.plan = 'pro';
      if (periodEnd) {
        updateData.subscriptionEndDate = new Date(periodEnd * 1000).toISOString();
      }
    } else {
      updateData.plan = 'free';
      if (subscription.status === 'canceled') {
        updateData.subscriptionStatus = 'canceled';
      } else if (subscription.status === 'past_due') {
        updateData.subscriptionStatus = 'past_due';
      }
    }

    await userRef.update(updateData);
    
    console.log(`✅ [SYNC] User profile synchronized with Stripe:`, {
      userId,
      plan: updateData.plan,
      status: updateData.subscriptionStatus,
      subscriptionId: subscription.id,
      customerId: customer.id,
    });
  } catch (error) {
    console.error(`❌ Error syncing user profile with Stripe:`, error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY in .env' },
        { status: 503 }
      );
    }

    // Synchroniser le profil Firestore avec les données Stripe réelles
    await syncUserProfileFromStripe(auth.userId);

    return NextResponse.json({
      success: true,
      message: 'Profile synchronized with Stripe',
      userId: auth.userId,
    });
  } catch (error: any) {
    console.error('Error syncing profile with Stripe:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync profile with Stripe' },
      { status: 500 }
    );
  }
}
