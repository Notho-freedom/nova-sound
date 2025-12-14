# NEXUS Audio Backend API

Backend API séparé pour NEXUS Audio Player, déployé sur Vercel.

## Installation

```bash
cd backend
npm install
```

## Configuration

Copiez `.env.example` vers `.env` et remplissez les variables d'environnement :

```bash
cp .env.example .env
```

## Développement

```bash
npm run dev
```

Le serveur démarre sur `http://localhost:3001`

## Build

```bash
npm run build
```

## Déploiement sur Vercel

1. Connectez votre projet Vercel au dossier `backend/`
2. Configurez les variables d'environnement dans Vercel Dashboard
3. Déployez automatiquement via Git ou manuellement avec `vercel`

## Routes API

Toutes les routes API sont disponibles sous `/api/*` :

- `/api/health` - Health check
- `/api/config/*` - Configuration publique (Firebase, Stripe, Auth)
- `/api/storage/*` - Gestion des fichiers
- `/api/stripe/*` - Gestion des abonnements Stripe
- `/api/sync/*` - Synchronisation cloud
- `/api/update/*` - Mises à jour Electron
- `/api/admin/*` - Routes admin

## CORS

Le backend est configuré pour accepter les requêtes depuis :
- `file://` (Electron)
- `http://localhost:3000` (dev frontend)
- `http://localhost:5173` (dev Vite)

Pour la production, configurez `CORS_ORIGINS` dans les variables d'environnement Vercel.

