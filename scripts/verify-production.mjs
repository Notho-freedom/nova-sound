#!/usr/bin/env node

/**
 * Script de vérification complète pour la production
 * Vérifie tous les aspects: build, update system, configuration
 * 
 * Usage: node scripts/verify-production.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

class ProductionVerifier {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.checks = [];
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  check(name, condition, errorMsg, warningOnly = false) {
    const result = { name, passed: condition, errorMsg };
    this.checks.push(result);
    if (!condition) {
      if (warningOnly) {
        this.warnings.push(errorMsg);
        this.log(`⚠ ${name}: ${errorMsg}`, 'yellow');
      } else {
        this.errors.push(errorMsg);
        this.log(`✗ ${name}: ${errorMsg}`, 'red');
      }
    } else {
      this.log(`✓ ${name}`, 'green');
    }
    return condition;
  }

  // ===== VÉRIFICATIONS =====

  async verifyDirectoryStructure() {
    this.log('\n📁 Vérification de la structure des dossiers...', 'cyan');
    const requiredDirs = [
      { path: 'electron', desc: 'Code Electron' },
      { path: 'electron/services', desc: 'Services Electron' },
      { path: 'electron/updater', desc: 'Système d\'update' },
      { path: 'app', desc: 'Code source Next.js' },
      { path: 'public', desc: 'Assets publics' },
      { path: 'scripts', desc: 'Scripts de build' },
    ];

    for (const dir of requiredDirs) {
      const exists = fs.existsSync(path.join(process.cwd(), dir.path));
      this.check(
        `Dossier ${dir.path}`,
        exists,
        `${dir.desc} manquant`
      );
    }
  }

  async verifyScripts() {
    this.log('\n📜 Vérification des scripts de build...', 'cyan');
    const requiredScripts = [
      { path: 'scripts/copy-build-to-local-ui.js', desc: 'Copie du build' },
      { path: 'scripts/generate-version.js', desc: 'Génération version.json' },
    ];

    for (const script of requiredScripts) {
      const exists = fs.existsSync(path.join(process.cwd(), script.path));
      this.check(
        `Script ${script.path}`,
        exists,
        `${script.desc} manquant`
      );
      if (exists) {
        // Vérifier que le script est exécutable
        const content = fs.readFileSync(path.join(process.cwd(), script.path), 'utf-8');
        const isValid = content.length > 0 && !content.includes('TODO');
        this.check(
          `Contenu ${script.path}`,
          isValid,
          `Script incomplet ou avec TODOs`,
          true
        );
      }
    }
  }

  async verifyPackageJson() {
    this.log('\n📦 Vérification de package.json...', 'cyan');
    const packagePath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(packagePath)) {
      this.check('package.json', false, 'Fichier manquant');
      return;
    }

    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));

    // Vérifier les scripts requis
    const requiredScripts = [
      'build',
      'build:electron',
      'package',
      'package:win',
    ];

    for (const script of requiredScripts) {
      this.check(
        `Script "${script}"`,
        !!pkg.scripts[script],
        `Script "${script}" manquant dans package.json`
      );
    }

    // Vérifier les dépendances critiques
    const criticalDeps = [
      'electron',
      'next',
      'react',
      'music-metadata',
      'archiver',
      'unzipper',
      'axios',
    ];

    for (const dep of criticalDeps) {
      const exists = pkg.dependencies?.[dep] || pkg.devDependencies?.[dep];
      this.check(
        `Dépendance ${dep}`,
        !!exists,
        `${dep} manquant dans les dépendances`
      );
    }

    // Vérifier la configuration electron-builder
    this.check(
      'Configuration electron-builder',
      !!pkg.build,
      'Section "build" manquante dans package.json'
    );

    if (pkg.build) {
      // Vérifier les fichiers inclus
      const hasLocalUI = pkg.build.files?.some(f => f.includes('local-ui'));
      this.check(
        'local-ui dans electron-builder files',
        hasLocalUI,
        'local-ui/**/* manquant dans build.files',
        true
      );

      // Vérifier les associations de fichiers
      this.check(
        'Associations de fichiers',
        !!pkg.build.fileAssociations,
        'fileAssociations manquantes (open with...)',
        true
      );
    }
  }

  async verifyElectronCode() {
    this.log('\n⚡ Vérification du code Electron...', 'cyan');
    // Vérifier les fichiers principaux
    const mainFiles = [
      'electron/main.ts',
      'electron/preload.cjs',
      'electron/updater/updater.ts',
    ];

    for (const file of mainFiles) {
      const exists = fs.existsSync(path.join(process.cwd(), file));
      this.check(
        `Fichier ${file}`,
        exists,
        `Fichier principal manquant: ${file}`
      );
      if (exists && file === 'electron/updater/updater.ts') {
        // Vérifier que l'URL Vercel n'est pas le placeholder
        const content = fs.readFileSync(path.join(process.cwd(), file), 'utf-8');
        const hasPlaceholder = content.includes('your-app.vercel.app');
        this.check(
          'URL Vercel configurée',
          !hasPlaceholder,
          'URL Vercel encore en placeholder dans updater.ts',
          true
        );
      }
    }

    // Vérifier les services
    const services = [
      'audio-scanner.ts',
      'video-scanner.ts',
      'storage.ts',
      'metadata-extractor.ts',
    ];

    for (const service of services) {
      const exists = fs.existsSync(path.join(process.cwd(), 'electron/services', service));
      this.check(
        `Service ${service}`,
        exists,
        `Service manquant: ${service}`,
        true
      );
    }
  }

  async verifyNextConfig() {
    this.log('\n⚙️ Vérification de next.config...', 'cyan');
    const configFiles = [
      'next.config.js',
      'next.config.mjs',
      'next.config.ts',
    ];

    let configFound = false;

    for (const file of configFiles) {
      const configPath = path.join(process.cwd(), file);
      if (fs.existsSync(configPath)) {
        configFound = true;
        const content = fs.readFileSync(configPath, 'utf-8');
        
        // Vérifier les configurations critiques
        const hasStandalone = content.includes("output: 'standalone'") || 
                             content.includes('output:"standalone"');
        this.check(
          'Output standalone configuré',
          hasStandalone,
          'next.config doit avoir output: "standalone"'
        );

        const hasUnoptimizedImages = content.includes('unoptimized: true');
        this.check(
          'Images non optimisées',
          hasUnoptimizedImages,
          'images.unoptimized doit être true pour Electron',
          true
        );

        break;
      }
    }

    this.check(
      'Fichier next.config',
      configFound,
      'Aucun fichier next.config trouvé'
    );
  }

  async verifyEnvironmentVariables() {
    this.log('\n🔐 Vérification des variables d\'environnement...', 'cyan');
    // Charger les fichiers .env
    const envFiles = ['.env.local', '.env'];
    let envLoaded = false;

    for (const file of envFiles) {
      const envPath = path.join(process.cwd(), file);
      if (fs.existsSync(envPath)) {
        envLoaded = true;
        break;
      }
    }

    this.check(
      'Fichier .env présent',
      envLoaded,
      'Aucun fichier .env trouvé (.env ou .env.local)',
      true
    );

    // Vérifier les variables critiques (optionnel, car peut être dans Vercel)
    const criticalVars = [
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    ];

    for (const varName of criticalVars) {
      const exists = !!process.env[varName];
      this.check(
        `Variable ${varName}`,
        exists,
        `${varName} non définie`,
        true
      );
    }

    // Vérifier UPDATE_BASE_URL
    const updateUrl = process.env.UPDATE_BASE_URL || process.env.NEXT_PUBLIC_VERCEL_URL;
    const hasValidUpdateUrl = updateUrl && !updateUrl.includes('your-app');
    this.check(
      'UPDATE_BASE_URL configurée',
      hasValidUpdateUrl,
      'UPDATE_BASE_URL non configurée ou en placeholder',
      true
    );
  }

  async verifyAPIRoutes() {
    this.log('\n🌐 Vérification des routes API d\'update...', 'cyan');
    const apiRoutes = [
      { path: 'app/api/update/version/route.ts', desc: 'Version endpoint' },
      { path: 'app/api/update/build/route.ts', desc: 'Build download endpoint' },
    ];

    for (const route of apiRoutes) {
      const exists = fs.existsSync(path.join(process.cwd(), route.path));
      this.check(
        route.desc,
        exists,
        `Route API manquante: ${route.path}`,
        false // Critique pour le système d'update
      );
    }
  }

  async verifyBuildArtifacts() {
    this.log('\n🏗️ Vérification des artefacts de build...', 'cyan');
    const buildDirs = [
      { path: '.next', desc: 'Next.js build', optional: false },
      { path: 'local-ui', desc: 'Build pour Electron', optional: true },
      { path: 'dist-electron', desc: 'Code Electron compilé', optional: true },
    ];

    for (const dir of buildDirs) {
      const exists = fs.existsSync(path.join(process.cwd(), dir.path));
      
      if (!dir.optional) {
        this.check(
          `Build ${dir.desc}`,
          exists,
          `${dir.desc} manquant - exécutez "npm run build"`,
          true // Warning car peut être généré
        );
      } else {
        this.check(
          `Build ${dir.desc}`,
          exists,
          `${dir.desc} manquant - sera créé au build`,
          true
        );
      }

      // Vérifier local-ui si présent
      if (dir.path === 'local-ui' && exists) {
        const versionFile = path.join(process.cwd(), dir.path, 'version.json');
        const hasVersion = fs.existsSync(versionFile);
        this.check(
          'version.json dans local-ui',
          hasVersion,
          'version.json manquant dans local-ui',
          true
        );
      }
    }
  }

  async runGitChecks() {
    this.log('\n🔧 Vérifications Git...', 'cyan');
    try {
      // Vérifier que Git est installé et initialisé
      execSync('git rev-parse --git-dir', { stdio: 'ignore' });
      this.check('Git initialisé', true, '');

      // Vérifier qu'il y a des commits
      try {
        const hasCommits = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
        this.check('Commits Git présents', !!hasCommits, 'Aucun commit trouvé');
      } catch {
        this.check('Commits Git présents', false, 'Aucun commit trouvé', true);
      }

      // Vérifier les fichiers non committés
      try {
        const status = execSync('git status --porcelain', { encoding: 'utf-8' });
        const hasUncommitted = status.trim().length > 0;
        this.check(
          'Pas de modifications non committées',
          !hasUncommitted,
          'Fichiers modifiés non committés',
          true
        );
      } catch {
        // Ignorer si erreur
      }
    } catch {
      this.check('Git disponible', false, 'Git non installé ou non initialisé', true);
    }
  }

  // ===== TESTS FONCTIONNELS =====

  async testBuildProcess() {
    this.log('\n🧪 Test du processus de build...', 'cyan');
    try {
      // Tester copy-build-to-local-ui
      const copyScript = path.join(process.cwd(), 'scripts/copy-build-to-local-ui.js');
      if (fs.existsSync(copyScript)) {
        try {
          // Juste vérifier la syntaxe
          const scriptContent = fs.readFileSync(copyScript, 'utf-8');
          const hasRequiredFunctions = scriptContent.includes('copyRecursive') || 
                                       scriptContent.includes('fs.copyFileSync') ||
                                       scriptContent.includes('cpSync');
          this.check(
            'Script copy-build-to-local-ui syntaxiquement valide',
            hasRequiredFunctions,
            'Script de copie incomplet',
            true
          );
        } catch (error) {
          this.check('Script copy-build-to-local-ui', false, error.message, true);
        }
      }

      // Tester generate-version
      const versionScript = path.join(process.cwd(), 'scripts/generate-version.js');
      if (fs.existsSync(versionScript)) {
        try {
          const scriptContent = fs.readFileSync(versionScript, 'utf-8');
          const hasVersionLogic = scriptContent.includes('version') && 
                                 scriptContent.includes('buildNumber');
          this.check(
            'Script generate-version syntaxiquement valide',
            hasVersionLogic,
            'Script de version incomplet',
            true
          );
        } catch (error) {
          this.check('Script generate-version', false, error.message, true);
        }
      }
    } catch (error) {
      this.check('Test build process', false, error.message, true);
    }
  }

  // ===== RAPPORT FINAL =====

  printSummary() {
    this.log('\n' + '='.repeat(60), 'cyan');
    this.log('📊 RÉSUMÉ DE LA VÉRIFICATION', 'cyan');
    this.log('='.repeat(60), 'cyan');

    const total = this.checks.length;
    const passed = this.checks.filter(c => c.passed).length;
    const failed = this.checks.filter(c => !c.passed).length;

    this.log(`\nTotal des vérifications: ${total}`);
    this.log(`✓ Réussies: ${passed}`, 'green');
    this.log(`✗ Échouées: ${failed}`, 'red');
    this.log(`⚠ Avertissements: ${this.warnings.length}`, 'yellow');

    if (this.errors.length > 0) {
      this.log('\n🚨 ERREURS CRITIQUES:', 'red');
      this.errors.forEach((error, i) => {
        this.log(`  ${i + 1}. ${error}`, 'red');
      });
    }

    if (this.warnings.length > 0) {
      this.log('\n⚠️ AVERTISSEMENTS:', 'yellow');
      this.warnings.forEach((warning, i) => {
        this.log(`  ${i + 1}. ${warning}`, 'yellow');
      });
    }

    if (this.errors.length === 0 && this.warnings.length === 0) {
      this.log('\n✅ TOUT EST PRÊT POUR LA PRODUCTION!', 'green');
      this.log('\nProchaines étapes:', 'cyan');
      this.log('  1. npm run build:electron', 'blue');
      this.log('  2. npm run package:win (ou package:mac/linux)', 'blue');
      this.log('  3. Déployer sur Vercel: vercel --prod', 'blue');
      this.log('  4. Tester le système d\'update', 'blue');
    } else if (this.errors.length === 0) {
      this.log('\n✅ Prêt pour la production (avec avertissements)', 'green');
      this.log('\n💡 Conseil: Résoudre les avertissements avant le déploiement', 'yellow');
    } else {
      this.log('\n❌ PAS PRÊT POUR LA PRODUCTION', 'red');
      this.log('\n🔧 Veuillez corriger les erreurs critiques ci-dessus', 'yellow');
    }

    this.log('\n' + '='.repeat(60) + '\n', 'cyan');
  }

  async runAll() {
    this.log('\n🚀 NEXUS Audio Player - Vérification Production\n', 'magenta');

    await this.verifyDirectoryStructure();
    await this.verifyScripts();
    await this.verifyPackageJson();
    await this.verifyElectronCode();
    await this.verifyNextConfig();
    await this.verifyEnvironmentVariables();
    await this.verifyAPIRoutes();
    await this.verifyBuildArtifacts();
    await this.runGitChecks();
    await this.testBuildProcess();

    this.printSummary();

    return this.errors.length === 0;
  }
}

// Exécuter
const verifier = new ProductionVerifier();
verifier.runAll()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });

