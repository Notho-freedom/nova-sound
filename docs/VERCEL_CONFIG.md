# 📋 Configuration Vercel Complète

## 📄 Fichier `vercel.json`

### Configuration Générale

```json
{
  "version": 2,                    // Version de la configuration Vercel
  "framework": "nextjs",           // Framework détecté automatiquement
  "buildCommand": "...",           // Commande de build personnalisée
  "installCommand": "npm install",  // Commande d'installation
  "outputDirectory": ".next",       // Dossier de sortie Next.js
  "regions": ["iad1"]              // Région de déploiement (US East)
}
```

### Build Command

**`"buildCommand": "npm run build && npm run postbuild"`**

Cette commande :
1. **`npm run build`** : Build Next.js en mode standalone
2. **`npm run postbuild`** : 
   - Copie le build vers `local-ui/`
   - Génère `local-ui/version.json`

**Important** : Sans cette commande, `local-ui/` ne serait pas créé sur Vercel.

---

## ⚙️ Functions Configuration

### `/api/update/build`
```json
{
  "maxDuration": 300,  // 5 minutes (nécessaire pour créer le ZIP)
  "memory": 1024       // 1GB (pour gérer les gros fichiers)
}
```

**Raison** : La création du ZIP peut prendre du temps et nécessite de la mémoire.

### `/api/update/version` et `/api/update/check`
```json
{
  "maxDuration": 10,   // 10 secondes (suffisant)
  "memory": 256        // 256MB (standard)
}
```

**Raison** : Ces endpoints sont rapides et ne nécessitent pas beaucoup de ressources.

---

## 🔒 Headers Configuration

### CORS pour `/api/update/*`

```json
{
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-cache, no-store, must-revalidate"
}
```

**Raison** :
- Permet l'accès depuis Electron (origine différente)
- Supporte GET, POST et OPTIONS (preflight)
- Désactive le cache pour les données de version

### Sécurité pour `/api/*`

```json
{
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block"
}
```

**Raison** : Headers de sécurité standards pour protéger les API.

---

## 🔄 Rewrites

Les rewrites sont optionnels mais peuvent être utiles pour :
- Rediriger des URLs
- Créer des alias
- Gérer des routes dynamiques

Dans notre cas, ils sont redondants car Next.js gère déjà les routes, mais ils peuvent servir de documentation.

---

## 🌍 Régions

**`"regions": ["iad1"]`**

- **iad1** : US East (Virginia) - Région par défaut
- Autres options : `cdg1` (Paris), `sfo1` (San Francisco), etc.

**Note** : Vous pouvez spécifier plusieurs régions pour la haute disponibilité.

---

## 📝 Variables d'Environnement

Les variables d'environnement doivent être configurées dans le dashboard Vercel :

1. Allez sur https://vercel.com/dashboard
2. Sélectionnez votre projet
3. Settings → Environment Variables
4. Ajoutez les variables nécessaires :
   - `UPDATE_BASE_URL` (optionnel, peut être dans le code)
   - `NEXT_PUBLIC_FIREBASE_*`
   - `FIREBASE_*`
   - `STRIPE_*`
   - etc.

---

## 🚀 Déploiement

### Via CLI
```bash
vercel --prod
```

### Via Git
```bash
git add vercel.json
git commit -m "feat: Complete Vercel configuration"
git push
```

---

## ✅ Checklist de Configuration

- [x] `buildCommand` configuré pour créer `local-ui/`
- [x] `maxDuration` configuré pour `/api/update/build` (300s)
- [x] Headers CORS configurés pour `/api/update/*`
- [x] Headers de sécurité configurés pour `/api/*`
- [x] Région de déploiement spécifiée
- [ ] Variables d'environnement configurées dans le dashboard
- [ ] Test des endpoints après déploiement

---

## 🔍 Vérification Post-Déploiement

Après le déploiement, vérifiez :

```bash
# Version endpoint
curl https://nova-sound-nine.vercel.app/api/update/version

# Build endpoint (devrait retourner un ZIP)
curl -I https://nova-sound-nine.vercel.app/api/update/build

# Check endpoint
curl -X POST https://nova-sound-nine.vercel.app/api/update/check \
  -H "Content-Type: application/json" \
  -d '{"currentVersion":"1.0.0","currentBuildNumber":1234567890}'
```

---

## 📚 Documentation Vercel

- [Configuration Reference](https://vercel.com/docs/projects/project-configuration)
- [Functions Configuration](https://vercel.com/docs/functions/serverless-functions/runtimes/node-js)
- [Headers Configuration](https://vercel.com/docs/projects/project-configuration/headers)
- [Regions](https://vercel.com/docs/edge-network/regions)

