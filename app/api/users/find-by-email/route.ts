import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '~/lib/firebaseAdmin';
import { verifyAuth } from '../../auth/middleware';

/**
 * Find user by email using Admin SDK
 * GET /api/users/find-by-email?email=user@example.com
 * 
 * This endpoint uses Firebase Admin SDK to bypass Firestore security rules
 * and allows searching users by email (which is not possible with client-side queries).
 * 
 * Security: Requires authentication via Firebase ID token or Google OAuth token
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized. Authentication required.' },
        { status: 401 }
      );
    }

    // Get email from query parameters
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    // Validate email format (basic check)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Use Admin SDK to query Firestore (bypasses security rules)
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Find user by email
    const usersRef = db.collection('users');
    const snapshot = await usersRef
      .where('email', '==', email.toLowerCase().trim())
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json(
        { error: 'User not found', found: false },
        { status: 404 }
      );
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    // Return user profile (excluding sensitive data if needed)
    return NextResponse.json({
      found: true,
      user: {
        uid: userDoc.id,
        email: userData.email,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        plan: userData.plan || 'free',
        subscriptionStatus: userData.subscriptionStatus || null,
        subscriptionEndDate: userData.subscriptionEndDate || null,
        storageUsed: userData.storageUsed || 0,
        createdAt: userData.createdAt,
        lastLoginAt: userData.lastLoginAt,
      },
    });
  } catch (error: any) {
    console.error('Error finding user by email:', error);
    
    // Handle Firebase Admin initialization errors
    if (error.message?.includes('Firebase Admin credentials not configured')) {
      return NextResponse.json(
        { error: 'Server configuration error. Please contact support.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to find user by email' },
      { status: 500 }
    );
  }
}

