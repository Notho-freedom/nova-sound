/**
 * Script de test pour toutes les routes API Next.js
 * Usage: node scripts/test-api-routes.mjs
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// Token de test (à remplacer par un vrai token pour les tests complets)
const TEST_TOKEN = process.env.TEST_TOKEN || 'test-token';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

async function testRoute(method, path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.token && { Authorization: `Bearer ${options.token}` }),
    ...options.headers,
  };

  try {
    const fetchOptions = {
      method,
      headers,
      ...(options.body && { body: JSON.stringify(options.body) }),
    };

    console.log(`\n${colors.blue}Testing: ${method} ${path}${colors.reset}`);
    
    const response = await fetch(url, fetchOptions);
    const status = response.status;
    const statusText = response.statusText;
    
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    const isSuccess = status >= 200 && status < 300;
    const color = isSuccess ? colors.green : colors.red;
    
    console.log(`${color}Status: ${status} ${statusText}${colors.reset}`);
    
    if (data && typeof data === 'object') {
      console.log(`Response:`, JSON.stringify(data, null, 2).substring(0, 200));
    } else if (data) {
      console.log(`Response: ${String(data).substring(0, 200)}`);
    }

    return { success: isSuccess, status, data };
  } catch (error) {
    console.log(`${colors.red}Error: ${error.message}${colors.reset}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log(`${colors.blue}=== Test des routes API Next.js ===${colors.reset}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test Token: ${TEST_TOKEN.substring(0, 20)}...`);

  const results = [];

  // 1. Health Check (pas d'auth requise)
  console.log(`\n${colors.yellow}--- Health Check ---${colors.reset}`);
  results.push(await testRoute('GET', '/api/health'));

  // 2. Storage Routes (auth requise)
  console.log(`\n${colors.yellow}--- Storage Routes ---${colors.reset}`);
  
  // Upload (nécessite FormData, test simplifié)
  console.log(`\n${colors.blue}Note: Upload nécessite FormData et un fichier réel${colors.reset}`);
  results.push(await testRoute('GET', '/api/storage/files', { token: TEST_TOKEN }));
  
  // Download (nécessite un fileId valide)
  console.log(`\n${colors.blue}Note: Download nécessite un fileId valide${colors.reset}`);
  results.push(await testRoute('GET', '/api/storage/download/test-file-id', { token: TEST_TOKEN }));

  // 3. Stripe Routes (auth requise)
  console.log(`\n${colors.yellow}--- Stripe Routes ---${colors.reset}`);
  
  // Subscription Status
  results.push(await testRoute('GET', '/api/stripe/subscription-status', { token: TEST_TOKEN }));
  
  // Create Checkout Session (nécessite priceId)
  results.push(await testRoute('POST', '/api/stripe/create-checkout-session', {
    token: TEST_TOKEN,
    body: {
      priceId: 'test-price-id',
      successUrl: 'http://localhost:3000/settings?success=true',
      cancelUrl: 'http://localhost:3000/settings?canceled=true',
    },
  }));
  
  // Create Portal Session
  results.push(await testRoute('POST', '/api/stripe/create-portal-session', {
    token: TEST_TOKEN,
    body: {
      returnUrl: 'http://localhost:3000/settings',
    },
  }));

  // 4. Sync Routes (auth requise)
  console.log(`\n${colors.yellow}--- Sync Routes ---${colors.reset}`);
  
  // Sync Status
  results.push(await testRoute('GET', '/api/sync/status', { token: TEST_TOKEN }));
  
  // Start Sync
  results.push(await testRoute('POST', '/api/sync/start', { token: TEST_TOKEN }));

  // Résumé
  console.log(`\n${colors.blue}=== Résumé des tests ===${colors.reset}`);
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  const failedCount = totalCount - successCount;

  console.log(`Total: ${totalCount}`);
  console.log(`${colors.green}Succès: ${successCount}${colors.reset}`);
  console.log(`${colors.red}Échecs: ${failedCount}${colors.reset}`);

  // Détails des échecs
  if (failedCount > 0) {
    console.log(`\n${colors.yellow}Note: Certains échecs sont attendus si:`);
    console.log(`- Le token d'authentification n'est pas valide`);
    console.log(`- Les variables d'environnement ne sont pas configurées`);
    console.log(`- Les ressources testées n'existent pas${colors.reset}`);
  }

  return { success: failedCount === 0, results };
}

// Exécuter les tests
runTests()
  .then(({ success }) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Erreur lors de l\'exécution des tests:', error);
    process.exit(1);
  });

