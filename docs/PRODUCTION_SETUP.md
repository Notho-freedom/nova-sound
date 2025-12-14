# 🚀 Guide de Configuration Production - NEXUS Audio Player

## ✅ Modifications Effectuées

### 1. Routes API Améliorées

Les routes API d'update ont été améliorées avec :

- **`/api/update/version`** : 
  - Ajout de `dynamic = 'force-dynamic'` et `revalidate = 0`
  - Meilleure gestion des erreurs avec détails
  - Headers de cache optimisés (no-cache)

- **`/api/update/build`** :
  - Vérification de la taille du build (limite 100MB)
  - Gestion d'erreurs améliorée
  - Compression optimale

- **`/api/update/check`** (nouveau) :
  - Route optionnelle pour vérifier rapidement les mises à jour
  - Compare version et buildNumber
  - Retourne les détails sans télécharger le build

### 2. Configuration Electron-Builder

- ✅ Ajout de `local-ui/**/*` dans `package.json > build.files`
- Le dossier `local-ui` sera maintenant inclus dans les packages Electron

### 3. Configuration Next.js

- ✅ Headers CORS ajoutés pour les routes `/api/update/*`
- ✅ Configuration webpack améliorée pour Electron
- ✅ `output: 'standalone'` déjà présent ✓

### 4. Script de Vérification

- ✅ Création de `scripts/verify-production.mjs`
- Vérifie :
  - Structure des dossiers
  - Scripts de build
  - Configuration package.json
  - Code Electron
  - Configuration Next.js
  - Variables d'environnement
  - Routes API
  - Artefacts de build
  - Git

## 📋 Variables d'Environnement Requises

Créez un fichier `.env.local` avec :

```bash
# ===== SYSTÈME D'UPDATE (IMPORTANT) =====
UPDATE_BASE_URL=https://votre-app.vercel.app

# ===== FIREBASE (Requis) =====
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
# ... autres variables Firebase

# ===== STRIPE (Optionnel) =====
# ... variables Stripe si nécessaire
```

## 🔧 Actions Immédiates

### 1. Configurer l'URL Vercel

Dans `electron/updater/updater.ts`, l'URL par défaut est encore `https://your-app.vercel.app`.

**Solution** : Définir `UPDATE_BASE_URL` dans `.env.local` ou remplacer directement dans le code après le premier déploiement Vercel.

### 2. Vérifier la Configuration

```bash
# Lancer le script de vérification
node scripts/verify-production.mjs
```

### 3. Build et Test

```bash
# Build complet
npm run build:electron

# Vérifier que local-ui contient le build
ls -la local-ui/

# Tester le package
npm run package:win
```

### 4. Déployer sur Vercel

```bash
# Déploiement production
vercel --prod

# Vérifier les routes API
curl https://votre-app.vercel.app/api/update/version
curl -I https://votre-app.vercel.app/api/update/build
```

## 🎯 Checklist de Production

- [ ] Variables d'environnement configurées
- [ ] URL Vercel mise à jour
- [ ] `npm run build:electron` réussit
- [ ] `local-ui/version.json` généré
- [ ] Routes API testées sur Vercel
- [ ] `npm run package:win` crée l'installateur
- [ ] Système d'update testé end-to-end
- [ ] Script `verify-production.mjs` passe sans erreurs critiques

## 📚 Documentation Complémentaire

- [Guide de déploiement complet](./DEPLOYMENT_GUIDE.md) (si créé)
- [Système d'update offline-first](./OFFLINE_FIRST_UPDATER.md)
- [Configuration Vercel](./VERCEL_UPDATE_SETUP.md)

## ⚠️ Points d'Attention

1. **URL Vercel** : Doit être remplacée avant le premier déploiement
2. **Taille du build** : Limite de 100MB pour `/api/update/build`
3. **Variables d'environnement** : Ne jamais commiter `.env.local`
4. **Code signing** : Recommandé pour Windows/macOS en production

## 🐛 Troubleshooting

### Build échoue
```bash
rm -rf .next dist-electron local-ui node_modules
npm install
npm run build:electron
```

### Update ne fonctionne pas
```bash
# Vérifier l'URL
curl https://votre-app.vercel.app/api/update/version

# Vérifier les logs Electron
npm run electron -- --debug
```

---

**Dernière mise à jour** : Après analyse du système d'update et configurations de build

