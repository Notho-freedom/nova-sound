# Pourquoi on n'utilise plus `local-ui` ?

## 🎯 Nouveau Workflow : Serveur Next.js Standalone Intégré

Avec le nouveau workflow, **Electron démarre directement le serveur Next.js standalone** depuis `.next/standalone`. Plus besoin de copier les fichiers vers `local-ui`.

## 📊 Comparaison

### ❌ Ancien Workflow (OBSOLÈTE)

```
1. Build Next.js → .next/standalone
2. Copier vers local-ui/ (fichiers statiques)
3. Electron charge local-ui/index.html (fichier statique)
```

**Problèmes :**
- Pas de SSR (Server-Side Rendering)
- Pas d'API routes Next.js
- Fichiers dupliqués
- Build plus long

### ✅ Nouveau Workflow (ACTUEL)

```
1. Build Next.js → .next/standalone
2. Electron démarre le serveur depuis .next/standalone
3. Fenêtre charge http://localhost:3000 (serveur intégré)
```

**Avantages :**
- ✅ SSR complet
- ✅ Toutes les API routes Next.js disponibles
- ✅ Pas de duplication de fichiers
- ✅ Build plus rapide
- ✅ Secrets sécurisés côté serveur

## 🔧 Implémentation

Le serveur Next.js standalone est démarré dans `electron/main.ts` :

```typescript
async function startNextServer(): Promise<void> {
  // Charger .next/standalone
  const standalonePath = path.join(appPath, '.next/standalone');
  
  // Initialiser Next.js
  nextApp = next({
    dev: false,
    dir: standalonePath,
  });
  
  await nextApp.prepare();
  
  // Créer le serveur HTTP
  const handle = nextApp.getRequestHandler();
  nextServer = createServer((req, res) => handle(req, res));
  nextServer.listen(3000);
}
```

## 📦 Packaging

Le packaging inclut uniquement :
- `.next/standalone/**/*` → Serveur Next.js
- `.next/static/**/*` → Assets statiques
- `dist-electron/**/*` → Code Electron

**Exclu :**
- `local-ui/**/*` → Plus nécessaire
- `public/local-ui/**/*` → Plus nécessaire

## 🧹 Nettoyage

Si vous avez des dossiers `local-ui` existants, vous pouvez les supprimer :

```bash
# Supprimer les anciens dossiers local-ui
rm -rf local-ui
rm -rf public/local-ui
```

Ils ne sont plus utilisés avec le nouveau workflow.

