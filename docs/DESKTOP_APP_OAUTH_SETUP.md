# Configuration OAuth Desktop App pour Electron

## Vue d'ensemble

L'application utilise maintenant le flow OAuth "Desktop App" de Google Cloud Platform pour l'authentification dans Electron. Ce flow utilise un schéma d'URI personnalisé (`com.nexus.audio://`) au lieu d'une URL HTTP.

## Client ID Desktop App

**Client ID** : `925746643102-bknlkfarsfcrtmb8lvl11lnn0cprjvqv.apps.googleusercontent.com`

**Note** : Ce Client ID est configuré par défaut dans l'application. Google génère automatiquement `http://localhost` comme redirect URI pour les applications Desktop App.

## Configuration Requise dans Google Cloud Console

### 1. Créer/Configurer un OAuth Client ID de type "Desktop app"

1. Allez sur [Google Cloud Console](https://console.cloud.google.com)
2. Sélectionnez votre projet
3. Allez dans **APIs & Services** > **Credentials**
4. Si le Client ID n'existe pas, créez-en un :
   - Cliquez sur **Create Credentials** > **OAuth client ID**
   - Type d'application : **Desktop app**
   - Nom : "Nexus Audio Desktop App" (ou similaire)
   - Cliquez sur **Create**
5. Copiez le **Client ID** généré

### 2. Redirect URI (Automatique)

Pour les applications Desktop App, Google génère automatiquement le redirect URI suivant :

```
http://localhost
```

**Important** :
- Ce redirect URI est **automatiquement généré** par Google Cloud Console
- Vous **ne pouvez pas le modifier** pour les applications Desktop App
- L'application utilise un serveur HTTP local (port 3001) pour intercepter le callback

### 3. Vérifier les Authorized JavaScript Origins

Pour les applications desktop, vous pouvez laisser ce champ vide ou ajouter :
- `http://localhost` (pour le développement)

## Comment ça Fonctionne

### Flow d'Authentification Desktop App

1. **L'utilisateur clique sur "Se connecter avec Google"**
   - L'application détecte qu'elle s'exécute dans Electron
   - Utilise le Client ID Desktop App
   - Construit l'URL OAuth avec `redirect_uri=com.nexus.audio://oauth/callback`

2. **Ouverture du navigateur externe**
   - Electron ouvre le navigateur système par défaut
   - L'utilisateur s'authentifie avec Google

3. **Redirection vers localhost**
   - Après authentification, Google redirige vers `http://localhost?code=...&state=...`
   - Un serveur HTTP local (port 3001) dans Electron intercepte cette requête

4. **Récupération du code d'autorisation**
   - Le serveur HTTP local reçoit la requête et extrait le code d'autorisation
   - Le code est envoyé au processus renderer via IPC
   - Une page HTML de confirmation est affichée dans le navigateur

5. **Échange du code contre des tokens**
   - L'application échange le code contre des tokens d'accès via `/api/oauth/token`
   - Les tokens sont stockés localement
   - L'utilisateur est authentifié

## Code Implémenté

### Electron Main Process (`electron/main.ts`)

```typescript
// Serveur HTTP local pour intercepter les callbacks OAuth
function registerOAuthCallbackServer() {
  const PORT = 3001;
  oauthCallbackServer = createServer((req, res) => {
    // Extraire code et state de l'URL
    const urlObj = new URL(req.url, `http://localhost:${PORT}`);
    const code = urlObj.searchParams.get('code');
    const state = urlObj.searchParams.get('state');
    
    // Envoyer au renderer via IPC
    mainWindow.webContents.send('oauth:callback', { code, state });
    
    // Afficher page de confirmation
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body><h1>✅ Authentification réussie</h1></body></html>');
  });
  
  oauthCallbackServer.listen(PORT, '127.0.0.1');
}

