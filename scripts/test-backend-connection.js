/**
 * Script de test de connexion au backend Express
 * Usage: node scripts/test-backend-connection.js
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-delta-ivory-17.vercel.app';

const endpoints = [
  { path: '/api/health', method: 'GET', auth: false },
  { path: '/api/config/firebase', method: 'GET', auth: false },
  { path: '/api/config/stripe', method: 'GET', auth: false },
  { path: '/api/config/auth', method: 'GET', auth: false },
  { path: '/api/stripe/subscription-status', method: 'GET', auth: true },
  { path: '/api/sync/status', method: 'GET', auth: true },
];

async function testEndpoint(endpoint) {
  const url = `${API_URL}${endpoint.path}`;
  const options = {
    method: endpoint.method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (endpoint.auth) {
    options.headers['Authorization'] = 'Bearer test-token';
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      data: data,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function runTests() {
  console.log('🧪 Test de connexion au backend Express\n');
  console.log(`📍 URL du backend: ${API_URL}\n`);
  console.log('─'.repeat(60));

  for (const endpoint of endpoints) {
    console.log(`\n🔍 Test: ${endpoint.method} ${endpoint.path}`);
    const result = await testEndpoint(endpoint);

    if (result.success) {
      console.log(`   ✅ Succès (${result.status})`);
      if (result.data && Object.keys(result.data).length <= 3) {
        console.log(`   📦 Réponse:`, JSON.stringify(result.data));
      }
    } else {
      console.log(`   ❌ Échec`);
      if (result.status) {
        console.log(`   📊 Status: ${result.status}`);
      }
      if (result.error) {
        console.log(`   ⚠️  Erreur: ${result.error}`);
      }
      if (result.data?.error) {
        console.log(`   📝 Message: ${result.data.error}`);
      }
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log('\n✅ Tests terminés !');
  console.log('\n💡 Pour tester avec l\'UI:');
  console.log('   1. Créez .env.local avec: NEXT_PUBLIC_API_URL=' + API_URL);
  console.log('   2. Lancez: npm run dev');
  console.log('   3. Ouvrez: http://localhost:3000');
}

runTests().catch(console.error);

