import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getFirebaseAdmin } from '~/lib/firebaseAdmin';

// Disable body parsing - Stripe needs raw body for signature verification
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
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
async function updateUserToPro(userId: string, subscriptionEndDate?: Date): Promise<void> {
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

    await userRef.update(updateData);
    console.log(`✅ Updated user ${userId} to Pro plan`);
  } catch (error) {
    console.error(`❌ Error updating user ${userId} to Pro:`, error);
    throw error;
  }
}

/**
 * Update user profile in Firestore to Free (when subscription is canceled)
 */
async function updateUserToFree(userId: string): Promise<void> {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.warn(`User ${userId} not found in Firestore`);
      return;
    }

    await userRef.update({
      plan: 'free',
      subscriptionStatus: 'canceled',
      updatedAt: admin.firestore.Timestamp.now(),
    });
    console.log(`✅ Updated user ${userId} to Free plan`);
  } catch (error) {
    console.error(`❌ Error updating user ${userId} to Free:`, error);
    throw error;
  }
}

/**
 * Get userId from Stripe customer or metadata
 */
async function getUserIdFromStripe(customerId: string, metadata?: Record<string, string>): Promise<string | null> {
  // First, try to get userId from metadata
  if (metadata?.userId) {
    return metadata.userId;
  }

  // If not in metadata, try to find customer and get userId from metadata
  if (!stripe) {
    return null;
  }

  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (typeof customer === 'object' && !customer.deleted && customer.metadata?.userId) {
      return customer.metadata.userId;
    }
  } catch (error) {
    console.error('Error retrieving customer:', error);
  }

  return null;
}

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json(
      { error: 'Stripe is not configured' },
      { status: 503 }
    );
  }

  if (!STRIPE_WEBHOOK_SECRET) {
    console.warn('⚠️ STRIPE_WEBHOOK_SECRET not configured. Webhook signature verification disabled.');
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    if (STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    } else {
      // In development, parse without verification (not recommended for production)
      event = JSON.parse(body) as Stripe.Event;
      console.warn('⚠️ Webhook signature verification skipped (STRIPE_WEBHOOK_SECRET not set)');
    }
  } catch (error: any) {
    console.error('❌ Webhook signature verification failed:', error.message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${error.message}` },
      { status: 400 }
    );
  }

  console.log(`📥 Received Stripe webhook: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Try to get userId from session metadata first
        let userId = session.metadata?.userId;
        
        // If not in session metadata, try to get from customer metadata
        if (!userId && session.customer) {
          const customerId = typeof session.customer === 'string' 
            ? session.customer 
            : session.customer.id;
          userId = await getUserIdFromStripe(customerId);
        }
        
        if (!userId) {
          console.warn('⚠️ No userId found in checkout session metadata or customer metadata');
          console.warn('Session metadata:', session.metadata);
          console.warn('Customer:', session.customer);
          break;
        }

        console.log(`✅ Processing checkout.session.completed for userId: ${userId}`);

        // Get subscription end date from subscription if available
        let subscriptionEndDate: Date | undefined;
        if (session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            typeof session.subscription === 'string' ? session.subscription : session.subscription.id
          );
          subscriptionEndDate = new Date(subscription.current_period_end * 1000);
          console.log(`📅 Subscription end date: ${subscriptionEndDate.toISOString()}`);
        }

        await updateUserToPro(userId, subscriptionEndDate);
        console.log(`✅ Successfully updated user ${userId} to Pro plan`);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' 
          ? subscription.customer 
          : subscription.customer.id;

        const userId = await getUserIdFromStripe(customerId, subscription.metadata);
        
        if (!userId) {
          console.warn(`⚠️ Could not find userId for customer ${customerId}`);
          break;
        }

        // Check if it's a Pro subscription
        const priceId = subscription.items.data[0]?.price.id;
        const isPro = priceId === PRICE_PRO_MONTHLY || priceId === PRICE_PRO_YEARLY;

        if (isPro && subscription.status === 'active') {
          const subscriptionEndDate = new Date(subscription.current_period_end * 1000);
          await updateUserToPro(userId, subscriptionEndDate);
        } else if (subscription.status === 'canceled' || subscription.status === 'past_due') {
          await updateUserToFree(userId);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' 
          ? invoice.customer 
          : invoice.customer.id;

        // Only process if it's a subscription invoice
        if (!invoice.subscription) {
          break;
        }

        const userId = await getUserIdFromStripe(customerId, invoice.metadata);
        
        if (!userId) {
          console.warn(`⚠️ Could not find userId for customer ${customerId}`);
          break;
        }

        // Get subscription to check if it's Pro
        const subscriptionId = typeof invoice.subscription === 'string' 
          ? invoice.subscription 
          : invoice.subscription.id;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price.id;
        const isPro = priceId === PRICE_PRO_MONTHLY || priceId === PRICE_PRO_YEARLY;

        if (isPro && subscription.status === 'active') {
          const subscriptionEndDate = new Date(subscription.current_period_end * 1000);
          await updateUserToPro(userId, subscriptionEndDate);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' 
          ? subscription.customer 
          : subscription.customer.id;

        const userId = await getUserIdFromStripe(customerId, subscription.metadata);
        
        if (!userId) {
          console.warn(`⚠️ Could not find userId for customer ${customerId} (subscription deleted)`);
          break;
        }

        console.log(`🗑️ Processing subscription deletion for userId: ${userId}`);
        await updateUserToFree(userId);
        console.log(`✅ Updated user ${userId} to Free plan (subscription deleted)`);
        break;
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('❌ Error processing webhook:', error);
    return NextResponse.json(
      { error: `Webhook processing failed: ${error.message}` },
      { status: 500 }
    );
  }
}
