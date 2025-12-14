#!/usr/bin/env node

/**
 * Script de test spécifique pour les routes API d'update
 * Usage: node scripts/test-update-routes.mjs [--url=http://localhost:3000]
 */

const BASE_URL = process.env.API_BASE_URL || process.argv.find(arg => arg.startsWith('--url='))?.split('=')[1] || 'http://localhost:3000';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

let testsPassed = 0;
let testsFailed = 0;

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testRoute(name, method, path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  try {
    log(`\n${'─'.repeat(60)}`, 'cyan');
    log(`🧪 Test: ${name}`, 'blue');
    log(`   ${method} ${path}`, 'cyan');
    
    const fetchOptions = {
      method,
      headers,
      ...(options.body && { body: JSON.stringify(options.body) }),
    };

    const startTime = Date.now();
    const response = await fetch(url, fetchOptions);
    const duration = Date.now() - startTime;
    
    const status = response.status;
    const statusText = response.statusText;
    const contentType = response.headers.get('content-type');
    
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else if (contentType && contentType.includes('application/zip')) {
      const blob = await response.blob();
      data = {
        type: 'zip',
        size: blob.size,
        message: `Fichier ZIP de ${(blob.size / 1024 / 1024).toFixed(2)} MB`,
      };
    } else {
      data = await response.text();
    }

    const isSuccess = status >= 200 && status < 300;
    const statusColor = isSuccess ? 'green' : 'red';
    
    log(`   Status: ${status} ${statusText} (${duration}ms)`, statusColor);
    
    if (isSuccess) {
      if (typeof data === 'object' && !data.type) {
        log(`   Response:`, 'cyan');
        console.log(JSON.stringify(data, null, 2).substring(0, 500));
      } else if (data.type === 'zip') {
        log(`   ${data.message}`, 'green');
      } else {
        log(`   Response: ${String(data).substring(0, 200)}`, 'cyan');
      }
      testsPassed++;
      return { success: true, status, data };
    } else {
      log(`   Error: ${JSON.stringify(data).substring(0, 200)}`, 'red');
      testsFailed++;
      return { success: false, status, data };
    }
  } catch (error) {
    log(`   ❌ Erreur: ${error.message}`, 'red');
    testsFailed++;
    return { success: false, error: error.message };
  }
}

async function waitForServer(maxAttempts = 10) {
  log('\n⏳ Attente du serveur...', 'yellow');
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`).catch(() => null);
      if (response && response.ok) {
        log('✓ Serveur prêt\n', 'green');
        return true;
      }
    } catch (error) {
      // Serveur pas encore prêt
    }
    process.stdout.write('.');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  log('\n⚠ Serveur non disponible', 'yellow');
  log('   Le serveur doit être démarré avec: npm run dev', 'yellow');
  log('   Ou utilisez --url=<url> pour tester une URL distante\n', 'yellow');
  return false;
}

async function runUpdateTests() {
  log('\n' + '='.repeat(60), 'magenta');
  log('🚀 TEST DES ROUTES API D\'UPDATE', 'magenta');
  log('='.repeat(60), 'magenta');
  log(`Base URL: ${BASE_URL}`, 'cyan');

  const results = [];

  // Test 1: Route version
  log('\n📋 Test 1: Route /api/update/version', 'yellow');
  const versionResult = await testRoute(
    'GET /api/update/version',
    'GET',
    '/api/update/version'
  );
  results.push(versionResult);

  // Vérifier que la réponse contient les champs attendus
  if (versionResult.success && versionResult.data) {
    const requiredFields = ['version'];
    const missingFields = requiredFields.filter(field => !(field in versionResult.data));
    if (missingFields.length > 0) {
      log(`   ⚠ Champs manquants: ${missingFields.join(', ')}`, 'yellow');
    } else {
      log(`   ✓ Structure de réponse valide`, 'green');
    }
  }

  // Test 2: Route build (peut être long)
  log('\n📦 Test 2: Route /api/update/build', 'yellow');
  log('   ⚠ Ce test peut prendre du temps (téléchargement du ZIP)...', 'yellow');
  const buildResult = await testRoute(
    'GET /api/update/build',
    'GET',
    '/api/update/build'
  );
  results.push(buildResult);

  // Test 3: Route check (POST)
  log('\n🔍 Test 3: Route /api/update/check', 'yellow');
  const checkResult = await testRoute(
    'POST /api/update/check',
    'POST',
    '/api/update/check',
    {
      body: {
        currentVersion: '1.0.0',
        currentBuildNumber: 1234567890,
      },
    }
  );
  results.push(checkResult);

  // Test 4: Route check sans version (devrait retourner update disponible)
  log('\n🔍 Test 4: Route /api/update/check (sans version locale)', 'yellow');
  const checkNoVersionResult = await testRoute(
    'POST /api/update/check (no local version)',
    'POST',
    '/api/update/check',
    {
      body: {},
    }
  );
  results.push(checkNoVersionResult);

  // Résumé
  log('\n' + '='.repeat(60), 'magenta');
  log('📊 RÉSUMÉ DES TESTS', 'magenta');
  log('='.repeat(60), 'magenta');
  
  const total = results.length;
  const success = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  log(`\nTotal: ${total}`, 'cyan');
  log(`✓ Réussis: ${success}`, 'green');
  log(`✗ Échoués: ${failed}`, 'red');

  if (failed > 0) {
    log('\n⚠️ Tests échoués:', 'yellow');
    results.forEach((result, index) => {
      if (!result.success) {
        log(`   ${index + 1}. ${result.error || `Status ${result.status}`}`, 'red');
      }
    });
  }

  if (success === total) {
    log('\n✅ TOUS LES TESTS SONT PASSÉS!', 'green');
  } else {
    log('\n⚠️ Certains tests ont échoué', 'yellow');
    log('   Vérifiez que:', 'yellow');
    log('   - Le serveur Next.js est démarré (npm run dev)', 'yellow');
    log('   - Le build a été généré (npm run build)', 'yellow');
    log('   - local-ui/version.json existe', 'yellow');
  }

  log('\n' + '='.repeat(60) + '\n', 'magenta');

  return { success: failed === 0, results };
}

// Exécuter
async function main() {
  const serverReady = await waitForServer();
  
  if (!serverReady) {
    log('\n💡 Astuce: Vous pouvez tester une URL distante avec:', 'cyan');
    log('   node scripts/test-update-routes.mjs --url=https://your-app.vercel.app', 'cyan');
    process.exit(1);
  }

  const { success } = await runUpdateTests();
  process.exit(success ? 0 : 1);
}

main().catch((error) => {
  log(`\n❌ Erreur fatale: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

