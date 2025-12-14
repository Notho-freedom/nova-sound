# Guide de test du Frontend avec le Backend Express

## 🔧 Configuration

### 1. Configurer l'URL du backend

Le frontend utilise la variable d'environnement `NEXT_PUBLIC_API_URL` pour pointer vers le backend.

**Option A : Via fichier `.env.local` (recommandé pour le développement)**

Créez ou modifiez `.env.local` à la racine du projet :

```bash
# URL du backend Express déployé sur Vercel
NEXT_PUBLIC_API_URL=https://backend-delta-ivory-17.vercel.app
```

**Option B : Via variables d'environnement système**

```bash
# Windows PowerShell
$env:NEXT_PUBLIC_API_URL="https://backend-delta-ivory-17.vercel.app"

# Windows CMD
set NEXT_PUBLIC_API_URL=https://backend-delta-ivory-17.vercel.app

# Linux/Mac
export NEXT_PUBLIC_API_URL=https://backend-delta-ivory-17.vercel.app
```

### 2. Pour tester avec le backend local

Si vous voulez tester avec le backend en développement local :

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 🚀 Démarrage

### Mode développement (Next.js + Backend local)

```bash
# Terminal 1 : Démarrer le backend local
cd backend
npm run dev

# Terminal 2 : Démarrer le frontend
npm run dev
```

Le frontend sera disponible sur `http://localhost:3000`

### Mode développement avec Electron

```bash
# Terminal 1 : Démarrer le backend local
cd backend
npm run dev

# Terminal 2 : Démarrer le frontend + Electron
npm run dev:electron
```

### Mode production (Frontend statique + Backend Vercel)

```bash
# Build le frontend
npm run build

# Lancer Electron avec le build statique
npm run electron
```

## ✅ Tests à effectuer

### 1. Test de connexion au backend

Ouvrez la console du navigateur (F12) et vérifiez que les appels API fonctionnent :

```javascript
// Test de l'endpoint health
fetch('https://backend-delta-ivory-17.vercel.app/api/health')
  .then(r => r.json())
  .then(console.log);
// Devrait retourner: {"status":"ok","timestamp":"..."}
```

### 2. Test de chargement de la configuration

Dans la console du navigateur, vérifiez que les configurations se chargent :

- **Firebase** : Vérifiez que `firebaseService.isInitialized()` retourne `true`
- **Stripe** : Vérifiez que `stripeService.isInitialized()` retourne `true`
- **Auth** : Vérifiez que `authService.isInitialized()` retourne `true`

### 3. Test d'authentification

1. Cliquez sur "Se connecter" dans l'UI
2. Vérifiez que la popup Google OAuth s'ouvre
3. Après connexion, vérifiez que l'utilisateur est authentifié
4. Vérifiez dans la console que les appels API incluent le header `Authorization: Bearer ...`

### 4. Test des fonctionnalités

- ✅ **Configuration Firebase** : Doit se charger depuis `/api/config/firebase`
- ✅ **Configuration Stripe** : Doit se charger depuis `/api/config/stripe`
- ✅ **Configuration Auth** : Doit se charger depuis `/api/config/auth`
- ✅ **Statut d'abonnement** : Doit appeler `/api/stripe/subscription-status` avec auth
- ✅ **Upload de fichiers** : Doit appeler `/api/storage/upload` avec auth
- ✅ **Synchronisation** : Doit appeler `/api/sync/start` et `/api/sync/status` avec auth

## 🐛 Dépannage

### Erreur : "Failed to fetch" ou CORS

Si vous voyez des erreurs CORS, vérifiez que :
1. Le backend a les headers CORS configurés (déjà fait dans `server.ts`)
2. L'URL du backend est correcte dans `NEXT_PUBLIC_API_URL`

### Erreur : "User not authenticated"

C'est normal si vous n'êtes pas connecté. Testez d'abord les endpoints publics :
- `/api/health`
- `/api/config/firebase`
- `/api/config/stripe`
- `/api/config/auth`

### Erreur : "Firebase configuration incomplete"

Vérifiez que les variables d'environnement Firebase sont configurées dans Vercel Dashboard pour le backend.

### Vérifier les appels API dans la console

Ouvrez les DevTools (F12) > Network et filtrez par "api" pour voir tous les appels au backend.

## 📝 URLs importantes

- **Backend Vercel** : https://backend-delta-ivory-17.vercel.app
- **Frontend local** : http://localhost:3000
- **Backend local** : http://localhost:3001

