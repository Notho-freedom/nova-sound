import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { verifyAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { rateLimiters } from '../middleware/rate-limit.js';

const router = Router();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PRICE_PRO_MONTHLY = process.env.STRIPE_PRICE_PRO_MONTHLY || '';
const PRICE_PRO_YEARLY = process.env.STRIPE_PRICE_PRO_YEARLY || '';

const stripe = STRIPE_SECRET_KEY && STRIPE_SECRET_KEY.trim() !== ''
  ? new Stripe(STRIPE_SECRET_KEY.trim(), {
      apiVersion: '2025-11-17.clover',
    })
  : null;

// GET /api/stripe/subscription-status
router.get('/subscription-status', rateLimiters.general, verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!stripe) {
      // Stripe not configured, return free plan status
      return res.json({
        isActive: false,
        plan: 'free',
        status: 'none',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
    }

    // Find customer by metadata
    const customers = await stripe.customers.list({
      limit: 100,
    });

    const customer = customers.data.find(
      (c) => c.metadata?.userId === req.userId
    );

    if (!customer) {
      return res.json({
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
      return res.json({
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

    res.json({
      isActive: subscription.status === 'active',
      plan: isPro ? 'pro' : 'free',
      status: subscription.status,
      currentPeriodEnd: (subscription as any).current_period_end
        ? new Date((subscription as any).current_period_end * 1000).toISOString()
        : null,
      cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
    });
  } catch (error: any) {
    console.error('Error getting subscription status:', error);
    res.status(500).json({ error: error.message || 'Failed to get subscription status' });
  }
});

// POST /api/stripe/create-checkout-session
router.post('/create-checkout-session', rateLimiters.general, verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const { priceId, successUrl, cancelUrl } = req.body;

    if (!priceId) {
      return res.status(400).json({ error: 'Price ID is required' });
    }

    // Find or create customer
    const customers = await stripe.customers.list({
      limit: 100,
    });

    let customer = customers.data.find(
      (c) => c.metadata?.userId === req.userId
    );

    if (!customer) {
      customer = await stripe.customers.create({
        metadata: {
          userId: req.userId,
        },
        email: req.userEmail,
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${req.headers.origin || 'http://localhost:3000'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${req.headers.origin || 'http://localhost:3000'}/cancel`,
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message || 'Failed to create checkout session' });
  }
});

// POST /api/stripe/create-portal-session
router.post('/create-portal-session', rateLimiters.general, verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const { returnUrl } = req.body;

    // Find customer
    const customers = await stripe.customers.list({
      limit: 100,
    });

    const customer = customers.data.find(
      (c) => c.metadata?.userId === req.userId
    );

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: returnUrl || `${req.headers.origin || 'http://localhost:3000'}/settings`,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating portal session:', error);
    res.status(500).json({ error: error.message || 'Failed to create portal session' });
  }
});

export default router;

