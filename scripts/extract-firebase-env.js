/**
 * Helper script to extract Firebase Admin SDK credentials from JSON file
 * Usage: node scripts/extract-firebase-env.js
 * 
 * This will read the Firebase Admin SDK JSON file and output the environment variables
 * that you need to add to your .env.local file
 */

const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '..', 'nexus-player-d366f-firebase-adminsdk-fbsvc-4dfa7c0b4a.json');

if (!fs.existsSync(jsonPath)) {
  console.error('❌ Firebase Admin SDK JSON file not found at:', jsonPath);
  console.log('💡 Make sure the file exists before running this script');
  process.exit(1);
}

try {
  const serviceAccount = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  
  console.log('\n✅ Firebase Admin SDK credentials extracted!\n');
  console.log('📝 Add these to your .env.local file:\n');
  console.log('---');
  console.log(`FIREBASE_PROJECT_ID=${serviceAccount.project_id}`);
  console.log(`FIREBASE_CLIENT_EMAIL=${serviceAccount.client_email}`);
  console.log(`FIREBASE_PRIVATE_KEY="${serviceAccount.private_key.replace(/\n/g, '\\n')}"`);
  console.log('---\n');
  console.log('⚠️  IMPORTANT:');
  console.log('   - Keep the quotes around FIREBASE_PRIVATE_KEY');
  console.log('   - The \\n will be converted to actual newlines automatically');
  console.log('   - Never commit .env.local to Git!\n');
  
} catch (error) {
  console.error('❌ Error reading Firebase Admin SDK file:', error.message);
  process.exit(1);
}

