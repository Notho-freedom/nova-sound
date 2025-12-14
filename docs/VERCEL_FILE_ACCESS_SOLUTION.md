# 🔧 Solution pour l'Accès aux Fichiers sur Vercel

## 🔍 Problème Identifié

Sur Vercel, les fonctions serverless sont isolées :
- **CWD**: `/var/task`
- **Function Dir**: `/var/task/app/api/update/build`
- **Problème**: `.next/standalone` n'est pas accessible depuis les fonctions serverless

## 💡 Solutions Possibles

### Solution 1: Utiliser le Dossier `public/` (Recommandé)

Copier `local-ui` vers `public/local-ui` pendant le build. Le dossier `public/` est accessible depuis les routes API.

**Avantages**:
- ✅ Accessible depuis les routes API
- ✅ Inclus dans le déploiement
- ✅ Simple à implémenter

**Modifications nécessaires**:
1. Modifier `copy-build-to-local-ui.js` pour copier aussi vers `public/local-ui`
2. Modifier les routes API pour chercher dans `public/local-ui` en priorité

### Solution 2: Utiliser une Variable d'Environnement

Définir le chemin dans une variable d'environnement Vercel.

**Avantages**:
- ✅ Configurable par environnement
- ✅ Flexible

**Inconvénients**:
- ⚠️ Nécessite configuration manuelle

### Solution 3: Utiliser Directement `.next/standalone`

Utiliser directement `.next/standalone` comme source, sans créer `local-ui`.

**Avantages**:
- ✅ Pas besoin de copier
- ✅ Utilise le build existant

**Inconvénients**:
- ⚠️ Contient beaucoup de fichiers inutiles pour Electron
- ⚠️ Peut ne pas être accessible depuis les fonctions serverless

### Solution 4: Créer un Endpoint qui Lit depuis le Build Source

Créer un endpoint qui lit directement depuis le repository Git ou un stockage externe.

**Avantages**:
- ✅ Fiable
- ✅ Indépendant de la structure Vercel

**Inconvénients**:
- ⚠️ Plus complexe
- ⚠️ Nécessite un stockage externe

---

## 🎯 Solution Recommandée: Utiliser `public/`

### Implémentation

1. **Modifier `copy-build-to-local-ui.js`**:
```javascript
// Copier aussi vers public/local-ui
const publicLocalUIPath = path.join(__dirname, '../public/local-ui');
copyToLocalUI(publicLocalUIPath, ['local-ui']);
```

2. **Modifier les routes API**:
```typescript
const possiblePaths = [
  path.join(process.cwd(), 'public', 'local-ui'), // Priorité
  path.join(process.cwd(), '.next', 'standalone', 'local-ui'),
  // ... autres chemins
];
```

3. **Ajouter `public/local-ui` à `.gitignore`** (si nécessaire)

---

## 📝 Prochaines Étapes

1. Implémenter la Solution 1 (public/)
2. Redéployer
3. Tester les endpoints
4. Si ça ne fonctionne pas, essayer Solution 2 ou 3

---

## 🔍 Logs de Débogage Actuels

Les logs actuels montrent:
- `CWD: /var/task`
- `Function dir: /var/task/app/api/update/build`
- Aucun des chemins vérifiés n'existe

Cela confirme que `.next/standalone` n'est pas accessible depuis les fonctions serverless de cette manière.

