# Configuration des Mises à Jour via Vercel

## 📋 Vue d'ensemble

L'application est déployée sur Vercel et sert de source de mise à jour pour l'application Electron. Le système vérifie automatiquement les nouvelles versions et les télécharge depuis Vercel.

## 🏗️ Architecture

```
Vercel (Production)
├─ /api/update/version    → Retourne version.json
└─ /api/update/build      → Retourne build.zip

Electron App (Local)
├─ local-ui/              → Build local (offline-first)
└─ updater/               → Vérifie et télécharge depuis Vercel
```

## ⚙️ Configuration

### 1. Variables d'environnement

Dans votre application Electron, définissez l'URL Vercel :

**Option 1 : Variable d'environnement**
```env
UPDATE_BASE_URL=https://your-app.vercel.app
```

**Option 2 : Modifier directement dans `electron/updater/updater.ts`**
```typescript
return 'https://your-app.vercel.app';
```

### 2. Déploiement Vercel

1. **Connecter votre repo à Vercel**
   ```bash
   vercel
   ```

2. **Configurer les variables d'environnement** (optionnel)
   - Dans le dashboard Vercel, ajoutez `NEXT_PUBLIC_VERCEL_URL` si nécessaire

3. **Déployer**
   - Chaque push sur `main` déclenche un déploiement
   - Le build Next.js est automatiquement créé

### 3. Génération de version.json

Le fichier `version.json` est généré automatiquement lors du build via `scripts/generate-version.js`.

Pour forcer une nouvelle version :
```bash
# Modifier la version dans package.json
npm version patch  # ou minor, major

# Rebuild et redéployer
npm run build
vercel --prod
```

## 🔄 Flux de Mise à Jour

1. **Déploiement Vercel** : Le build Next.js est déployé avec `version.json`
2. **Vérification Electron** : Au lancement, l'app vérifie `/api/update/version`
3. **Comparaison** : Compare avec la version locale
4. **Téléchargement** : Si nouvelle version, télécharge `/api/update/build`
5. **Remplacement** : Remplace le build local et redémarre

## 📦 Structure des API Routes

### `/api/update/version`

Retourne le `version.json` actuel :
```json
{
  "version": "1.0.0",
  "buildDate": "2024-01-15T10:30:00.000Z",
  "changelog": "Build Vercel"
}
```

### `/api/update/build`

Retourne un ZIP contenant tout le build Next.js (`.next/standalone`).

## 🚀 Workflow de Déploiement

### Développement

```bash
# Build local
npm run build:electron

# L'app utilise local-ui/ (pas de vérification Vercel)
```

### Production

```bash
# 1. Build et déployer sur Vercel
npm run build
vercel --prod

# 2. Les apps Electron vérifieront automatiquement
# et téléchargeront la nouvelle version au prochain lancement
```

## 🔧 Configuration Vercel

Le fichier `vercel.json` configure :
- **Timeout** : 300s pour la génération du ZIP
- **CORS** : Headers pour permettre les requêtes depuis Electron
- **Cache** : Headers de cache pour optimiser les performances

## 📝 Notes Importantes

### Build Next.js Standalone

Vercel utilise le mode `standalone` de Next.js, donc :
- Le build est dans `.next/standalone/`
- Les API routes sont dans `.next/standalone/app/api/`
- `version.json` doit être copié dans `.next/standalone/` lors du build

### Mise à jour du script de build

Assurez-vous que `scripts/copy-build-to-local-ui.js` copie aussi vers `.next/standalone/` si nécessaire pour Vercel.

### Sécurité

- Les endpoints sont publics (pas d'authentification)
- Pour sécuriser, ajoutez une vérification de token dans les API routes
- Utilisez des variables d'environnement pour les secrets

## 🐛 Dépannage

### L'API retourne 404

- Vérifiez que le build Vercel contient bien `version.json`
- Vérifiez que les API routes sont dans `app/api/update/`

### Le ZIP est vide ou corrompu

- Vérifiez que `.next/standalone` existe après le build
- Vérifiez les logs Vercel pour les erreurs

### L'app Electron ne trouve pas la nouvelle version

- Vérifiez que `UPDATE_BASE_URL` pointe vers la bonne URL Vercel
- Vérifiez les logs Electron dans la console
- Testez manuellement : `curl https://your-app.vercel.app/api/update/version`

