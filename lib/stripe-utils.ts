import Stripe from 'stripe';
import { verifyAuth } from '../app/api/auth/middleware';
import { NextRequest } from 'next/server';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PRICE_PRO_MONTHLY = process.env.STRIPE_PRICE_PRO_MONTHLY || '';
const PRICE_PRO_YEARLY = process.env.STRIPE_PRICE_PRO_YEARLY || '';

const stripe = STRIPE_SECRET_KEY && STRIPE_SECRET_KEY.trim() !== ''
  ? new Stripe(STRIPE_SECRET_KEY.trim(), {
      apiVersion: '2025-11-17.clover',
    })
  : null;

/**
 * Check if a user has an active Pro subscription
 */
export async function isUserPro(userId: string): Promise<boolean> {
  if (!stripe) {
    return false;
  }

  try {
    // Find customer by metadata
    const customers = await stripe.customers.list({
      limit: 100,
    });

    const customer = customers.data.find(
      (c) => c.metadata?.userId === userId
    );

    if (!customer) {
      return false;
    }

    // Get subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return false;
    }

    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0]?.price.id;
    const isPro = priceId === PRICE_PRO_MONTHLY || priceId === PRICE_PRO_YEARLY;

    return isPro && subscription.status === 'active';
  } catch (error) {
    console.error('Error checking Pro status:', error);
    return false;
  }
}

/**
 * Verify auth and check Pro status in one call
 */
export async function verifyAuthAndPro(request: NextRequest): Promise<{
  userId: string;
  userEmail?: string;
  isPro: boolean;
} | null> {
  const auth = await verifyAuth(request);
  if (!auth) {
    return null;
  }

  const isPro = await isUserPro(auth.userId);

  return {
    ...auth,
    isPro,
  };
}

