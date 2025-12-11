# Backend NEXUS Audio

Backend API complet pour NEXUS Audio Player.

## 🚀 Démarrage rapide

### 1. Installation

```bash
cd server
npm install
```

### 2. Configuration

Créez un fichier `.env` dans le dossier `server/` :

```bash
cp server/.env.example server/.env
```

Configurez les variables suivantes dans `server/.env` :

```env
PORT=3000
FRONTEND_URL=http://localhost:5173
GOOGLE_CLIENT_ID=votre-client-id-google.apps.googleusercontent.com
STRIPE_SECRET_KEY=sk_test_votre_cle_secrete
STRIPE_PRICE_PRO_MONTHLY=price_votre_id_mensuel
STRIPE_PRICE_PRO_YEARLY=price_votre_id_annuel
STORAGE_DIR=./storage
```

### 3. Démarrage

**Mode développement** (avec hot-reload) :
```bash
npm run dev:backend
```

**Mode production** :
```bash
cd server
npm run build
npm start
```

**Démarrer frontend + backend + Electron** :
```bash
npm run dev:all
```

## 📡 Endpoints API

### Authentification
Tous les endpoints (sauf `/health`) nécessitent un header :
```
Authorization: Bearer <access_token>
```

### Stripe

#### Créer une session de checkout
```http
POST /api/stripe/create-checkout-session
Content-Type: application/json
Authorization: Bearer <token>

{
  "priceId": "price_xxx",
  "successUrl": "http://localhost:5173/settings?success=true",
  "cancelUrl": "http://localhost:5173/settings?canceled=true"
}
```

#### Créer une session du portail client
```http
POST /api/stripe/create-portal-session
Content-Type: application/json
Authorization: Bearer <token>

{
  "returnUrl": "http://localhost:5173/settings"
}
```

#### Obtenir le statut d'abonnement
```http
GET /api/stripe/subscription-status
Authorization: Bearer <token>
```

#### Traiter le succès du checkout
```http
POST /api/stripe/checkout-success
Content-Type: application/json
Authorization: Bearer <token>

{
  "sessionId": "cs_test_xxx"
}
```

### Storage

#### Uploader un fichier
```http
POST /api/storage/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <fichier>
```

#### Télécharger un fichier
```http
GET /api/storage/download/:fileId
Authorization: Bearer <token>
```

#### Lister les fichiers
```http
GET /api/storage/files
Authorization: Bearer <token>
```

#### Supprimer un fichier
```http
DELETE /api/storage/files/:fileId
Authorization: Bearer <token>
```

### Sync

#### Obtenir le statut de synchronisation
```http
GET /api/sync/status
Authorization: Bearer <token>
```

#### Démarrer la synchronisation
```http
POST /api/sync/start
Authorization: Bearer <token>
```

## 🔧 Configuration Stripe

1. Créez un compte Stripe : https://dashboard.stripe.com
2. Obtenez votre clé secrète : https://dashboard.stripe.com/apikeys
3. Créez des produits et prix :
   - Allez dans Products > Add product
   - Créez "NEXUS Pro Monthly" et "NEXUS Pro Yearly"
   - Copiez les Price IDs (commencent par `price_`)
4. Ajoutez les Price IDs dans `server/.env`

## 🔐 Authentification

Le backend vérifie les tokens Google OAuth (ID tokens ou access tokens) pour authentifier les requêtes.

## 📁 Stockage

Les fichiers sont stockés dans `server/storage/users/<userId>/` par défaut.

## 🐛 Dépannage

### Erreur 401 "Invalid or expired token"
- Vérifiez que `GOOGLE_CLIENT_ID` dans `server/.env` correspond à celui du frontend
- Vérifiez que le token est bien envoyé dans le header `Authorization: Bearer <token>`

### Erreur 404 sur les endpoints
- Vérifiez que le serveur est bien démarré (`npm run dev:backend`)
- Vérifiez que `VITE_API_URL` dans `.env` (racine) pointe vers `http://localhost:3000`

### Erreur Stripe
- Vérifiez que `STRIPE_SECRET_KEY` est correcte
- Vérifiez que les Price IDs sont valides dans votre compte Stripe

