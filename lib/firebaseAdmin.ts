import * as admin from 'firebase-admin';

let initialized = false;
let initializationError: Error | null = null;

/**
 * Get Firebase Admin instance (initialized with environment variables)
 * This is the recommended approach for Next.js - no JSON files needed
 */
export function getFirebaseAdmin(): typeof admin {
  if (initializationError) {
    throw initializationError;
  }

  if (!initialized) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      initializationError = new Error(
        'Firebase Admin credentials not configured. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in your .env file.'
      );
      throw initializationError;
    }

    // Initialize only if not already initialized
    if (!admin.apps.length) {
      try {
        // Properly format the private key - handle both escaped and unescaped newlines
        let formattedPrivateKey = privateKey;
        
        // If the key contains literal \n (escaped), replace with actual newlines
        if (privateKey.includes('\\n')) {
          formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
        }
        
        // Ensure the key has proper PEM format
        if (!formattedPrivateKey.includes('-----BEGIN')) {
          initializationError = new Error(
            'Invalid FIREBASE_PRIVATE_KEY format. The key should start with "-----BEGIN PRIVATE KEY-----"'
          );
          throw initializationError;
        }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
            privateKey: formattedPrivateKey,
        }),
      });
      initialized = true;
      console.log('Firebase Admin initialized successfully');
      } catch (error: any) {
        initializationError = new Error(
          `Failed to initialize Firebase Admin: ${error.message}`
        );
        throw initializationError;
      }
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

