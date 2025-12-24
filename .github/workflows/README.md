# GitHub Actions Workflows

Ce dossier contient les workflows GitHub Actions pour automatiser le CI/CD de NEXUS Audio Player.

## Workflows disponibles

### 🧪 Build and Test (`build.yml`)
**Déclencheurs:** Push/PR sur `main` et `develop`

- Exécute les tests TypeScript
- Build l'application Electron pour Windows
- Build la version web Next.js
- Archive les artifacts de build

### 🚀 Release (`release.yml`)
**Déclencheurs:** Push de tags `v*.*.*`

- Build de production complet
- Création automatique de release GitHub
- Upload des installateurs Windows (.exe)
- Génération des notes de version automatiques

### ✨ Code Quality (`quality.yml`)
**Déclencheurs:** Push/PR sur `main` et `develop`

- Vérification ESLint
- Vérification TypeScript
- Audit de sécurité npm
- Scan de vulnérabilités Snyk (optionnel)

### 🎨 Deploy Preview (`deploy-preview.yml`)
**Déclencheurs:** Pull requests

- Déploiement preview sur Vercel
- Commentaire automatique avec l'URL de preview
- Test de l'application en environnement de staging

### 📦 Deploy Production (`deploy-production.yml`)
**Déclencheurs:** Push sur `main`

- Déploiement automatique en production sur Vercel
- Notification de succès/échec
- Mise à jour du statut de commit

## Configuration requise

### Secrets GitHub nécessaires

#### Firebase (requis pour tous les builds)
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

#### Stripe (requis pour release)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

#### Vercel (requis pour deploy)
- `VERCEL_TOKEN` - Token d'API Vercel
- `VERCEL_ORG_ID` - ID de l'organisation
- `VERCEL_PROJECT_ID` - ID du projet

#### Snyk (optionnel, pour security scan)
- `SNYK_TOKEN` - Token d'API Snyk

## Utilisation

### Créer une release

1. Créer et pousser un tag de version:
```bash
git tag v1.0.0
git push origin v1.0.0
```

2. Le workflow `release.yml` se déclenche automatiquement
3. Une release GitHub est créée avec les installateurs

### Déployer un preview

1. Créer une pull request
2. Le workflow `deploy-preview.yml` déploie automatiquement
3. L'URL du preview est postée en commentaire

### Déployer en production

1. Merger vers `main`
2. Le workflow `deploy-production.yml` déploie automatiquement
3. L'application est mise à jour sur Vercel

## Statuts des workflows

Les badges de statut peuvent être ajoutés au README:

```markdown
![Build Status](https://github.com/Notho-freedom/nova-sound/workflows/Build%20and%20Test/badge.svg)
![Release Status](https://github.com/Notho-freedom/nova-sound/workflows/Release/badge.svg)
![Code Quality](https://github.com/Notho-freedom/nova-sound/workflows/Code%20Quality/badge.svg)
```
