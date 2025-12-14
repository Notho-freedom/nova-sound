# Workflow Next.js Standalone avec Serveur Intégré dans Electron

## 📋 Vue d'ensemble

Ce document décrit le workflow idéal pour intégrer **Next.js avec SSR** dans Electron, où **le serveur Next.js tourne directement dans le processus principal Electron**, et la fenêtre Electron charge le contenu via `http://localhost:PORT`.

## 🎯 Objectifs

1. ✅ Next.js est packagé avec Electron (standalone)
2. ✅ La fenêtre Electron affiche les pages Next **directement** via un serveur local
3. ✅ Les secrets côté serveur restent sécurisés (non exposés au client)
4. ✅ Fonctionne en mode offline (pas de dépendance externe)

---

## 🔧 Configuration

### 1. Next.js Config (`next.config.js`)

```js
const nextConfig = {
  output: 'standalone',  // ⚠️ CRITIQUE : Génère le build standalone
  reactStrictMode: true,
  // ... autres configs
};
```

**Important** : `output: 'standalone'` génère `.next/standalone` avec :
- `server.js` → serveur Node minimal
- `node_modules/` → dépendances nécessaires
- `.next/` → pages SSR / API routes compilées
- `static/` → fichiers statiques

### 2. Electron Main Process (`electron/main.ts`)

Le processus principal Electron démarre le serveur Next.js standalone :

```typescript
import { createServer } from 'http';
import next from 'next';
import dotenv from 'dotenv';

async function startNextServer(): Promise<void> {
  if (isDev) {
    // En dev, le serveur Next.js tourne déjà via "next dev"
    return;
  }

  // En production, démarrer le serveur Next.js standalone
  // 1. Charger les variables d'environnement
  dotenv.config({ path: path.join(appPath, '.env') });

  // 2. Chemin vers le build standalone
  const standalonePath = path.join(appPath, '.next/standalone');

  // 3. Initialiser Next.js
  nextApp = next({
    dev: false,
    dir: standalonePath,
  });

  await nextApp.prepare();

  // 4. Créer le serveur HTTP
  const handle = nextApp.getRequestHandler();
  nextServer = createServer((req, res) => handle(req, res));

  // 5. Démarrer sur un port local
  await new Promise<void>((resolve) => {
    nextServer.listen(3000, () => {
      console.log('Next.js server running at http://localhost:3000');
      resolve();
    });
  });
}
```

### 3. Chargement dans BrowserWindow

```typescript
function createWindow() {
  mainWindow = new BrowserWindow({
    // ... config
  });

  // TOUJOURS charger depuis localhost (dev ou production)
  const port = 3000;
  mainWindow.loadURL(`http://localhost:${port}`);
}
```

### 4. Packaging (`package.json`)

```json
{
  "build": {
    "files": [
      "dist-electron/**/*",
      ".next/standalone/**/*",    // ⚠️ Inclure le standalone
      ".next/static/**/*",        // ⚠️ Inclure les assets statiques
      "public/**/*",
      "!.next/cache/**/*",        // Exclure le cache
      "!local-ui/**/*"            // ⚠️ Plus besoin de local-ui (serveur intégré)
    ]
  }
}
```

**Note importante** : Avec le serveur Next.js standalone intégré, **plus besoin de copier vers `local-ui`**. Electron charge directement depuis `.next/standalone` via le serveur intégré.

---

## 🚀 Workflow de Build

### Étape 1 : Build Next.js

```bash
npm run build
```

Génère `.next/standalone` avec le serveur Node minimal.

### Étape 2 : Build Electron

```bash
npm run build:electron
```

1. Build Next.js (`npm run build`)
2. Compilation TypeScript Electron (`tsc`)
3. Le standalone est prêt pour le packaging

### Étape 3 : Packaging

```bash
npm run package
```

Electron Builder inclut :
- `dist-electron/` → Code Electron compilé
- `.next/standalone/` → Serveur Next.js standalone
- `.next/static/` → Assets statiques
- `public/` → Fichiers publics
- `.env` → Variables d'environnement (si inclus)

---

## 🔐 Gestion des Secrets

### Variables d'Environnement

Le fichier `.env` est chargé côté serveur dans le processus principal Electron :

```typescript
// Dans electron/main.ts
dotenv.config({ path: path.join(appPath, '.env') });
```

**Important** :
- ✅ Les variables `NEXT_PUBLIC_*` sont exposées au client
- ✅ Les autres variables restent **sécurisées** côté serveur
- ✅ Le fichier `.env` peut être inclus dans le packaging si nécessaire

### Exemple

```env
# .env
DATABASE_URL=secret://...          # ✅ Côté serveur uniquement
NEXT_PUBLIC_API_URL=https://...    # ⚠️ Exposé au client
STRIPE_SECRET_KEY=sk_...           # ✅ Côté serveur uniquement
```

---

## 📁 Structure des Fichiers

```
nova-sound/
├── .next/
│   ├── standalone/          # ⚠️ Build standalone Next.js
│   │   ├── server.js
│   │   ├── node_modules/
│   │   ├── .next/
│   │   └── static/
│   └── static/              # Assets statiques
├── dist-electron/           # Code Electron compilé
│   └── main.js
├── electron/
│   └── main.ts              # Processus principal
├── app/                     # Pages Next.js
├── .env                     # Variables d'environnement
└── package.json
```

---

## 🔄 Flux d'Exécution

### Développement

```
1. "next dev" démarre sur localhost:3000
2. Electron charge http://localhost:3000
3. Hot reload fonctionne normalement
```

### Production

```
1. Electron démarre
2. startNextServer() lance le serveur Next.js standalone
3. Serveur écoute sur localhost:3000
4. BrowserWindow charge http://localhost:3000
5. Toutes les pages Next.js sont accessibles avec SSR
```

---

## ✅ Avantages

1. **SSR Complet** : Toutes les fonctionnalités Next.js (SSR, API routes, etc.)
2. **Sécurité** : Secrets côté serveur non exposés
3. **Offline-First** : Fonctionne sans connexion internet
4. **Performance** : Serveur intégré, pas de latence réseau
5. **Flexibilité** : Toutes les routes API Next.js disponibles

---

## ⚠️ Points d'Attention

### 1. Port Dynamique

Le port peut être changé dynamiquement si nécessaire :

```typescript
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
```

### 2. Chemin du Standalone

En production packagée, utiliser `app.getAppPath()` :

```typescript
const appPath = app.isPackaged 
  ? path.dirname(app.getAppPath())
  : path.join(__dirname, '..');
```

### 3. Nettoyage

Fermer le serveur à la fermeture de l'app :

```typescript
app.on('before-quit', () => {
  if (nextServer) {
    nextServer.close();
  }
});
```

---

## 🧪 Tests

### Test en Développement

```bash
npm run dev:electron
```

### Test en Production (local)

```bash
npm run build:electron
npm run electron
```

### Test du Package

```bash
npm run package
# Tester l'exécutable généré dans release/
```

---

## 📝 Résumé

1. ✅ Build Next.js avec `output: 'standalone'`
2. ✅ Dans Electron, démarrer le serveur Node minimal fourni par le standalone
3. ✅ Charger `http://localhost:PORT` dans `BrowserWindow`
4. ✅ Packager Electron avec `.next/standalone` et `.env`
5. ✅ Résultat : Un exe auto-suffisant avec serveur intégré

---

## 🔗 Références

- [Next.js Standalone Output](https://nextjs.org/docs/advanced-features/output-file-tracing)
- [Electron + Next.js Integration](https://www.electronjs.org/docs/latest/tutorial/process-model)

