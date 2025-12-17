/**
 * Script to deactivate Pro plan for a user
 * Usage: npx tsx scripts/deactivate-pro.ts bobymomo6@gmail.com
 */

import admin from 'firebase-admin';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local or .env
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

// Initialize Firebase Admin with environment variables
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ Firebase Admin credentials not configured.');
  console.error('Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in your .env file.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();

async function deactivatePro(email: string) {
  try {
    console.log(`🔍 Recherche de l'utilisateur avec l'email: ${email}...`);

    // Find user by email
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).limit(1).get();

    if (snapshot.empty) {
      console.error(`❌ Utilisateur avec l'email ${email} non trouvé`);
      console.log('💡 Assurez-vous que l\'utilisateur s\'est connecté au moins une fois à l\'application');
      process.exit(1);
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    const userId = userDoc.id;

    console.log(`✅ Utilisateur trouvé: ${userData.displayName || userData.email}`);
    console.log(`   UID: ${userId}`);
    console.log(`   Plan actuel: ${userData.plan || 'free'}`);
    console.log(`   Statut: ${userData.subscriptionStatus || 'none'}`);

    if (userData.plan !== 'pro') {
      console.log(`\n⚠️  L'utilisateur n'a pas le plan Pro. Plan actuel: ${userData.plan || 'free'}`);
      process.exit(0);
    }

    // Update to Free
    await userDoc.ref.update({
      plan: 'free',
      subscriptionStatus: 'canceled',
      subscriptionEndDate: null,
      updatedAt: admin.firestore.Timestamp.now(),
    });

    console.log('\n✨ Plan Pro désactivé avec succès!');
    console.log(`   Plan: free`);
    console.log(`   Statut: canceled`);
    console.log(`   L'utilisateur a maintenant accès au plan gratuit`);

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

// Get email from command line arguments
const email = process.argv[2] || 'bobymomo6@gmail.com';

if (!email) {
  console.error('❌ Email requis');
  console.log('Usage: npx tsx scripts/deactivate-pro.ts email@example.com');
  process.exit(1);
}

deactivatePro(email);
