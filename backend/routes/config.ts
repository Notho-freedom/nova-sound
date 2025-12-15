import { Router, Request, Response } from 'express';
import { getFirebaseAdmin } from '../lib/firebaseAdmin.js';

const router = Router();

// GET /api/config/firebase
router.get('/firebase', (req: Request, res: Response) => {
  try {
    const config = {
      apiKey: process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.FIREBASE_APP_ID || process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    };

    // Valider que la config est complète
    const isValid = Object.values(config).every(
      (value) => value && value !== 'undefined'
    );

    if (!isValid) {
      return res.status(500).json({ error: 'Firebase configuration incomplete' });
    }

    res.json(config);
  } catch (error) {
    console.error('Error getting Firebase config:', error);
    res.status(500).json({ error: 'Failed to get Firebase config' });
  }
});

// GET /api/config/stripe
router.get('/stripe', (req: Request, res: Response) => {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  
  if (!publishableKey) {
    res.status(500).json({ error: 'Stripe not configured' });
    return;
  }
  
  res.json({ publishableKey });
});

// GET /api/config/auth
router.get('/auth', (req: Request, res: Response) => {
  const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  
  if (!googleClientId) {
    res.status(500).json({ error: 'Google OAuth not configured' });
    return;
  }
  
  res.json({ googleClientId });
});

export default router;

