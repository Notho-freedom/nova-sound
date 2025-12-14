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

// Créer local-ui dans plusieurs emplacements pour différentes utilisations:
// 1. .next/standalone/local-ui (pour Vercel - peut ne pas être accessible)
// 2. public/local-ui (pour Vercel - accessible depuis les routes API)
// 3. local-ui à la racine (pour développement local)
const standaloneLocalUIPath = path.join(__dirname, '../.next/standalone/local-ui');
const publicLocalUIPath = path.join(__dirname, '../public/local-ui');
const localUIPath = path.join(__dirname, '../local-ui');

// Vérifier si le build existe
if (!fs.existsSync(distPath)) {
  console.error('❌ Build Next.js non trouvé dans .next/standalone');
  console.error('   Assurez-vous d\'avoir exécuté "npm run build"');
  process.exit(1);
}

// Fonction pour copier récursivement (avec exclusion de dossiers)
function copyRecursive(src, dest, excludeDirs = []) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    // Vérifier si ce dossier doit être exclu
    const dirName = path.basename(src);
    if (excludeDirs.includes(dirName)) {
      return; // Ignorer ce dossier
    }
    
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const items = fs.readdirSync(src);
    for (const item of items) {
      // Vérifier si l'item doit être exclu
      if (!excludeDirs.includes(item)) {
        copyRecursive(path.join(src, item), path.join(dest, item), excludeDirs);
      }
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Fonction pour copier vers un dossier local-ui
function copyToLocalUI(targetPath, excludeDirs = []) {
  // Créer le dossier s'il n'existe pas
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }

  // Supprimer l'ancien contenu (sauf version.json si présent)
  if (fs.existsSync(targetPath)) {
    const items = fs.readdirSync(targetPath);
    for (const item of items) {
      if (item !== 'version.json' && item !== 'backup') {
        const itemPath = path.join(targetPath, item);
        fs.rmSync(itemPath, { recursive: true, force: true });
      }
    }
  }

  // Copier le contenu de .next/standalone vers local-ui
  const items = fs.readdirSync(distPath);
  for (const item of items) {
    // Exclure les dossiers spécifiés
    if (!excludeDirs.includes(item)) {
      copyRecursive(path.join(distPath, item), path.join(targetPath, item), excludeDirs);
    }
  }
}

// Copier vers .next/standalone/local-ui (pour Vercel - peut ne pas être accessible)
// IMPORTANT: Exclure 'local-ui' pour éviter la boucle infinie
if (fs.existsSync(path.join(__dirname, '../.next/standalone'))) {
  console.log('📦 Copie du build vers .next/standalone/local-ui (pour Vercel)...');
  copyToLocalUI(standaloneLocalUIPath, ['local-ui']); // Exclure local-ui pour éviter la boucle
  console.log('✅ Build copié vers .next/standalone/local-ui avec succès');
}

// Copier vers public/local-ui (pour Vercel - accessible depuis les routes API)
console.log('📦 Copie du build vers public/local-ui (pour Vercel API routes)...');
copyToLocalUI(publicLocalUIPath, []); // Pas de local-ui dans public, pas besoin d'exclure
console.log('✅ Build copié vers public/local-ui avec succès');

// Copier vers local-ui à la racine (pour développement local)
console.log('📦 Copie du build vers local-ui (pour développement local)...');
copyToLocalUI(localUIPath, []); // Pas besoin d'exclure à la racine
console.log('✅ Build copié vers local-ui avec succès');

