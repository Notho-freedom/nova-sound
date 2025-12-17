# Configuration du Webhook Stripe

Ce document explique comment configurer et intégrer le webhook Stripe pour gérer automatiquement les abonnements Pro.

## 📋 Vue d'ensemble

Le webhook Stripe permet de :
- ✅ Activer automatiquement le plan Pro après un paiement réussi
- ✅ Mettre à jour le statut de l'abonnement en temps réel
- ✅ Désactiver le plan Pro lors de l'annulation d'un abonnement
- ✅ Gérer les renouvellements automatiques

## 🔧 Configuration dans Stripe Dashboard

### 1. Créer le webhook

1. Connectez-vous à votre [Stripe Dashboard](https://dashboard.stripe.com)
2. Allez dans **Developers** > **Webhooks**
3. Cliquez sur **Add endpoint**
4. Configurez le webhook :
   - **Endpoint URL**: `https://nova-sound-nine.vercel.app/api/stripe/webhook`
   - **Description**: `webhook de gestion des souscriptions`
   - **Events to send**: Sélectionnez les événements suivants :
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`

### 2. Récupérer le Signing Secret

1. Après avoir créé le webhook, cliquez dessus
2. Dans la section **Signing secret**, copiez la valeur (commence par `whsec_...`)
3. Ajoutez-la à vos variables d'environnement :

```bash
STRIPE_WEBHOOK_SECRET=whsec_OVIjBrglgX08cnI7YGm50n9VPc9NBFiy
```

## 🔐 Configuration des variables d'environnement

### Variables requises

Ajoutez ces variables dans votre fichier `.env.local` et dans Vercel :

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...

# Webhook Secret (REQUIRED pour la production)
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Configuration Vercel

1. Allez dans votre projet Vercel
2. **Settings** > **Environment Variables**
3. Ajoutez `STRIPE_WEBHOOK_SECRET` avec la valeur du signing secret
4. Sélectionnez les environnements : **Production**, **Preview**, **Development**
5. Cliquez sur **Save**

## 🔄 Flux de fonctionnement

### 1. Création d'un abonnement

```
Utilisateur → Crée checkout session → Stripe → Paiement réussi
                                                      ↓
                                    checkout.session.completed
                                                      ↓
                                    Webhook → updateUserToPro()
                                                      ↓
                                    Firestore mis à jour (plan: 'pro')
```

### 2. Renouvellement d'abonnement

```
Stripe → Paiement automatique réussi
              ↓
    invoice.payment_succeeded
              ↓
    Webhook → updateUserToPro()
              ↓
    Firestore mis à jour
```

### 3. Annulation d'abonnement

```
Utilisateur → Annule via Stripe Portal
                    ↓
    customer.subscription.deleted
                    ↓
    Webhook → updateUserToFree()
                    ↓
    Firestore mis à jour (plan: 'free')
```

## 📍 Endpoint du webhook

**URL**: `https://nova-sound-nine.vercel.app/api/stripe/webhook`

**Méthode**: `POST`

**Authentification**: Vérification de signature Stripe (via `STRIPE_WEBHOOK_SECRET`)

## 🔍 Événements gérés

| Événement | Action | Description |
|-----------|--------|-------------|
| `checkout.session.completed` | `updateUserToPro()` | Paiement initial réussi |
| `customer.subscription.created` | `updateUserToPro()` | Nouvel abonnement créé |
| `customer.subscription.updated` | `updateUserToPro()` ou `updateUserToFree()` | Statut d'abonnement modifié |
| `customer.subscription.deleted` | `updateUserToFree()` | Abonnement annulé |
| `invoice.payment_succeeded` | `updateUserToPro()` | Renouvellement réussi |

## 🧪 Test du webhook

### En développement local

Pour tester localement, utilisez [Stripe CLI](https://stripe.com/docs/stripe-cli) :

```bash
# Installer Stripe CLI
# Windows: winget install stripe.stripe-cli
# macOS: brew install stripe/stripe-cli/stripe
# Linux: voir https://stripe.com/docs/stripe-cli

# Se connecter à votre compte Stripe
stripe login

# Forwarder les webhooks vers votre serveur local
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### Tester un événement

```bash
# Simuler un checkout réussi
stripe trigger checkout.session.completed

# Simuler une création d'abonnement
stripe trigger customer.subscription.created

# Simuler une annulation
stripe trigger customer.subscription.deleted
```

## 🐛 Dépannage

### Le webhook ne fonctionne pas

1. **Vérifier le Signing Secret**
   - Assurez-vous que `STRIPE_WEBHOOK_SECRET` est correctement configuré
   - Le secret doit commencer par `whsec_`

2. **Vérifier l'URL du webhook**
   - L'URL doit être accessible publiquement
   - Pour Vercel, utilisez l'URL de production : `https://nova-sound-nine.vercel.app/api/stripe/webhook`

3. **Vérifier les logs**
   - Dans Stripe Dashboard > Webhooks > Votre webhook > Logs
   - Vérifiez les erreurs retournées par votre endpoint

4. **Vérifier les logs de l'application**
   - Les logs du webhook apparaissent dans la console Vercel
   - Recherchez les messages commençant par `📥 Received Stripe webhook`

### L'utilisateur n'est pas mis à jour

1. **Vérifier que le userId est dans les métadonnées**
   - Le `userId` doit être présent dans `session.metadata.userId` ou `customer.metadata.userId`
   - Vérifiez que le customer est créé avec le `userId` dans les métadonnées

2. **Vérifier Firebase Admin**
   - Assurez-vous que `FIREBASE_PRIVATE_KEY` est correctement configuré
   - Vérifiez que le service account a les permissions nécessaires

3. **Vérifier les logs**
   - Les erreurs sont loggées avec `❌ Error updating user`
   - Vérifiez les détails de l'erreur dans les logs

## 🔒 Sécurité

### Vérification de signature

Le webhook vérifie automatiquement la signature de chaque requête :

```typescript
event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
```

**Important**: Ne désactivez jamais la vérification de signature en production !

### Variables d'environnement

- ⚠️ **NE JAMAIS** commiter `STRIPE_WEBHOOK_SECRET` dans Git
- ✅ Utilisez `.env.local` pour le développement local
- ✅ Utilisez les variables d'environnement Vercel pour la production

## 📚 Ressources

- [Documentation Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
- [Guide de test des webhooks](https://stripe.com/docs/webhooks/test)

## ✅ Checklist de configuration

- [ ] Webhook créé dans Stripe Dashboard
- [ ] URL du webhook configurée : `https://nova-sound-nine.vercel.app/api/stripe/webhook`
- [ ] Événements sélectionnés (5 événements minimum)
- [ ] Signing secret copié et ajouté à `.env.local`
- [ ] `STRIPE_WEBHOOK_SECRET` ajouté dans Vercel
- [ ] Test du webhook avec Stripe CLI (optionnel)
- [ ] Vérification des logs après un paiement test

## 🎯 Prochaines étapes

1. Tester un paiement avec une carte de test : `4242 4242 4242 4242`
2. Vérifier que l'utilisateur passe automatiquement en Pro
3. Tester l'annulation via le Stripe Portal
4. Vérifier que l'utilisateur repasse en Free
