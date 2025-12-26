import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '~/lib/firebaseAdmin';
import { verifyAuth } from '../../auth/middleware';

/**
 * Get user app data from Firestore using Admin SDK
 * GET /api/firestore/app-data?userId=xxx
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

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      );
    }

    // Use Admin SDK to access Firestore (bypasses security rules)
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Get user app data
    const appDataRef = db.collection('users').doc(userId).collection('appData').doc('data');
    const appDataSnap = await appDataRef.get();

    if (!appDataSnap.exists) {
      return NextResponse.json(
        { error: 'App data not found', found: false },
        { status: 404 }
      );
    }

    return NextResponse.json({
      found: true,
      data: appDataSnap.data(),
    });
  } catch (error: any) {
    console.error('Error getting app data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get app data' },
      { status: 500 }
    );
  }
}

/**
 * Save user app data to Firestore using Admin SDK
 * POST /api/firestore/app-data?userId=xxx
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized. Authentication required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const appData = body.data;

    if (!appData) {
      return NextResponse.json(
        { error: 'data field is required in request body' },
        { status: 400 }
      );
    }

    // Use Admin SDK to save to Firestore (bypasses security rules)
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Save user app data
    const appDataRef = db.collection('users').doc(userId).collection('appData').doc('data');
    await appDataRef.set(appData, { merge: true });

    return NextResponse.json({
      success: true,
      message: 'App data saved successfully',
    });
  } catch (error: any) {
    console.error('Error saving app data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save app data' },
      { status: 500 }
    );
  }
}