// Handler pour ouvrir le navigateur externe
ipcMain.handle('oauth:openExternal', async (_event, url: string) => {
  await shell.openExternal(url);
});
```

### Preload Script (`electron/preload.cjs`)

```javascript
// Exposition de l'API OAuth au renderer
openExternal: (url) => ipcRenderer.invoke('oauth:openExternal', url),
onOAuthCallback: (callback) => {
  const listener = (_event, data) => callback(data);
  ipcRenderer.on('oauth:callback', listener);
  return () => ipcRenderer.removeListener('oauth:callback', listener);
},
```

### Service d'Authentification (`src/services/auth.ts`)

```typescript
// Utilisation de localhost pour Electron (standard Google Desktop App OAuth)
const DESKTOP_REDIRECT_URI = 'http://localhost';

// Dans buildAuthUrl()
const redirectUri = isElectron() 
  ? DESKTOP_REDIRECT_URI  // http://localhost for desktop app
  : window.location.origin; // Just origin for Web
```

## Configuration des Variables d'Environnement

### Option 1 : Via API Route (Recommandé)

Le Client ID Desktop App est configuré par défaut dans `/app/api/config/auth/route.ts` :

```typescript
googleClientId: process.env.GOOGLE_CLIENT_ID || 
                '925746643102-bknlkfarsfcrtmb8lvl11lnn0cprjvqv.apps.googleusercontent.com'
```

### Option 2 : Via Variables d'Environnement

Ajoutez dans votre `.env` :

```bash
GOOGLE_CLIENT_ID=925746643102-bknlkfarsfcrtmb8lvl11lnn0cprjvqv.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
```

## Test

1. **Reconstruire l'application** :
   ```bash
   npm run build:electron
   ```

2. **Tester l'authentification** :
   - Lancez l'application Electron
   - Cliquez sur "Se connecter avec Google"
   - Le navigateur externe devrait s'ouvrir
   - Après authentification, l'application devrait recevoir le callback
   - L'utilisateur devrait être authentifié

3. **Vérifier les logs** :
   - Console DevTools : `🔐 OAuth redirect_uri: http://localhost (Desktop App - localhost)`
   - Console Electron : `🔐 OAuth callback server listening on http://localhost:3001`
   - Console Electron : `🔐 OAuth callback received on localhost: { code: 'present', state: 'present' }`

## Dépannage

### Le navigateur ne s'ouvre pas

- Vérifiez que `shell.openExternal` est bien appelé
- Vérifiez les logs Electron pour les erreurs

### Le callback n'est pas reçu

1. **Vérifiez que le protocole est enregistré** :
   - Sur macOS : Vérifiez dans les préférences système
   - Sur Windows : Vérifiez dans le registre
   - Sur Linux : Vérifiez les associations de fichiers

2. **Vérifiez les logs Electron** :
   - Recherchez `OAuth callback received`
   - Vérifiez que l'URL est correctement parsée

3. **Vérifiez que le port 3001 est disponible** :
   - Le serveur OAuth écoute sur le port 3001
   - Si le port est occupé, l'application affichera un avertissement
   - Fermez toute autre application utilisant le port 3001

### Erreur "redirect_uri_mismatch"

- Vérifiez que le Client ID utilisé est bien celui de type "Desktop app"
- Google génère automatiquement `http://localhost` comme redirect URI
- Vous ne pouvez pas modifier ce redirect URI pour les applications Desktop App
- L'application utilise automatiquement `http://localhost` comme redirect_uri

## Avantages du Flow Desktop App

✅ **Pas de problème de redirect_uri** - Le schéma personnalisé est unique  
✅ **Meilleure sécurité** - Pas besoin d'exposer des URLs publiques  
✅ **Expérience utilisateur fluide** - Retour automatique à l'application  
✅ **Compatible avec toutes les plateformes** - Windows, macOS, Linux

## Note sur Firebase Auth

Firebase Auth est **désactivé pour Electron** mais reste disponible pour le Web. En Electron, seul le flow Desktop App OAuth est utilisé pour éviter les problèmes de redirect_uri.
