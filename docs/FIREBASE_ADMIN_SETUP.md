# Configuration Firebase Admin SDK

## ⚠️ IMPORTANT : Sécurité

**NE JAMAIS** commiter le fichier JSON Firebase Admin SDK dans votre repository Git !

Même pas en local, même pas caché, même pas obfusqué. Google peut vous bannir si le fichier leak.

## ✅ Solution recommandée : Variables d'environnement

Au lieu d'utiliser le fichier JSON, utilisez des variables d'environnement.

### 1. Extraire les valeurs du fichier JSON

Ouvrez votre fichier `nexus-player-d366f-firebase-adminsdk-fbsvc-4dfa7c0b4a.json` et extrayez :

- `project_id` → `FIREBASE_PROJECT_ID`
- `client_email` → `FIREBASE_CLIENT_EMAIL`
- `private_key` → `FIREBASE_PRIVATE_KEY`

### 2. Ajouter dans `.env.local`

Créez ou modifiez votre fichier `.env.local` à la racine du projet :

```env
FIREBASE_PROJECT_ID=nexus-player-d366f
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@nexus-player-d366f.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nVOTRE_CLE_PRIVEE_ICI\n-----END PRIVATE KEY-----\n"
```

⚠️ **Important** : 
- Gardez les `\n` dans `FIREBASE_PRIVATE_KEY` - ils seront convertis automatiquement
- Entourez la valeur avec des guillemets doubles
- La clé privée doit être sur une seule ligne avec `\n` pour les retours à la ligne

### 3. Exemple de clé privée formatée

```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n...votre clé complète...\n-----END PRIVATE KEY-----\n"
```

### 4. Vérification

Une fois configuré, le système utilisera automatiquement ces variables :

- ✅ Middleware d'authentification (`app/api/auth/middleware.ts`)
- ✅ Routes API admin (`app/api/admin/activate-pro/route.ts`)
- ✅ Scripts d'administration (`scripts/activate-pro.ts`)

## 🔒 Sécurité supplémentaire

1. Ajoutez `.env.local` à votre `.gitignore` (déjà fait normalement)
2. Ne partagez jamais ces valeurs
3. Utilisez des variables d'environnement différentes pour dev/prod
4. Sur Vercel/Netlify, configurez les variables dans le dashboard

## 📝 Migration depuis le fichier JSON

Si vous aviez déjà le fichier JSON dans votre projet :

1. Extrayez les valeurs comme indiqué ci-dessus
2. Ajoutez-les à `.env.local`
3. **Supprimez le fichier JSON** du repository
4. Ajoutez `*-firebase-adminsdk-*.json` à `.gitignore` (déjà fait normalement)

## ✅ Avantages de cette approche

- ✅ Compatible avec Next.js (pas de problèmes de bundling)
- ✅ Fonctionne en dev et en production
- ✅ Compatible Vercel, Netlify, etc.
- ✅ Plus sécurisé (pas de fichier sensible dans le repo)
- ✅ Recommandé par Google et Next.js

