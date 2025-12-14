#!/usr/bin/env node

/**
 * Script pour générer le ZIP du build au moment du build
 * Le ZIP est placé dans public/updates/ pour être servi statiquement
 * SOLUTION PRO : Pas de ZIP dynamique, tout est généré au build
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chemins
const localUIPath = path.join(__dirname, '../local-ui');
const publicUpdatesPath = path.join(__dirname, '../public/updates');
const versionJsonPath = path.join(__dirname, '../local-ui/version.json');

// Vérifier que local-ui existe
if (!fs.existsSync(localUIPath)) {
  console.error('❌ local-ui non trouvé');
  console.error('   Assurez-vous d\'avoir exécuté "npm run build" et "npm run postbuild"');
  process.exit(1);
}

// Lire version.json pour nommer le ZIP
let version = '1.0.0';
let buildNumber = Date.now();
let zipFileName = 'nexus-build.zip';

if (fs.existsSync(versionJsonPath)) {
  try {
    const versionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
    version = versionData.version || '1.0.0';
    buildNumber = versionData.buildNumber || Date.now();
    // Nom du fichier : nexus-build-v1.0.0-{buildNumber}.zip
    zipFileName = `nexus-build-v${version}-${buildNumber}.zip`;
  } catch (error) {
    console.warn('⚠️  Impossible de lire version.json, utilisation du nom par défaut');
  }
}

// Créer le dossier public/updates s'il n'existe pas
if (!fs.existsSync(publicUpdatesPath)) {
  fs.mkdirSync(publicUpdatesPath, { recursive: true });
}

const zipPath = path.join(publicUpdatesPath, zipFileName);

// Supprimer l'ancien ZIP s'il existe (pour éviter les conflits)
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
  console.log(`🗑️  Ancien ZIP supprimé: ${zipFileName}`);
}

// Créer le ZIP
console.log(`📦 Création du ZIP du build...`);
console.log(`   Source: ${localUIPath}`);
console.log(`   Destination: ${zipPath}`);

const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', {
  zlib: { level: 9 } // Compression maximale
});

// Créer le ZIP de manière asynchrone
try {
  await new Promise((resolve, reject) => {
    output.on('close', () => {
      const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
      console.log(`✅ ZIP créé avec succès: ${zipFileName}`);
      console.log(`   Taille: ${sizeInMB} MB`);
      console.log(`   Chemin: ${zipPath}`);
      
      // Créer aussi un fichier latest.json avec les métadonnées
      const latestJsonPath = path.join(publicUpdatesPath, 'latest.json');
      const latestData = {
        version,
        buildNumber,
        zipFileName,
        zipUrl: `/updates/${zipFileName}`,
        buildDate: new Date().toISOString(),
      };
      fs.writeFileSync(latestJsonPath, JSON.stringify(latestData, null, 2), 'utf-8');
      console.log(`✅ latest.json créé: ${latestJsonPath}`);
      
      resolve(undefined);
    });

    archive.on('error', (err) => {
      console.error('❌ Erreur lors de la création du ZIP:', err);
      reject(err);
    });

    archive.pipe(output);
    
    // Ajouter tout le contenu de local-ui au ZIP
    archive.directory(localUIPath, false);
    archive.finalize();
  });
} catch (error) {
  console.error('❌ Erreur fatale lors de la génération du ZIP:', error);
  process.exit(1);
}

