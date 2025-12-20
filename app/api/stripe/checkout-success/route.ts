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
 * Update user profile in Firestore to Pro
 */
async function updateUserToPro(
  userId: string, 
  subscriptionEndDate?: Date,
  subscriptionId?: string,
  stripeCustomerId?: string
): Promise<void> {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.warn(`User ${userId} not found in Firestore`);
      return;
    }

    const updateData: any = {
      plan: 'pro',
      subscriptionStatus: 'active',
      updatedAt: admin.firestore.Timestamp.now(),
    };

    if (subscriptionEndDate) {
      updateData.subscriptionEndDate = subscriptionEndDate.toISOString();
    }
    
    if (subscriptionId) {
      updateData.subscriptionId = subscriptionId;
    }
    
    if (stripeCustomerId) {
      updateData.stripeCustomerId = stripeCustomerId;
    }

    await userRef.update(updateData);
    console.log(`✅ Updated user ${userId} to Pro plan in Firestore`, {
      subscriptionId,
      stripeCustomerId,
      subscriptionEndDate: subscriptionEndDate?.toISOString(),
    });
  } catch (error) {
    console.error(`❌ Error updating user ${userId} to Pro:`, error);
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

    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'sessionId is required and must be a string' },
        { status: 400 }
      );
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Checkout session not found' },
        { status: 404 }
      );
    }

    // Verify the session is completed
    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment not completed' },
        { status: 400 }
      );
    }

    // Get customer ID from session
    const customerId = session.customer as string;
    if (!customerId) {
      return NextResponse.json(
        { error: 'No customer ID found in session' },
        { status: 400 }
      );
    }

    // Retrieve customer to get metadata (userId)
    const customer = await stripe.customers.retrieve(customerId);
    if (typeof customer === 'string' || customer.deleted) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    const userId = customer.metadata?.userId;
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID not found in customer metadata' },
        { status: 400 }
      );
    }

    // Verify the userId matches the authenticated user
    if (userId !== auth.userId) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    // Get subscription details if available
    const subscriptionId = session.subscription as string;
    let subscriptionEndDate: Date | undefined;

    if (subscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const periodEnd = (subscription as any).current_period_end;
        if (periodEnd) {
          subscriptionEndDate = new Date(periodEnd * 1000);
        }
      } catch (error) {
        console.warn('Could not retrieve subscription details:', error);
      }
    }

    // Update user profile in Firestore to Pro with all subscription details
    await updateUserToPro(userId, subscriptionEndDate, subscriptionId, customerId);

    return NextResponse.json({
      success: true,
      message: 'Checkout processed successfully',
      userId,
      plan: 'pro',
    });
  } catch (error: any) {
    console.error('Error processing checkout success:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process checkout success' },
      { status: 500 }
    );
  }
}
