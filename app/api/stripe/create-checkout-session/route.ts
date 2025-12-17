import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { verifyAuth } from '../../auth/middleware';
import { validateRequest, createErrorResponse, ErrorCodes, stripeCheckoutSchema, isValidationError } from '~/lib/validation';
import { rateLimiters, getClientIdentifier } from '~/lib/rate-limit';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PRICE_PRO_MONTHLY = process.env.STRIPE_PRICE_PRO_MONTHLY || '';
const PRICE_PRO_YEARLY = process.env.STRIPE_PRICE_PRO_YEARLY || '';
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';

const stripe = STRIPE_SECRET_KEY && STRIPE_SECRET_KEY.trim() !== ''
  ? new Stripe(STRIPE_SECRET_KEY.trim(), {
      apiVersion: '2025-11-17.clover',
    })
  : null;

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimit = await rateLimiters.strict(clientId, false);
    if (!rateLimit.allowed) {
      return createErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        rateLimit.message || 'Too many requests',
        429,
        {
          resetTime: new Date(rateLimit.resetTime).toISOString(),
        }
      );
    }

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
    
    // Validate request body
    const validation = validateRequest(stripeCheckoutSchema, body);
    if (isValidationError(validation)) {
      return createErrorResponse(
        validation.error.code,
        validation.error.message,
        400,
        validation.error.details
      );
    }

    const { priceId, successUrl, cancelUrl } = validation.data;

    // Log for debugging
    console.log('[API] Received checkout request:', {
      priceId,
      expectedMonthly: PRICE_PRO_MONTHLY,
      expectedYearly: PRICE_PRO_YEARLY,
      userId: auth.userId,
    });

    // Validate price ID
    if (priceId !== PRICE_PRO_MONTHLY && priceId !== PRICE_PRO_YEARLY) {
      console.error('[API] Invalid price ID:', {
        provided: priceId,
        expectedMonthly: PRICE_PRO_MONTHLY,
        expectedYearly: PRICE_PRO_YEARLY,
      });
      return createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `Invalid price ID. Expected ${PRICE_PRO_MONTHLY} or ${PRICE_PRO_YEARLY}`,
        400,
        { 
          providedPriceId: priceId,
          expectedMonthly: PRICE_PRO_MONTHLY,
          expectedYearly: PRICE_PRO_YEARLY,
        }
      );
    }

    // Find or create Stripe customer with userId in metadata
    let customer = null;
    
    // Try to find existing customer by userId
    const customers = await stripe.customers.list({
      limit: 100,
    });
    
    customer = customers.data.find(
      (c) => c.metadata?.userId === auth.userId
    );
    
    // If customer doesn't exist, create one with userId in metadata
    if (!customer) {
      customer = await stripe.customers.create({
        email: auth.userEmail,
        metadata: {
          userId: auth.userId,
        },
      });
      console.log(`[API] Created new Stripe customer for user: ${auth.userId}`);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: customer.id, // Use existing/created customer
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId: auth.userId,
      },
      success_url: successUrl || `${FRONTEND_URL}/settings?success=true`,
      cancel_url: cancelUrl || `${FRONTEND_URL}/settings?canceled=true`,
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: unknown) {
    console.error('Error creating checkout session:', error);
    const err = error as { message?: string; type?: string; code?: string };
    
    // Check if it's a Stripe error
    if (err.type === 'StripeInvalidRequestError') {
      return createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        err.message || 'Invalid Stripe request',
        400
      );
    }
    
    return createErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      err.message || 'Failed to create checkout session. Please try again later.',
      500,
      process.env.NODE_ENV === 'development' ? { originalError: err.message } : undefined
    );
  }
}

