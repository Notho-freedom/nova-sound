import * as admin from 'firebase-admin';

let initialized = false;

/**
 * Get Firebase Admin instance (initialized with environment variables)
 * This is the recommended approach for Next.js - no JSON files needed
 */
export function getFirebaseAdmin(): typeof admin {
  if (!initialized) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'Firebase Admin credentials not configured. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in your .env file.'
      );
    }

    // Initialize only if not already initialized
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          // Replace \\n with actual newlines (needed when storing in .env)
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
      initialized = true;
      console.log('Firebase Admin initialized successfully');
    } else {
      initialized = true;
    }
  }

  return admin;
}

/**
 * Check if Firebase Admin is initialized
 */
export function isFirebaseAdminInitialized(): boolean {
  return initialized && admin.apps.length > 0;
}

