/**
 * Script de test complet pour toutes les routes API
 * Teste les routes avec et sans authentification
 */

const BASE_URL = 'http://localhost:3000';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

async function testRoute(name, method, path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.token && { Authorization: `Bearer ${options.token}` }),
    ...options.headers,
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
      const text = await response.text();
      data = text ? text.substring(0, 100) : null;
    }

    const isSuccess = status >= 200 && status < 300;
    const isExpectedFailure = options.expectedStatus && status === options.expectedStatus;
    const success = isSuccess || isExpectedFailure;
    
    const icon = success ? '✓' : '✗';
    const statusColor = isSuccess ? colors.green : (isExpectedFailure ? colors.yellow : colors.red);
    
    console.log(`${icon} ${name}`);
    console.log(`   ${method} ${path}`);
    console.log(`   Status: ${statusColor}${status}${colors.reset}`);
    
    if (data && typeof data === 'object') {
      const preview = JSON.stringify(data).substring(0, 150);
      console.log(`   Response: ${preview}${preview.length >= 150 ? '...' : ''}`);
    } else if (data) {
      console.log(`   Response: ${String(data).substring(0, 100)}`);
    }

    if (isExpectedFailure) {
      console.log(`   ${colors.yellow}(Échec attendu - ${options.expectedReason})${colors.reset}`);
    }

    return { name, success, status, data, isExpectedFailure };
  } catch (error) {
    console.log(`✗ ${name}`);
    console.log(`   ${colors.red}ERROR: ${error.message}${colors.reset}`);
    return { name, success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log(`\n${colors.cyan}=== Test complet des routes API Next.js ===${colors.reset}\n`);

  const results = [];
  const INVALID_TOKEN = 'invalid-test-token';

  // ===== 1. HEALTH CHECK =====
  console.log(`${colors.blue}--- Health Check ---${colors.reset}`);
  results.push(await testRoute(
    'Health Check',
    'GET',
    '/api/health'
  ));

  // ===== 2. STORAGE ROUTES =====
  console.log(`\n${colors.blue}--- Storage Routes ---${colors.reset}`);
  
  // Test sans authentification
  results.push(await testRoute(
    'Storage - List Files (sans auth)',
    'GET',
    '/api/storage/files',
    { expectedStatus: 401, expectedReason: 'Authentification requise' }
  ));

  // Test avec token invalide
  results.push(await testRoute(
    'Storage - List Files (token invalide)',
    'GET',
    '/api/storage/files',
    { token: INVALID_TOKEN, expectedStatus: 401, expectedReason: 'Token invalide' }
  ));

  // Test download sans auth
  results.push(await testRoute(
    'Storage - Download (sans auth)',
    'GET',
    '/api/storage/download/test-file-id',
    { expectedStatus: 401, expectedReason: 'Authentification requise' }
  ));

  // Test delete sans auth
  results.push(await testRoute(
    'Storage - Delete File (sans auth)',
    'DELETE',
    '/api/storage/files/test-file-id',
    { expectedStatus: 401, expectedReason: 'Authentification requise' }
  ));

  // ===== 3. STRIPE ROUTES =====
  console.log(`\n${colors.blue}--- Stripe Routes ---${colors.reset}`);
  
  // Subscription Status
  results.push(await testRoute(
    'Stripe - Subscription Status (sans auth)',
    'GET',
    '/api/stripe/subscription-status',
    { expectedStatus: 401, expectedReason: 'Authentification requise' }
  ));

  results.push(await testRoute(
    'Stripe - Subscription Status (token invalide)',
    'GET',
    '/api/stripe/subscription-status',
    { token: INVALID_TOKEN, expectedStatus: 401, expectedReason: 'Token invalide' }
  ));

  // Create Checkout Session
  results.push(await testRoute(
    'Stripe - Create Checkout (sans auth)',
    'POST',
    '/api/stripe/create-checkout-session',
    {
      body: { priceId: 'test-price-id' },
      expectedStatus: 401,
      expectedReason: 'Authentification requise'
    }
  ));

  results.push(await testRoute(
    'Stripe - Create Checkout (token invalide)',
    'POST',
    '/api/stripe/create-checkout-session',
    {
      token: INVALID_TOKEN,
      body: { priceId: 'test-price-id' },
      expectedStatus: 401,
      expectedReason: 'Token invalide'
    }
  ));

  // Create Portal Session
  results.push(await testRoute(
    'Stripe - Create Portal (sans auth)',
    'POST',
    '/api/stripe/create-portal-session',
    {
      body: { returnUrl: 'http://localhost:3000/settings' },
      expectedStatus: 401,
      expectedReason: 'Authentification requise'
    }
  ));

  // ===== 4. SYNC ROUTES =====
  console.log(`\n${colors.blue}--- Sync Routes ---${colors.reset}`);
  
  // Sync Status
  results.push(await testRoute(
    'Sync - Status (sans auth)',
    'GET',
    '/api/sync/status',
    { expectedStatus: 401, expectedReason: 'Authentification requise' }
  ));

  results.push(await testRoute(
    'Sync - Status (token invalide)',
    'GET',
    '/api/sync/status',
    { token: INVALID_TOKEN, expectedStatus: 401, expectedReason: 'Token invalide' }
  ));

  // Start Sync
  results.push(await testRoute(
    'Sync - Start (sans auth)',
    'POST',
    '/api/sync/start',
    { expectedStatus: 401, expectedReason: 'Authentification requise' }
  ));

  results.push(await testRoute(
    'Sync - Start (token invalide)',
    'POST',
    '/api/sync/start',
    { token: INVALID_TOKEN, expectedStatus: 401, expectedReason: 'Token invalide' }
  ));

  // ===== RÉSUMÉ =====
  console.log(`\n${colors.cyan}=== Résumé ===${colors.reset}`);
  
  const total = results.length;
  const success = results.filter(r => r.success).length;
  const failures = results.filter(r => !r.success && !r.isExpectedFailure).length;
  const expectedFailures = results.filter(r => r.isExpectedFailure).length;

  console.log(`Total: ${total}`);
  console.log(`${colors.green}Succès: ${success}${colors.reset}`);
  console.log(`${colors.yellow}Échecs attendus: ${expectedFailures}${colors.reset}`);
  console.log(`${colors.red}Échecs inattendus: ${failures}${colors.reset}`);

  // Vérifier que toutes les routes répondent
  const routesResponding = results.filter(r => r.status !== undefined).length;
  console.log(`\nRoutes répondant: ${routesResponding}/${total}`);

  if (routesResponding === total && failures === 0) {
    console.log(`\n${colors.green}✓ Toutes les routes fonctionnent correctement !${colors.reset}`);
    return true;
  } else if (failures > 0) {
    console.log(`\n${colors.red}✗ ${failures} route(s) avec des erreurs inattendues${colors.reset}`);
    return false;
  } else {
    console.log(`\n${colors.green}✓ Toutes les routes répondent correctement${colors.reset}`);
    return true;
  }
}

// Attendre que le serveur soit prêt
async function waitForServer(maxAttempts = 15) {
  console.log(`${colors.cyan}Attente du serveur...${colors.reset}`);
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) {
        return true;
      }
    } catch (error) {
      // Serveur pas encore prêt
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
    process.stdout.write('.');
  }
  console.log(`\n${colors.red}✗ Serveur non disponible après ${maxAttempts} secondes${colors.reset}`);
  console.log(`${colors.yellow}Assurez-vous que le serveur Next.js est démarré avec: npm run dev${colors.reset}`);
  return false;
}

// Exécuter
waitForServer().then(ready => {
  if (ready) {
    runAllTests()
      .then(success => process.exit(success ? 0 : 1))
      .catch(error => {
        console.error(`${colors.red}Erreur: ${error.message}${colors.reset}`);
        process.exit(1);
      });
  } else {
    process.exit(1);
  }
});

