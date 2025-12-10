import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { verifyAuth } from '../../auth/middleware';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:3000';

const stripe = STRIPE_SECRET_KEY && STRIPE_SECRET_KEY.trim() !== ''
  ? new Stripe(STRIPE_SECRET_KEY.trim(), {
      apiVersion: '2025-11-17.clover',
    })
  : null;

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
    const { returnUrl } = body;

    // Find customer by metadata
    let customer = null;
    
    // Try to find existing customer
    const customers = await stripe.customers.list({
      limit: 100,
    });

    customer = customers.data.find(
      (c) => c.metadata?.userId === auth.userId
    );

    // If customer doesn't exist, create one
    if (!customer) {
      customer = await stripe.customers.create({
        email: auth.userEmail,
        metadata: {
          userId: auth.userId,
        },
      });
      console.log('Created new Stripe customer for user:', auth.userId);
    }

    // Create portal session
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: customer.id,
        return_url: returnUrl || `${FRONTEND_URL}/settings`,
      });

      return NextResponse.json({ url: session.url });
    } catch (portalError: unknown) {
      const stripeError = portalError as { type?: string; message?: string; code?: string };
      console.error('Stripe portal session creation error:', {
        type: stripeError.type,
        code: stripeError.code,
        message: stripeError.message,
        customerId: customer.id,
      });
      
      // Check if it's a configuration error
      if (stripeError.type === 'invalid_request_error' && stripeError.message?.includes('portal')) {
        return NextResponse.json(
          { 
            error: 'Stripe Billing Portal is not configured. Please configure it in your Stripe Dashboard: Settings > Billing > Customer portal',
            details: stripeError.message 
          },
          { status: 400 }
        );
      }
      
      throw portalError; // Re-throw to be caught by outer catch
    }
  } catch (error: unknown) {
    const err = error as { message?: string; type?: string; code?: string };
    console.error('Error creating portal session:', {
      message: err.message,
      type: err.type,
      code: err.code,
    });
    return NextResponse.json(
      { 
        error: err.message || 'Failed to create portal session',
        details: err.type || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

