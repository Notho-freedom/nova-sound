# Backend Express - Guide Local

## Démarrage en local

### 1. Installation des dépendances

```bash
cd backend
npm install
```

### 2. Configuration des variables d'environnement

Créez un fichier `.env` dans le dossier `backend/` avec :

```bash
# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-google-oauth-client-secret

# Firebase Admin (optionnel)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# Stripe (optionnel)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...

# CORS (optionnel)
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3001

# Port (optionnel, par défaut 3001)
PORT=3001
```

### 3. Démarrage du serveur

**Mode développement (avec rechargement automatique) :**
```bash
npm run dev
```

**Mode production (après build) :**
```bash
npm run build
npm start
```

Le serveur démarre sur `http://localhost:3001`

### 4. Configuration du frontend

Dans le fichier `.env` à la racine du projet, configurez :

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 5. Test du backend

Testez que le backend fonctionne :

```bash
curl http://localhost:3001/api/health
```

Vous devriez recevoir :
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Scripts disponibles

- `npm run dev` : Démarre le serveur en mode développement avec rechargement automatique
- `npm run build` : Compile TypeScript vers JavaScript
- `npm start` : Démarre le serveur en mode production (nécessite un build préalable)
- `npm run lint` : Vérifie le code avec ESLint

## Routes disponibles

- `GET /api/health` : Health check
- `GET /api/config/firebase` : Configuration Firebase
- `GET /api/config/stripe` : Configuration Stripe
- `GET /api/config/auth` : Configuration OAuth
- `POST /api/auth/oauth/token` : Échange de code OAuth pour tokens
- `POST /api/storage/upload` : Upload de fichiers
- `GET /api/storage/files` : Liste des fichiers
- `POST /api/stripe/create-checkout-session` : Créer une session Stripe
- `GET /api/sync/status` : Statut de synchronisation
- `POST /api/sync/start` : Démarrer la synchronisation

## Déploiement sur Vercel

Le backend peut aussi être déployé sur Vercel :

```bash
cd backend
vercel --prod
```

Assurez-vous de configurer toutes les variables d'environnement dans le dashboard Vercel.
