#!/usr/bin/env node

/**
 * Script pour copier le build Next.js vers local-ui
 * À exécuter après le build Next.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chercher le build dans plusieurs emplacements possibles
const possiblePaths = [
  path.join(__dirname, '../.next/standalone'),
  path.join(__dirname, '../dist'),
  path.join(__dirname, '../.next'),
];

let distPath = null;
for (const possiblePath of possiblePaths) {
  if (fs.existsSync(possiblePath)) {
    distPath = possiblePath;
    break;
  }
}

const localUIPath = path.join(__dirname, '../local-ui');

// Vérifier si le build existe
if (!fs.existsSync(distPath)) {
  console.error('❌ Build Next.js non trouvé dans .next/standalone');
  console.error('   Assurez-vous d\'avoir exécuté "npm run build"');
  process.exit(1);
}

// Créer le dossier local-ui s'il n'existe pas
if (!fs.existsSync(localUIPath)) {
  fs.mkdirSync(localUIPath, { recursive: true });
}

// Copier le contenu du build
console.log('📦 Copie du build vers local-ui...');

// Supprimer l'ancien contenu (sauf version.json si présent)
if (fs.existsSync(localUIPath)) {
  const items = fs.readdirSync(localUIPath);
  for (const item of items) {
    if (item !== 'version.json' && item !== 'backup') {
      const itemPath = path.join(localUIPath, item);
      fs.rmSync(itemPath, { recursive: true, force: true });
    }
  }
}

// Copier les fichiers
function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const items = fs.readdirSync(src);
    for (const item of items) {
      copyRecursive(path.join(src, item), path.join(dest, item));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Copier le contenu de .next/standalone vers local-ui
const items = fs.readdirSync(distPath);
for (const item of items) {
  copyRecursive(path.join(distPath, item), path.join(localUIPath, item));
}

console.log('✅ Build copié vers local-ui avec succès');

