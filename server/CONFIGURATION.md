# Configuration du Backend NEXUS

## Fichier `.env` requis

Créez un fichier `.env` dans le dossier `server/` avec les variables suivantes :

```env
# Port du serveur (par défaut: 3001)
PORT=3001

# URL du frontend (pour CORS)
FRONTEND_URL=http://localhost:5173

# Google OAuth Client ID (même que dans le .env racine)
GOOGLE_CLIENT_ID=votre-client-id-google.apps.googleusercontent.com

# Stripe Configuration (OBLIGATOIRE pour les abonnements)
STRIPE_SECRET_KEY=sk_test_votre_cle_secrete_stripe
STRIPE_PRICE_PRO_MONTHLY=price_votre_id_mensuel
STRIPE_PRICE_PRO_YEARLY=price_votre_id_annuel

# Répertoire de stockage (optionnel, défaut: ./storage)
STORAGE_DIR=./storage
```

## Configuration Stripe

### 1. Créer un compte Stripe

1. Allez sur https://dashboard.stripe.com
2. Créez un compte (ou connectez-vous)
3. Passez en mode Test pour le développement

### 2. Obtenir votre clé secrète

1. Dans le dashboard Stripe, allez dans **Developers** > **API keys**
2. Copiez la **Secret key** (commence par `sk_test_` pour le mode test)
3. Ajoutez-la dans `server/.env` comme `STRIPE_SECRET_KEY`

### 3. Créer les produits et prix

1. Allez dans **Products** > **Add product**
2. Créez un produit "NEXUS Pro Monthly" :
   - Type: Recurring
   - Billing period: Monthly
   - Price: 9.99€ (ou votre prix)
   - Copiez le **Price ID** (commence par `price_`)
   - Ajoutez-le dans `server/.env` comme `STRIPE_PRICE_PRO_MONTHLY`

3. Créez un produit "NEXUS Pro Yearly" :
   - Type: Recurring
   - Billing period: Yearly
   - Price: 99.99€ (ou votre prix)
   - Copiez le **Price ID** (commence par `price_`)
   - Ajoutez-le dans `server/.env` comme `STRIPE_PRICE_PRO_YEARLY`

### 4. Vérifier la configuration

Après avoir créé `server/.env` avec toutes les variables, redémarrez le serveur backend :

```bash
npm run dev:backend
```

Le serveur devrait démarrer sans erreur et Stripe sera configuré.

## Configuration Google OAuth

Le `GOOGLE_CLIENT_ID` doit être le même que celui configuré dans le `.env` à la racine du projet (`VITE_GOOGLE_OAUTH_CLIENT_ID`).

## Dépannage

### Erreur "Stripe is not configured"
- Vérifiez que `STRIPE_SECRET_KEY` est défini dans `server/.env`
- Vérifiez que la clé commence par `sk_test_` (mode test) ou `sk_live_` (mode production)
- Redémarrez le serveur backend après avoir modifié `.env`

### Erreur 401 "Invalid or expired token"
- Vérifiez que `GOOGLE_CLIENT_ID` correspond à celui du frontend
- Vérifiez que l'utilisateur est bien authentifié

### Erreur 404 "Not found"
- Vérifiez que le serveur backend est bien démarré
- Vérifiez que `VITE_API_URL` dans le `.env` racine pointe vers le bon port (3001 par défaut)

