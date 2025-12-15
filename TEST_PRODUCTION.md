# Guide de test en production

## 🚀 Étapes pour tester l'application en mode production

### 1. Build du frontend Next.js

Le frontend Next.js doit être compilé en build statique :

```bash
npm run build
```

Cela génère le dossier `out/` avec tous les fichiers statiques (HTML, CSS, JS).

### 2. Configuration de l'URL du backend

Assurez-vous que `.env` contient l'URL du backend de production :

```bash
NEXT_PUBLIC_API_URL=https://backend-delta-ivory-17.vercel.app
```

**Note** : Les variables `NEXT_PUBLIC_*` sont intégrées au build au moment de la compilation. Si vous changez l'URL après le build, vous devrez rebuilder.

### 3. Build Electron

Compilez le code TypeScript d'Electron :

```bash
npm run build:electron
```

Ou simplement :

```bash
tsc -p electron/tsconfig.json
```

### 4. Lancer Electron en mode production

**Option A : Via script npm**

```bash
npm run electron
```

**Option B : Directement avec Electron**

```bash
# Windows PowerShell
$env:NODE_ENV="production"; electron .

# Windows CMD
set NODE_ENV=production && electron .

# Linux/Mac
NODE_ENV=production electron .
```

### 5. Vérifications

- ✅ L'application se charge depuis `out/index.html` (pas depuis `http://localhost:3000`)
- ✅ Les appels API pointent vers le backend Vercel
- ✅ Aucun serveur Next.js n'est nécessaire
- ✅ L'application fonctionne de manière autonome

## 📦 Package complet pour distribution

Pour créer un package distributable :

```bash
# Windows
npm run package:win

# macOS
npm run package:mac

# Linux
npm run package:linux

# Toutes les plateformes
npm run package
```

Les packages seront générés dans le dossier `dist/`.

## 🔍 Dépannage

### Erreur : "Build not found at: out/index.html"

**Solution** : Exécutez `npm run build` pour générer le build statique.

### L'application charge toujours depuis localhost:3000

**Solution** : Vérifiez que `NODE_ENV` n'est pas défini sur `development`. Utilisez `npm run electron` qui ne définit pas `NODE_ENV=development`.

### Les appels API échouent

**Solution** : 
1. Vérifiez que `NEXT_PUBLIC_API_URL` est défini dans `.env` avant le build
2. Rebuild le frontend : `npm run build`
3. Vérifiez que le backend est accessible : `npm run test:backend`

## 📝 Checklist de production

- [ ] Build Next.js généré (`out/` existe)
- [ ] Variables d'environnement configurées (`.env`)
- [ ] `NEXT_PUBLIC_API_URL` pointe vers le backend de production
- [ ] TypeScript Electron compilé (`dist-electron/` existe)
- [ ] Test de l'application en mode production réussi
- [ ] Package créé et testé (`dist/`)

