import { Router, Request, Response } from 'express';
import { getFirebaseAdmin } from '../lib/firebaseAdmin.js';
import { rateLimiters } from '../middleware/rate-limit.js';

const router = Router();

function getDb() {
  try {
    const admin = getFirebaseAdmin();
    return admin.firestore();
  } catch (error: any) {
    throw new Error(
      `Firebase Admin not configured: ${error.message}. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in your .env file.`
    );
  }
}

// POST /api/admin/activate-pro
router.post('/activate-pro', rateLimiters.strict, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user by email in Firestore
    const db = getDb();
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).limit(1).get();

    if (snapshot.empty) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userDoc = snapshot.docs[0];
    await userDoc.ref.update({
      isPro: true,
      proActivatedAt: new Date().toISOString(),
    });

    res.json({ 
      success: true, 
      message: `Pro plan activated for ${email}` 
    });
  } catch (error: any) {
    console.error('Error activating Pro plan:', error);
    res.status(500).json({ error: error.message || 'Failed to activate Pro plan' });
  }
});

export default router;

