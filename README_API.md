# API Routes Next.js

Le serveur backend est maintenant intégré directement dans Next.js via les API Routes.

## Routes disponibles

### Health Check
- `GET /api/health` - Vérification de l'état du serveur

### Storage
- `POST /api/storage/upload` - Upload de fichier
- `GET /api/storage/download/[fileId]` - Téléchargement de fichier
- `GET /api/storage/files` - Liste des fichiers
- `DELETE /api/storage/files/[fileId]` - Suppression de fichier

### Stripe
- `POST /api/stripe/create-checkout-session` - Créer une session de checkout
- `POST /api/stripe/create-portal-session` - Créer une session de portail de facturation
- `GET /api/stripe/subscription-status` - Statut de l'abonnement

### Sync
- `GET /api/sync/status` - Statut de synchronisation
- `POST /api/sync/start` - Démarrer la synchronisation

## Authentification

Toutes les routes (sauf `/api/health`) nécessitent une authentification via un token Bearer dans le header `Authorization`:

```
Authorization: Bearer <token>
```

Le token est vérifié via Google OAuth (ID token ou access token).

## Variables d'environnement

Les variables suivantes doivent être définies dans `.env`:

```env
GOOGLE_CLIENT_ID=your_google_client_id
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PRICE_PRO_MONTHLY=price_id_monthly
STRIPE_PRICE_PRO_YEARLY=price_id_yearly
STORAGE_DIR=./storage
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
```

## Migration depuis le serveur Express

Le serveur Express séparé (`server/`) n'est plus nécessaire. Toutes les routes ont été migrées vers Next.js API Routes dans `app/api/`.

Les appels API dans `src/services/nexus-server.ts` utilisent maintenant les routes Next.js (même origine, pas besoin de base URL).

