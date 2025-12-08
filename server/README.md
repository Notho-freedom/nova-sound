# NEXUS Audio Backend API

Backend API pour NEXUS Audio Player, gérant Stripe, le stockage et la synchronisation.

## Installation

```bash
cd server
npm install
```

## Configuration

1. Copiez `.env.example` vers `.env` :
```bash
cp .env.example .env
```

2. Configurez les variables d'environnement dans `.env` :
- `PORT` : Port du serveur (défaut: 3000)
- `FRONTEND_URL` : URL du frontend (pour CORS)
- `GOOGLE_CLIENT_ID` : Client ID OAuth Google (même que le frontend)
- `STRIPE_SECRET_KEY` : Clé secrète Stripe
- `STRIPE_PRICE_PRO_MONTHLY` : ID du prix mensuel Pro
- `STRIPE_PRICE_PRO_YEARLY` : ID du prix annuel Pro
- `STORAGE_DIR` : Répertoire de stockage des fichiers

## Démarrage

### Mode développement
```bash
npm run dev
```

### Mode production
```bash
npm run build
npm start
```

## Endpoints API

### Stripe
- `POST /api/stripe/create-checkout-session` - Créer une session de checkout
- `POST /api/stripe/create-portal-session` - Créer une session du portail client
- `GET /api/stripe/subscription-status` - Obtenir le statut d'abonnement
- `POST /api/stripe/checkout-success` - Traiter le succès du checkout

### Storage
- `POST /api/storage/upload` - Uploader un fichier
- `GET /api/storage/download/:fileId` - Télécharger un fichier
- `GET /api/storage/files` - Lister les fichiers
- `DELETE /api/storage/files/:fileId` - Supprimer un fichier

### Sync
- `GET /api/sync/status` - Obtenir le statut de synchronisation
- `POST /api/sync/start` - Démarrer la synchronisation

## Authentification

Tous les endpoints (sauf `/health`) nécessitent un token d'authentification dans le header :
```
Authorization: Bearer <access_token>
```

Le token est vérifié avec Google OAuth.

