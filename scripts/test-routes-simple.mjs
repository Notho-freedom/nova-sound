/**
 * Script de test simple pour toutes les routes API
 */

const BASE_URL = 'http://localhost:3000';

async function testRoute(name, method, path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.token && { Authorization: `Bearer ${options.token}` }),
  };

  try {
    const response = await fetch(url, {
      method,
      headers,
      ...(options.body && { body: JSON.stringify(options.body) }),
    });

    const status = response.status;
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    const success = status >= 200 && status < 300;
    const icon = success ? '✓' : '✗';
    const statusColor = success ? '\x1b[32m' : '\x1b[31m';
    
    console.log(`${icon} ${name}: ${statusColor}${status}\x1b[0m ${method} ${path}`);
    
    if (!success && data) {
      console.log(`   Error: ${JSON.stringify(data).substring(0, 100)}`);
    }

    return { name, success, status, data };
  } catch (error) {
    console.log(`✗ ${name}: \x1b[31mERROR\x1b[0m - ${error.message}`);
    return { name, success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('\n\x1b[36m=== Test des routes API Next.js ===\x1b[0m\n');

  const results = [];
  const TEST_TOKEN = 'test-token-invalid'; // Token invalide pour tester les erreurs d'auth

  // Health Check (pas d'auth)
  results.push(await testRoute('Health Check', 'GET', '/api/health'));

  // Storage Routes (auth requise)
  results.push(await testRoute('Storage - List Files', 'GET', '/api/storage/files', { token: TEST_TOKEN }));
  results.push(await testRoute('Storage - Download', 'GET', '/api/storage/download/test-id', { token: TEST_TOKEN }));

  // Stripe Routes (auth requise)
  results.push(await testRoute('Stripe - Subscription Status', 'GET', '/api/stripe/subscription-status', { token: TEST_TOKEN }));
  results.push(await testRoute('Stripe - Create Checkout', 'POST', '/api/stripe/create-checkout-session', {
    token: TEST_TOKEN,
    body: { priceId: 'test' },
  }));
  results.push(await testRoute('Stripe - Create Portal', 'POST', '/api/stripe/create-portal-session', {
    token: TEST_TOKEN,
    body: { returnUrl: 'http://localhost:3000/settings' },
  }));

  // Sync Routes (auth requise)
  results.push(await testRoute('Sync - Status', 'GET', '/api/sync/status', { token: TEST_TOKEN }));
  results.push(await testRoute('Sync - Start', 'POST', '/api/sync/start', { token: TEST_TOKEN }));

  // Résumé
  console.log('\n\x1b[36m=== Résumé ===\x1b[0m');
  const success = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`Total: ${total} | Succès: \x1b[32m${success}\x1b[0m | Échecs: \x1b[31m${total - success}\x1b[0m`);
  
  // Note sur les échecs attendus
  const authFailures = results.filter(r => !r.success && r.status === 401).length;
  if (authFailures > 0) {
    console.log(`\n\x1b[33mNote: ${authFailures} échec(s) d'authentification attendu(s) (token de test invalide)\x1b[0m`);
  }

  return results;
}

// Attendre que le serveur soit prêt
async function waitForServer(maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) {
        console.log('\x1b[32m✓ Serveur prêt\x1b[0m\n');
        return true;
      }
    } catch (error) {
      // Serveur pas encore prêt
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
    process.stdout.write('.');
  }
  console.log('\n\x1b[31m✗ Serveur non disponible après 10 secondes\x1b[0m');
  console.log('Assurez-vous que le serveur Next.js est démarré avec: npm run dev');
  return false;
}

// Exécuter
waitForServer().then(ready => {
  if (ready) {
    runAllTests().then(() => process.exit(0));
  } else {
    process.exit(1);
  }
});

