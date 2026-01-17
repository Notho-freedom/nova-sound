#!/usr/bin/env node

/**
 * Script de validation des variables d'environnement
 * 
 * Usage: node scripts/validate-env.js [--check-all]
 * 
 * Vérifie que toutes les variables d'environnement requises sont définies
 * et valide leur format si possible.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });
dotenv.config({ path: join(__dirname, '..', '.env') });

// Environment variable definitions
const envDefinitions = {
  // Firebase Client Configuration (exposed via /api/config/firebase)
  firebaseClient: {
    required: [
      {
        key: 'FIREBASE_API_KEY',
        description: 'Firebase API Key (public)',
        validate: (val) => val && val.length > 20,
      },
      {
        key: 'FIREBASE_AUTH_DOMAIN',
        description: 'Firebase Auth Domain',
        validate: (val) => val && val.includes('.firebaseapp.com'),
      },
      {
        key: 'FIREBASE_PROJECT_ID',
        description: 'Firebase Project ID',
        validate: (val) => val && val.length > 0,
      },
      {
        key: 'FIREBASE_STORAGE_BUCKET',
        description: 'Firebase Storage Bucket',
        validate: (val) => val && (val.includes('.appspot.com') || val.includes('.firebasestorage.app')),
      },
      {
        key: 'FIREBASE_MESSAGING_SENDER_ID',
        description: 'Firebase Messaging Sender ID',
        validate: (val) => val && /^\d+$/.test(val),
      },
      {
        key: 'FIREBASE_APP_ID',
        description: 'Firebase App ID',
        validate: (val) => val && val.includes(':'),
      },
    ],
    optional: [],
  },
  // Firebase Admin SDK (server-side only)
  firebaseAdmin: {
    required: [
      {
        key: 'FIREBASE_CLIENT_EMAIL',
        description: 'Firebase Admin Client Email',
        validate: (val) => val && val.includes('@') && val.includes('.iam.gserviceaccount.com'),
      },
      {
        key: 'FIREBASE_PRIVATE_KEY',
        description: 'Firebase Admin Private Key',
        validate: (val) => val && val.includes('BEGIN PRIVATE KEY'),
      },
    ],
    optional: [
      {
        key: 'FIREBASE_PRIVATE_KEY_ID',
        description: 'Firebase Private Key ID',
        validate: (val) => !val || val.length > 20,
      },
      {
        key: 'FIREBASE_CLIENT_ID',
        description: 'Firebase Client ID',
        validate: (val) => !val || /^\d+$/.test(val),
      },
      {
        key: 'FIREBASE_TOKEN_URI',
        description: 'Firebase Token URI',
        validate: (val) => !val || val.startsWith('https://'),
      },
      {
        key: 'FIREBASE_AUTH_URI',
        description: 'Firebase Auth URI',
        validate: (val) => !val || val.startsWith('https://'),
      },
    ],
  },
  // Google OAuth
  googleOAuth: {
    required: [
      {
        key: 'GOOGLE_CLIENT_ID',
        description: 'Google OAuth Client ID',
        validate: (val) => val && val.includes('.apps.googleusercontent.com'),
      },
    ],
    optional: [
      {
        key: 'GOOGLE_CLIENT_SECRET',
        description: 'Google OAuth Client Secret',
        validate: (val) => !val || val.length > 10,
      },
      {
        key: 'GOOGLE_OAUTH_CLIENT_ID',
        description: 'Google OAuth Client ID (alias)',
        validate: (val) => !val || val.includes('.apps.googleusercontent.com'),
      },
      {
        key: 'GOOGLE_OAUTH_CLIENT_SECRET',
        description: 'Google OAuth Client Secret (alias)',
        validate: (val) => !val || val.length > 10,
      },
    ],
  },
  // Stripe
  stripe: {
    required: [],
    optional: [
      {
        key: 'STRIPE_PUBLISHABLE_KEY',
        description: 'Stripe Publishable Key',
        validate: (val) => !val || val.startsWith('pk_'),
      },
      {
        key: 'STRIPE_SECRET_KEY',
        description: 'Stripe Secret Key',
        validate: (val) => !val || val.startsWith('sk_'),
      },
      {
        key: 'STRIPE_PRICE_PRO_MONTHLY',
        description: 'Stripe Pro Monthly Price ID',
        validate: (val) => !val || val.startsWith('price_'),
      },
      {
        key: 'STRIPE_PRICE_PRO_YEARLY',
        description: 'Stripe Pro Yearly Price ID',
        validate: (val) => !val || val.startsWith('price_'),
      },
    ],
  },
  // Storage providers
  storage: {
    required: [],
    optional: [
      {
        key: 'BUNNY_STORAGE_NAME',
        description: 'Bunny Storage Zone Name',
        validate: (val) => !val || val.length > 0,
      },
      {
        key: 'BUNNY_API_KEY',
        description: 'Bunny API Key',
        validate: (val) => !val || val.length > 20,
      },
      {
        key: 'BUNNY_CDN_URL',
        description: 'Bunny CDN URL',
        validate: (val) => !val || val.startsWith('https://'),
      },
      {
        key: 'PLANETHOSTER_SFTP_HOST',
        description: 'PlanetHoster SFTP Host',
        validate: (val) => !val || val.length > 0,
      },
      {
        key: 'PLANETHOSTER_SFTP_PORT',
        description: 'PlanetHoster SFTP Port',
        validate: (val) => !val || (parseInt(val, 10) >= 1 && parseInt(val, 10) <= 65535),
      },
      {
        key: 'PLANETHOSTER_SFTP_USER',
        description: 'PlanetHoster SFTP Username',
        validate: (val) => !val || val.length > 0,
      },
      {
        key: 'PLANETHOSTER_CDN_URL',
        description: 'PlanetHoster CDN URL',
        validate: (val) => !val || val.startsWith('https://'),
      },
      {
        key: 'STORAGE_DIR',
        description: 'Local Storage Directory',
        validate: (val) => !val || val.length > 0,
      },
    ],
  },
  // URLs and other
  urls: {
    required: [],
    optional: [
      {
        key: 'VERCEL_URL',
        description: 'Vercel Deployment URL',
        validate: (val) => !val || val.startsWith('https://'),
      },
      {
        key: 'UPDATE_BASE_URL',
        description: 'Update Server Base URL',
        validate: (val) => !val || val.startsWith('http'),
      },
      {
        key: 'API_URL',
        description: 'API URL',
        validate: (val) => !val || val.startsWith('http'),
      },
      {
        key: 'NEXT_PUBLIC_API_URL',
        description: 'Next.js Public API URL',
        validate: (val) => !val || val.startsWith('http'),
      },
    ],
  },
  // Observability
  observability: {
    required: [],
    optional: [
      {
        key: 'SENTRY_DSN',
        description: 'Sentry DSN (server/electron)',
        validate: (val) => !val || val.startsWith('https://'),
      },
      {
        key: 'NEXT_PUBLIC_SENTRY_DSN',
        description: 'Sentry DSN (client)',
        validate: (val) => !val || val.startsWith('https://'),
      },
    ],
  },
  // Search (Meilisearch)
  search: {
    required: [],
    optional: [
      {
        key: 'MEILI_HOST',
        description: 'Meilisearch Host URL',
        validate: (val) => !val || val.startsWith('http'),
      },
      {
        key: 'MEILISEARCH_HOST',
        description: 'Meilisearch Host URL (alias)',
        validate: (val) => !val || val.startsWith('http'),
      },
      {
        key: 'MEILI_API_KEY',
        description: 'Meilisearch API Key',
        validate: (val) => !val || val.length > 10,
      },
      {
        key: 'MEILISEARCH_API_KEY',
        description: 'Meilisearch API Key (alias)',
        validate: (val) => !val || val.length > 10,
      },
      {
        key: 'MEILI_INDEX_PREFIX',
        description: 'Meilisearch Index Prefix',
        validate: (val) => !val || val.length > 0,
      },
      {
        key: 'MEILISEARCH_INDEX_PREFIX',
        description: 'Meilisearch Index Prefix (alias)',
        validate: (val) => !val || val.length > 0,
      },
    ],
  },
};

function validateVariable(def, checkAll = false) {
  const value = process.env[def.key];
  const isSet = value !== undefined && value !== '';
  const isValid = isSet && (!def.validate || def.validate(value));

  return {
    ...def,
    isSet,
    isValid,
    value: isSet ? (def.key.includes('KEY') || def.key.includes('SECRET') ? '***' : value) : undefined,
    shouldWarn: checkAll || def.required,
  };
}

function checkEnvSection(section, sectionName, checkAll = false) {
  const results = {
    required: section.required.map(def => validateVariable(def, checkAll)),
    optional: section.optional.map(def => validateVariable(def, checkAll)),
  };

  const requiredIssues = results.required.filter(r => !r.isSet || !r.isValid);
  const optionalIssues = results.optional.filter(r => r.isSet && !r.isValid);

  return {
    results,
    requiredIssues,
    optionalIssues,
    sectionName,
  };
}

function printResults(checkResult) {
  const { results, requiredIssues, optionalIssues, sectionName } = checkResult;

  console.log(`\n${colors.cyan}=== ${sectionName} ===${colors.reset}\n`);

  // Required variables
  if (results.required.length > 0) {
    console.log(`${colors.blue}Required:${colors.reset}`);
    results.required.forEach((result) => {
      if (result.isSet && result.isValid) {
        console.log(`  ${colors.green}✓${colors.reset} ${result.key} - ${result.description}`);
      } else if (result.isSet && !result.isValid) {
        console.log(`  ${colors.yellow}⚠${colors.reset} ${result.key} - ${result.description} (format invalide)`);
      } else {
        console.log(`  ${colors.red}✗${colors.reset} ${result.key} - ${result.description} (manquant)`);
      }
    });
  }

  // Optional variables
  if (results.optional.length > 0) {
    console.log(`${colors.blue}Optional:${colors.reset}`);
    results.optional.forEach((result) => {
      if (!result.isSet) {
        console.log(`  ${colors.yellow}○${colors.reset} ${result.key} - ${result.description} (non défini)`);
      } else if (result.isValid) {
        console.log(`  ${colors.green}✓${colors.reset} ${result.key} - ${result.description}`);
      } else {
        console.log(`  ${colors.yellow}⚠${colors.reset} ${result.key} - ${result.description} (format invalide)`);
      }
    });
  }

  return {
    requiredIssues,
    optionalIssues,
  };
}

function main() {
  const checkAll = process.argv.includes('--check-all');

  console.log(`${colors.cyan}🔍 Validation des variables d'environnement${colors.reset}`);
  console.log(`${colors.blue}Fichiers vérifiés: .env.local, .env${colors.reset}`);

  // Check all sections
  const sections = [
    { def: envDefinitions.firebaseClient, name: '🔥 Firebase Client (via /api/config/firebase)' },
    { def: envDefinitions.firebaseAdmin, name: '🔐 Firebase Admin SDK' },
    { def: envDefinitions.googleOAuth, name: '🔑 Google OAuth' },
    { def: envDefinitions.stripe, name: '💳 Stripe' },
    { def: envDefinitions.storage, name: '📦 Storage Providers' },
    { def: envDefinitions.urls, name: '🌐 URLs' },
    { def: envDefinitions.observability, name: '📈 Observability' },
    { def: envDefinitions.search, name: '🔎 Search (Meilisearch)' },
  ];

  let totalRequiredIssues = 0;
  let totalOptionalIssues = 0;

  sections.forEach(({ def, name }) => {
    const checkResult = checkEnvSection(def, name, checkAll);
    const issues = printResults(checkResult);
    totalRequiredIssues += issues.requiredIssues.length;
    totalOptionalIssues += issues.optionalIssues.length;
  });

  // Summary
  console.log(`\n${colors.cyan}=== Résumé ===${colors.reset}\n`);

  if (totalRequiredIssues === 0 && totalOptionalIssues === 0) {
    console.log(`${colors.green}✓ Toutes les variables sont correctement configurées!${colors.reset}\n`);
    process.exit(0);
  } else {
    if (totalRequiredIssues > 0) {
      console.log(`${colors.red}✗ ${totalRequiredIssues} variable(s) requise(s) manquante(s) ou invalide(s)${colors.reset}`);
    }
    if (totalOptionalIssues > 0) {
      console.log(`${colors.yellow}⚠ ${totalOptionalIssues} variable(s) optionnelle(s) avec format invalide${colors.reset}`);
    }
    console.log(`\n${colors.blue}💡 Conseil: Copiez env.example vers .env.local et remplissez les valeurs${colors.reset}\n`);
    process.exit(totalRequiredIssues > 0 ? 1 : 0);
  }
}

main();
