# Guide de Configuration de Production

Ce guide explique comment configurer et déployer NEXUS Audio Player en production.

## 📋 Prérequis

- Node.js 18+ installé
- Compte Firebase configuré
- Compte Stripe configuré
- Compte BunnyCDN (optionnel, pour les utilisateurs Pro)
- Serveur de production (Vercel, Netlify, ou serveur dédié)

## 🔧 Configuration

### 1. Variables d'environnement

Créez un fichier `.env.production` avec toutes les variables requises (voir `env.example`).

**Variables requises:**
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_CLIENT_EMAIL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET` ⚠️ **CRITIQUE pour les paiements automatiques**

**Variables optionnelles:**
- `BUNNY_STORAGE_NAME` et `BUNNY_API_KEY` (pour le stockage Pro)
- `PLANETHOSTER_SFTP_*` (alternative au stockage Bunny)

### 2. Configuration du Webhook Stripe

Le webhook Stripe est **ESSENTIEL** pour que les utilisateurs passent automatiquement en Pro après un paiement réussi.

#### Étapes de configuration:

1. **Accédez au Dashboard Stripe:**
   - Allez sur https://dashboard.stripe.com/webhooks
   - Cliquez sur "Add endpoint"

2. **Configurez l'endpoint:**
   - **URL:** `https://votre-domaine.com/api/stripe/webhook`
   - **Description:** "NEXUS Audio Player - Webhook de paiement"

3. **Sélectionnez les événements à écouter:**
   - ✅ `checkout.session.completed` - Quand un checkout est complété
   - ✅ `customer.subscription.created` - Quand un abonnement est créé
   - ✅ `customer.subscription.updated` - Quand un abonnement est mis à jour
   - ✅ `customer.subscription.deleted` - Quand un abonnement est annulé
   - ✅ `invoice.payment_succeeded` - Quand un paiement réussit

4. **Récupérez le secret du webhook:**
   - Après la création, cliquez sur le webhook
   - Dans "Signing secret", cliquez sur "Reveal"
   - Copiez le secret (commence par `whsec_`)
   - Ajoutez-le à `.env.production` comme `STRIPE_WEBHOOK_SECRET`

5. **Testez le webhook:**
   - Utilisez le bouton "Send test webhook" dans Stripe
   - Vérifiez les logs de votre application pour confirmer la réception

### 3. Build de Production

#### Option 1: Build automatique (recommandé)

```bash
npm run build:prod
```

Ce script:
- ✅ Vérifie les variables d'environnement
- ✅ Nettoie les builds précédents
- ✅ Build Next.js
- ✅ Compile Electron
- ✅ Crée l'installateur

#### Option 2: Build manuel

```bash
# 1. Build Next.js
npm run build

# 2. Compiler Electron
npm run build:electron

# 3. Créer l'installateur
npm run package:win    # Windows
npm run package:mac    # macOS
npm run package:linux  # Linux
```

L'installateur sera créé dans le dossier `dist/`.

### 4. Déploiement

#### Déploiement sur Vercel (recommandé pour le backend)

1. **Installez Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Déployez:**
   ```bash
   vercel --prod
   ```

3. **Configurez les variables d'environnement:**
   - Allez sur https://vercel.com/dashboard
   - Sélectionnez votre projet
   - Settings > Environment Variables
   - Ajoutez toutes les variables de `.env.production`

#### Déploiement sur serveur dédié

1. **Clonez le repository:**
   ```bash
   git clone <votre-repo>
   cd nova-sound
   ```

2. **Installez les dépendances:**
   ```bash
   npm install
   ```

3. **Configurez les variables d'environnement:**
   ```bash
   cp env.example .env.production
   # Éditez .env.production avec vos valeurs
   ```

4. **Build et démarrez:**
   ```bash
   npm run build
   npm start
   ```

### 5. Distribution de l'application Electron

Une fois l'installateur créé dans `dist/`:

1. **Testez l'installateur** sur une machine propre
2. **Signez l'application** (recommandé pour macOS et Windows)
3. **Uploadez l'installateur** sur votre serveur de distribution
4. **Configurez les mises à jour automatiques** (voir `docs/OFFLINE_FIRST_UPDATER.md`)

## ✅ Vérification Post-Déploiement

### Checklist de vérification:

- [ ] L'application démarre correctement
- [ ] L'authentification Firebase fonctionne
- [ ] Les paiements Stripe fonctionnent
- [ ] Le webhook Stripe reçoit les événements
- [ ] Les utilisateurs passent automatiquement en Pro après paiement
- [ ] Le stockage Bunny fonctionne (si configuré)
- [ ] Les uploads vers Bunny fonctionnent pour les utilisateurs Pro
- [ ] La synchronisation Firestore fonctionne

### Test du webhook Stripe

1. **Créez un test de paiement:**
   - Utilisez la carte de test: `4242 4242 4242 4242`
   - Date d'expiration: n'importe quelle date future
   - CVC: n'importe quel 3 chiffres

2. **Vérifiez les logs:**
   - Les logs devraient afficher: `📥 Received Stripe webhook: checkout.session.completed`
   - Puis: `✅ Updated user [userId] to Pro plan`

3. **Vérifiez Firestore:**
   - Le profil utilisateur devrait avoir `plan: 'pro'` et `subscriptionStatus: 'active'`

## 🔒 Sécurité

### Variables sensibles

⚠️ **NE JAMAIS** commiter les fichiers suivants:
- `.env.local`
- `.env.production`
- `firebase-admin-key.json`
- Toute clé API ou secret

### Bonnes pratiques

1. **Utilisez des secrets différents** pour développement et production
2. **Activez 2FA** sur tous vos comptes (Firebase, Stripe, etc.)
3. **Limitez les permissions** des clés API au strict nécessaire
4. **Surveillez les logs** pour détecter les activités suspectes
5. **Mettez à jour régulièrement** les dépendances

## 📞 Support

En cas de problème:

1. Vérifiez les logs de l'application
2. Vérifiez les logs Stripe (Dashboard > Developers > Logs)
3. Vérifiez les logs Firebase (Console Firebase > Functions > Logs)
4. Consultez la documentation dans `docs/`

## 🔄 Mise à jour

Pour mettre à jour l'application:

1. **Pull les dernières modifications:**
   ```bash
   git pull origin main
   ```

2. **Rebuild:**
   ```bash
   npm run build:prod
   ```

3. **Redéployez:**
   - Vercel: `vercel --prod`
   - Serveur dédié: Redémarrez le processus Node.js

4. **Distribuez le nouvel installateur** aux utilisateurs
