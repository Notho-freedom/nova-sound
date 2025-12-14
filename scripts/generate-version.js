#!/usr/bin/env node

/**
 * Script pour générer version.json dans le build
 * À exécuter après le build Next.js
 * Récupère les notes de commit Git pour le changelog
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, '../package.json');
const versionJsonPath = path.join(__dirname, '../local-ui/version.json');
const standaloneVersionJsonPath = path.join(__dirname, '../.next/standalone/local-ui/version.json');
const publicVersionJsonPath = path.join(__dirname, '../public/local-ui/version.json');

// Lire la version de base depuis package.json (optionnel, pour référence)
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const baseVersion = packageJson.version || '1.0.0';

// Générer un buildNumber unique (timestamp)
const buildNumber = Date.now();

// Utiliser le buildNumber comme version principale
// Format: {baseVersion}.{buildNumber} ou simplement {buildNumber}
// Exemple: 1.0.0.1765703056258 ou simplement 1765703056258
const version = `${baseVersion}.${buildNumber}`;

// Récupérer les commits récents pour le changelog
function getRecentCommits(limit = 10) {
  try {
    // Récupérer les derniers commits avec leurs messages
    const commits = execSync(
      `git log --pretty=format:"%h|%s|%an|%ad" --date=iso -n ${limit}`,
      { encoding: 'utf-8', cwd: path.join(__dirname, '..') }
    ).trim().split('\n').filter(Boolean);
    
    return commits.map(commit => {
      const [hash, message, author, date] = commit.split('|');
      return {
        hash: hash.substring(0, 7),
        message,
        author,
        date,
      };
    });
  } catch (error) {
    console.warn('⚠️  Impossible de récupérer les commits Git:', error.message);
    return [];
  }
}

// Récupérer le dernier commit pour le changelog principal
function getLatestCommitMessage() {
  try {
    const message = execSync(
      'git log -1 --pretty=format:"%s"',
      { encoding: 'utf-8', cwd: path.join(__dirname, '..') }
    ).trim();
    return message || 'Build automatique';
  } catch (error) {
    return 'Build automatique';
  }
}

// Récupérer la date du dernier commit
function getLatestCommitDate() {
  try {
    const date = execSync(
      'git log -1 --pretty=format:"%ai"',
      { encoding: 'utf-8', cwd: path.join(__dirname, '..') }
    ).trim();
    return date ? new Date(date).toISOString() : new Date().toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}

const latestCommitMessage = getLatestCommitMessage();
const latestCommitDate = getLatestCommitDate();
const recentCommits = getRecentCommits(5);

// Créer l'objet version
const versionInfo = {
  version, // Version complète: {baseVersion}.{buildNumber}
  baseVersion, // Version de base depuis package.json
  buildNumber, // Numéro de build unique (timestamp)
  buildDate: latestCommitDate,
  changelog: latestCommitMessage,
  commits: recentCommits,
};

// Fonction pour écrire version.json dans un emplacement
function writeVersionJson(targetPath) {
  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  fs.writeFileSync(targetPath, JSON.stringify(versionInfo, null, 2), 'utf-8');
}

// Écrire version.json dans local-ui (pour développement local)
writeVersionJson(versionJsonPath);

// Écrire version.json dans .next/standalone/local-ui (pour Vercel)
if (fs.existsSync(path.join(__dirname, '../.next/standalone'))) {
  writeVersionJson(standaloneVersionJsonPath);
  console.log(`✅ version.json créé dans .next/standalone/local-ui: ${version}`);
}

// Écrire version.json dans public/local-ui (pour Vercel - accessible depuis les routes API)
writeVersionJson(publicVersionJsonPath);
console.log(`✅ version.json créé dans public/local-ui: ${version}`);

console.log(`✅ version.json créé: ${version}`);
console.log(`   Build Number: ${buildNumber}`);
console.log(`   Base Version: ${baseVersion}`);
console.log(`   Changelog: ${latestCommitMessage}`);
console.log(`   Commits: ${recentCommits.length}`);
console.log(`   Chemin: ${versionJsonPath}`);

