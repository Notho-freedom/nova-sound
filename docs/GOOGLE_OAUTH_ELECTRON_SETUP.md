# Configuration Google OAuth pour Electron

## Problème

L'erreur `redirect_uri_mismatch` se produit lorsque l'application Electron essaie de s'authentifier avec Google, car le `redirect_uri` utilisé ne correspond pas à celui configuré dans Google Cloud Console.

## Solution

L'application Electron utilise maintenant l'URL de production Vercel (`https://nova-sound-nine.vercel.app`) comme `redirect_uri` pour l'authentification Google.

## Configuration requise dans Google Cloud Console

### 1. Accéder à Google Cloud Console

1. Allez sur [Google Cloud Console](https://console.cloud.google.com)
2. Sélectionnez votre projet (celui associé à Firebase)
3. Allez dans **APIs & Services** > **Credentials**

### 2. Configurer les URI de redirection autorisés

1. Trouvez votre **OAuth 2.0 Client ID** (celui utilisé pour l'authentification web)
2. Cliquez sur l'icône d'édition (crayon)
3. Dans la section **Authorized redirect URIs**, ajoutez les URI suivants :

```
https://nova-sound-nine.vercel.app
https://nova-sound-nine.vercel.app/
http://localhost:3000
http://localhost:3000/
```

**Important :** 
- L'URI doit correspondre **exactement** (avec ou sans le slash final selon votre configuration)
- Pour Electron, l'application utilise `https://nova-sound-nine.vercel.app` comme `redirect_uri`
- Pour le développement web, utilisez `http://localhost:3000`

### 3. Vérifier les domaines autorisés dans Firebase

1. Allez sur [Firebase Console](https://console.firebase.google.com)
2. Sélectionnez votre projet
3. Allez dans **Authentication** > **Settings** > **Authorized domains**
4. Assurez-vous que les domaines suivants sont présents :
   - `localhost`
   - `nova-sound-nine.vercel.app`

### 4. Vérifier le Client ID

Assurez-vous que le `GOOGLE_OAUTH_CLIENT_ID` utilisé dans l'application correspond au Client ID configuré dans Google Cloud Console.

## Comment ça fonctionne

### En Electron (Production)
- L'application détecte qu'elle s'exécute dans Electron
- Utilise `https://nova-sound-nine.vercel.app` comme `redirect_uri`
- Après l'authentification Google, l'utilisateur est redirigé vers cette URL
- L'application Electron intercepte la redirection et extrait le code d'autorisation depuis l'URL

### En Web (Développement/Production)
- Utilise `window.location.origin` comme `redirect_uri`
- Fonctionne normalement avec les redirections du navigateur

## Test

1. Après avoir configuré les URI dans Google Cloud Console, attendez quelques minutes pour que les changements soient propagés
2. Testez l'authentification dans l'application Electron
3. L'erreur `redirect_uri_mismatch` ne devrait plus apparaître

## Dépannage

### L'erreur persiste
- Vérifiez que l'URI dans Google Cloud Console correspond **exactement** à celui utilisé par l'application
- Vérifiez qu'il n'y a pas d'espaces ou de caractères supplémentaires
- Attendez quelques minutes après la modification (propagation des changements)

### L'authentification fonctionne mais la redirection échoue
- Vérifiez que le domaine est bien dans la liste des domaines autorisés dans Firebase
- Vérifiez les logs de la console pour voir l'URL exacte utilisée
