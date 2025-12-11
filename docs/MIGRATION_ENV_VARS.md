# Migration des variables d'environnement - Vite vers Next.js

## Changements effectués

### Variables d'environnement

Dans Next.js, les variables d'environnement côté client doivent être préfixées par `NEXT_PUBLIC_` pour être accessibles dans le navigateur.

#### Avant (Vite)
```env
VITE_GOOGLE_OAUTH_CLIENT_ID=...
VITE_GOOGLE_OAUTH_CLIENT_SECRET=...
VITE_OAUTH_PROXY_URL=...
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_STRIPE_PUBLISHABLE_KEY=...
VITE_STRIPE_PRICE_PRO_MONTHLY=...
VITE_STRIPE_PRICE_PRO_YEARLY=...
VITE_API_URL=...
```

#### Après (Next.js)
```env
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=...
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_SECRET=...
NEXT_PUBLIC_OAUTH_PROXY_URL=...
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY=...
NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY=...
NEXT_PUBLIC_API_URL=...
```

### Variables côté serveur (API Routes)

Les variables d'environnement utilisées dans les routes API Next.js (`app/api/*`) n'ont **pas** besoin du préfixe `NEXT_PUBLIC_` :

```env
GOOGLE_CLIENT_ID=...
STRIPE_SECRET_KEY=...
STRIPE_PRICE_PRO_MONTHLY=...
STRIPE_PRICE_PRO_YEARLY=...
STORAGE_DIR=./storage
```

## Fichiers modifiés

### 1. `src/services/auth.ts`
- ✅ Remplacé `import.meta.env.VITE_*` par `process.env.NEXT_PUBLIC_*`
- ✅ Ajouté vérification `typeof window !== 'undefined'` pour éviter les erreurs SSR
- ✅ Protégé l'accès à `localStorage` côté serveur

### 2. `src/services/firebase.ts`
- ✅ Remplacé `import.meta.env.VITE_FIREBASE_*` par `process.env.NEXT_PUBLIC_FIREBASE_*`
- ✅ Ajouté vérification `typeof window !== 'undefined'`

### 3. `src/services/stripe.ts`
- ✅ Remplacé `import.meta.env.VITE_STRIPE_*` par `process.env.NEXT_PUBLIC_STRIPE_*`
- ✅ Remplacé `import.meta.env.VITE_API_URL` par `process.env.NEXT_PUBLIC_API_URL`
- ✅ Ajouté vérification `typeof window !== 'undefined'`

### 4. `src/components/views/SettingsView.tsx`
- ✅ Remplacé `import.meta.env.VITE_API_URL` par `process.env.NEXT_PUBLIC_API_URL`

## Protection SSR (Server-Side Rendering)

Tous les accès à `localStorage` et `window` ont été protégés avec des vérifications :

```typescript
if (typeof window !== 'undefined' && window.localStorage) {
  // Code qui utilise localStorage
}
```

Cela évite les erreurs lors du rendu côté serveur (SSR) de Next.js.

## Migration de votre fichier .env

Si vous avez un fichier `.env` existant, renommez les variables :

```bash
# Ancien
VITE_GOOGLE_OAUTH_CLIENT_ID=xxx

# Nouveau
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=xxx
```

## Notes importantes

1. **Variables publiques** : Les variables avec le préfixe `NEXT_PUBLIC_` sont exposées au client. Ne mettez jamais de secrets dans ces variables.

2. **Variables serveur** : Les variables sans préfixe `NEXT_PUBLIC_` ne sont accessibles que côté serveur (dans les routes API).

3. **localStorage** : Toujours vérifier `typeof window !== 'undefined'` avant d'utiliser `localStorage` pour éviter les erreurs SSR.

## ✅ Résultat

- ✅ Build réussi
- ✅ Toutes les variables d'environnement migrées
- ✅ Protection SSR ajoutée
- ✅ Aucune erreur de compilation

