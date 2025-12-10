import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '~/lib/firebaseAdmin';

const admin = getFirebaseAdmin();
const db = admin.firestore();

/**
 * Activate Pro plan for a user by email
 * POST /api/admin/activate-pro
 * Body: { email: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user by email in Firestore
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).limit(1).get();

    if (snapshot.empty) {
      return NextResponse.json(
        { error: `User with email ${email} not found` },
        { status: 404 }
      );
    }

    const userDoc = snapshot.docs[0];
    const userId = userDoc.id;

    // Update user profile to Pro
    await userDoc.ref.update({
      plan: 'pro',
      subscriptionStatus: 'active',
      subscriptionEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
      updatedAt: admin.firestore.Timestamp.now(),
    });

    return NextResponse.json({
      success: true,
      message: `Pro plan activated for ${email}`,
      userId,
      plan: 'pro',
      subscriptionStatus: 'active',
    });
  } catch (error: any) {
    console.error('Error activating Pro plan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to activate Pro plan' },
      { status: 500 }
    );
  }
}

/**
 * Get user status by email
 * GET /api/admin/activate-pro?email=user@example.com
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    // Find user by email
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).limit(1).get();

    if (snapshot.empty) {
      return NextResponse.json(
        { error: `User with email ${email} not found` },
        { status: 404 }
      );
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    return NextResponse.json({
      userId: userDoc.id,
      email: userData.email,
      plan: userData.plan || 'free',
      subscriptionStatus: userData.subscriptionStatus || null,
      subscriptionEndDate: userData.subscriptionEndDate || null,
    });
  } catch (error: any) {
    console.error('Error getting user status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get user status' },
      { status: 500 }
    );
  }
}

