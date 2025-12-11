# Configuration Firebase et Stripe

Ce guide vous explique comment configurer Firebase Authentication et Stripe pour NEXUS.

## 🔥 Configuration Firebase

### 1. Créer un projet Firebase

1. Allez sur [Firebase Console](https://console.firebase.google.com)
2. Cliquez sur "Ajouter un projet"
3. Suivez les étapes pour créer votre projet
4. Activez **Authentication** dans le menu de gauche
5. Activez **Firestore Database** dans le menu de gauche

### 2. Configurer Google Authentication

1. Dans Firebase Console, allez dans **Authentication** > **Sign-in method**
2. Activez **Google** comme méthode de connexion
3. Configurez l'écran de consentement OAuth dans Google Cloud Console si nécessaire

### 3. Configurer Firestore

1. Dans Firebase Console, allez dans **Firestore Database**
2. Créez une base de données en mode **Production** ou **Test**
3. Configurez les règles de sécurité :

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 4. Obtenir les clés de configuration

1. Dans Firebase Console, allez dans **Paramètres du projet** (icône engrenage)
2. Faites défiler jusqu'à "Vos applications"
3. Cliquez sur l'icône Web (`</>`) pour ajouter une application web
4. Copiez les valeurs de configuration

### 5. Ajouter les variables dans `.env`

Créez un fichier `.env` à la racine du projet avec :

```env
VITE_FIREBASE_API_KEY=votre-api-key
VITE_FIREBASE_AUTH_DOMAIN=votre-projet.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=votre-project-id
VITE_FIREBASE_STORAGE_BUCKET=votre-projet.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

## 💳 Configuration Stripe

### 1. Créer un compte Stripe

1. Allez sur [Stripe Dashboard](https://dashboard.stripe.com)
2. Créez un compte ou connectez-vous
3. Passez en **mode test** pour le développement

### 2. Créer des produits et prix

1. Dans Stripe Dashboard, allez dans **Products**
2. Cliquez sur **Add product**
3. Créez un produit "NEXUS Pro" avec :
   - **Name**: NEXUS Pro
   - **Description**: Plan Pro avec stockage illimité
   - **Pricing**: 
     - Monthly: €9.99/mois
     - Yearly (optionnel): €99.99/an
4. Copiez les **Price IDs** (commencent par `price_`)

### 3. Obtenir la clé publique

1. Dans Stripe Dashboard, allez dans **Developers** > **API keys**
2. Copiez la **Publishable key** (commence par `pk_test_` pour le test, `pk_live_` pour la production)

### 4. Configurer les webhooks (pour le backend)

1. Dans Stripe Dashboard, allez dans **Developers** > **Webhooks**
2. Ajoutez un endpoint : `https://votre-api.com/api/stripe/webhook`
3. Sélectionnez les événements :
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copiez le **Signing secret** (commence par `whsec_`)

### 5. Ajouter les variables dans `.env`

Ajoutez dans votre fichier `.env` :

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_votre_cle_publique
VITE_STRIPE_PRICE_PRO_MONTHLY=price_votre_price_id_mensuel
VITE_STRIPE_PRICE_PRO_YEARLY=price_votre_price_id_annuel
```

## 🚀 Configuration Backend API

Vous devez créer un backend API pour gérer :

1. **Stripe Checkout Sessions** (`/api/stripe/create-checkout-session`)
2. **Stripe Billing Portal** (`/api/stripe/create-portal-session`)
3. **Webhook Stripe** (`/api/stripe/webhook`) pour mettre à jour les abonnements
4. **Storage Upload/Download** (`/api/storage/*`)
5. **Sync Status** (`/api/sync/*`)

Ajoutez l'URL de votre API dans `.env` :

```env
VITE_API_URL=https://votre-api.com
```

## ✅ Vérification

1. Redémarrez le serveur de développement : `npm run dev`
2. Allez dans **Paramètres** > **Cloud**
3. Vérifiez que :
   - Firebase affiche "Connecté" (pas "Non configuré")
   - Stripe affiche "Connecté" (pas "Non configuré")
4. Testez la connexion Google
5. Testez l'upgrade vers Pro (en mode test Stripe)

## 📝 Notes importantes

- **Ne commitez JAMAIS** le fichier `.env` dans Git
- Utilisez des clés de **test** pour le développement
- Passez en **production** uniquement quand vous êtes prêt
- Les webhooks Stripe doivent être configurés sur votre backend, pas dans le frontend

