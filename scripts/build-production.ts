#!/usr/bin/env tsx
/**
 * Script de build de production pour NEXUS Audio Player
 * 
 * Ce script :
 * 1. Vérifie les variables d'environnement requises
 * 2. Build l'application Next.js
 * 3. Compile le code Electron
 * 4. Crée l'installateur avec electron-builder
 * 
 * Usage:
 *   npm run build:prod
 *   ou
 *   npx tsx scripts/build-production.ts
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.production' });

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
];

const OPTIONAL_ENV_VARS = [
  'BUNNY_STORAGE_NAME',
  'BUNNY_API_KEY',
  'PLANETHOSTER_SFTP_HOST',
  'PLANETHOSTER_SFTP_USER',
];

function checkEnvVars() {
  console.log('🔍 Vérification des variables d\'environnement...\n');
  
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  for (const varName of OPTIONAL_ENV_VARS) {
    if (!process.env[varName]) {
      warnings.push(varName);
    }
  }

  if (missing.length > 0) {
    console.error('❌ Variables d\'environnement manquantes (requises):');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\n💡 Créez un fichier .env.local ou .env.production avec ces variables.');
    console.error('   Voir env.example pour un exemple.\n');
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn('⚠️  Variables d\'environnement manquantes (optionnelles):');
    warnings.forEach(v => console.warn(`   - ${v}`));
    console.warn('   Certaines fonctionnalités peuvent ne pas être disponibles.\n');
  }

  console.log('✅ Toutes les variables requises sont présentes.\n');
}

function checkNodeVersion() {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 18) {
    console.error(`❌ Node.js version ${nodeVersion} détectée. Version 18+ requise.`);
    process.exit(1);
  }
  
  console.log(`✅ Node.js ${nodeVersion} détecté.\n`);
}

function runCommand(command: string, description: string) {
  console.log(`📦 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit', cwd: process.cwd() });
    console.log(`✅ ${description} terminé.\n`);
  } catch (error) {
    console.error(`❌ Erreur lors de ${description.toLowerCase()}:`, error);
    process.exit(1);
  }
}

function getVersion(): string {
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
    return packageJson.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

function main() {
  console.log('🚀 Build de production NEXUS Audio Player\n');
  console.log('=' .repeat(50) + '\n');

  // Check Node version
  checkNodeVersion();

  // Check environment variables
  checkEnvVars();

  const version = getVersion();
  console.log(`📌 Version: ${version}\n`);

  // Set production environment
  process.env.NODE_ENV = 'production';
  process.env.NEXT_PUBLIC_NODE_ENV = 'production';

  // Build steps
  console.log('🔨 Démarrage du build de production...\n');

  // 1. Clean previous builds
  console.log('🧹 Nettoyage des builds précédents...');
  try {
    if (existsSync('.next')) {
      execSync('rm -rf .next', { stdio: 'inherit' });
    }
    if (existsSync('dist-electron')) {
      execSync('rm -rf dist-electron', { stdio: 'inherit' });
    }
    if (existsSync('dist')) {
      execSync('rm -rf dist', { stdio: 'inherit' });
    }
    console.log('✅ Nettoyage terminé.\n');
  } catch (error) {
    console.warn('⚠️  Erreur lors du nettoyage (peut être ignoré):', error);
  }

  // 2. Install dependencies (if needed)
  if (!existsSync('node_modules')) {
    runCommand('npm install', 'Installation des dépendances');
  }

  // 3. Build Next.js
  runCommand('npm run build', 'Build Next.js');

  // 4. Build Electron
  runCommand('npm run build:electron', 'Compilation Electron');

  // 5. Package with electron-builder
  const platform = process.platform;
  let packageCommand = 'npm run package';
  
  if (platform === 'win32') {
    packageCommand = 'npm run package:win';
  } else if (platform === 'darwin') {
    packageCommand = 'npm run package:mac';
  } else if (platform === 'linux') {
    packageCommand = 'npm run package:linux';
  }

  runCommand(packageCommand, 'Création de l\'installateur');

  console.log('=' .repeat(50));
  console.log('✅ Build de production terminé avec succès!');
  console.log('=' .repeat(50));
  console.log('\n📦 L\'installateur se trouve dans le dossier dist/');
  console.log('\n📝 Prochaines étapes:');
  console.log('   1. Testez l\'installateur sur une machine propre');
  console.log('   2. Configurez le webhook Stripe:');
  console.log('      - URL: https://votre-domaine.com/api/stripe/webhook');
  console.log('      - Événements: checkout.session.completed, customer.subscription.*, invoice.payment_succeeded');
  console.log('   3. Déployez l\'application\n');
}

main();
