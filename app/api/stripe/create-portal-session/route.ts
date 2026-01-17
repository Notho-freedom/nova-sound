import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { verifyAuth } from '../../auth/middleware';
import { getFirebaseAdmin } from '~/lib/firebaseAdmin';
import { validateRequest, createErrorResponse, ErrorCodes, stripePortalSchema, isValidationError } from '~/lib/validation';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';

const stripe = STRIPE_SECRET_KEY && STRIPE_SECRET_KEY.trim() !== ''
  ? new Stripe(STRIPE_SECRET_KEY.trim(), {
      apiVersion: '2025-11-17.clover',
    })
  : null;

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return createErrorResponse(
        ErrorCodes.AUTHENTICATION_ERROR,
        'User not authenticated',
        401
      );
    }

    if (!stripe) {
      return createErrorResponse(
        ErrorCodes.EXTERNAL_SERVICE_ERROR,
        'Stripe is not configured. Please set STRIPE_SECRET_KEY in .env',
        503
      );
    }

    const body = await request.json();
    
    // Validate request body
    const validation = validateRequest(stripePortalSchema, body);
    if (isValidationError(validation)) {
      return createErrorResponse(
        validation.error.code,
        validation.error.message,
        400,
        validation.error.details
      );
    }

    const { returnUrl } = validation.data;

    // Find customer by stored stripeCustomerId in Firestore (preferred)
    let customer = null;

    try {
      const admin = getFirebaseAdmin();
      const userDoc = await admin.firestore().collection('users').doc(auth.userId).get();
      const stripeCustomerId = userDoc.exists ? userDoc.data()?.stripeCustomerId : null;

      if (stripeCustomerId) {
        customer = await stripe.customers.retrieve(stripeCustomerId);
        if ((customer as Stripe.DeletedCustomer).deleted) {
          customer = null;
        }
      }
    } catch (firestoreError) {
      console.warn('Failed to fetch stripeCustomerId from Firestore, falling back to metadata search:', firestoreError);
    }

    // Fallback: find customer by metadata (legacy)
    if (!customer) {
      const customers = await stripe.customers.list({
        limit: 100,
      });

      customer = customers.data.find(
        (c) => c.metadata?.userId === auth.userId
      ) || null;
    }

    // If customer doesn't exist, create one
    if (!customer) {
      customer = await stripe.customers.create({
        email: auth.userEmail,
        metadata: {
          userId: auth.userId,
        },
      });
      console.log('Created new Stripe customer for user:', auth.userId);

      // Persist stripeCustomerId for future lookups
      try {
        const admin = getFirebaseAdmin();
        await admin.firestore().collection('users').doc(auth.userId).set({
          stripeCustomerId: customer.id,
        }, { merge: true });
      } catch (persistError) {
        console.warn('Failed to persist stripeCustomerId to Firestore:', persistError);
      }
    }

    // Create portal session
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: (customer as Stripe.Customer).id,
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
        return createErrorResponse(
          ErrorCodes.EXTERNAL_SERVICE_ERROR,
          'Stripe Billing Portal is not configured. Please configure it in your Stripe Dashboard: Settings > Billing > Customer portal',
          400,
          { stripeError: stripeError.message }
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
    return createErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      err.message || 'Failed to create portal session. Please try again later.',
      500,
      process.env.NODE_ENV === 'development' ? { originalError: err.message, type: err.type } : undefined
    );
  }
}

