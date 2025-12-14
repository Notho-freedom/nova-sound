# Configuration Electron + Next.js - Dev et Production

## 🚀 Option A - Développement (Next.js live + Electron)

### Scripts disponibles

```bash
# Démarre Next.js dev server + Electron en parallèle
npm run dev:electron
```

**Ce que fait le script :**
1. `next dev` → Démarre le serveur Next.js sur `http://localhost:3000`
2. `electron:dev` → Compile TypeScript Electron et lance Electron
3. Electron attend automatiquement que le serveur Next.js soit prêt avant de charger l'UI

### Fonctionnement

- **Next.js** : Serveur de développement avec hot reload
- **Electron** : Charge `http://localhost:3000` dans la fenêtre
- **Hot Reload** : Les changements dans Next.js sont reflétés automatiquement
- **DevTools** : Ouverts automatiquement en mode dev

### Dépannage

Si vous voyez un écran noir :
1. Vérifiez que Next.js est bien démarré (regardez les logs)
2. Attendez quelques secondes (Electron attend jusqu'à 30 secondes)
3. Vérifiez que le port 3000 n'est pas déjà utilisé

---

## 📦 Option C - Production (Standalone + serveur intégré)

### Build et Packaging

```bash
# 1. Build Next.js standalone
npm run build

# 2. Build Electron
npm run build:electron

# 3. Tester localement
npm run electron

# 4. Créer l'exécutable
npm run package
```

### Fonctionnement

1. **Build Next.js** : Génère `.next/standalone` avec le serveur Node minimal
2. **Electron démarre le serveur** : Lance le serveur Next.js standalone intégré
3. **Fenêtre charge localhost** : `http://localhost:3000` (serveur local intégré)

### Avantages

- ✅ **Offline-first** : Fonctionne sans connexion internet
- ✅ **SSR complet** : Toutes les fonctionnalités Next.js disponibles
- ✅ **Secrets sécurisés** : Variables d'environnement côté serveur uniquement
- ✅ **Exe autonome** : Tout est inclus dans l'exécutable

### Structure du build

```
.next/standalone/
├── server.js          # Serveur Node minimal
├── node_modules/      # Dépendances nécessaires
├── .next/             # Pages SSR / API routes
└── static/            # Fichiers statiques
```

---

## 🔧 Configuration

### Variables d'environnement

- **Dev** : Utilise `.env.local` ou `.env`
- **Production** : Variables chargées depuis `.env` dans le processus Electron

### Port

- **Par défaut** : `3000`
- **Personnalisable** : `--port 3001` ou `PORT=3001`

---

## 🐛 Dépannage

### Erreur "ERR_CONNECTION_REFUSED"

**En développement :**
- Vérifiez que `next dev` est bien lancé
- Utilisez `npm run dev:electron` au lieu de lancer Electron seul

**En production :**
- Vérifiez que `npm run build` a bien généré `.next/standalone`
- Vérifiez les logs Electron pour voir si le serveur démarre

### Écran noir

1. Ouvrez les DevTools (F12 ou automatique en dev)
2. Vérifiez la console pour les erreurs
3. Vérifiez que le serveur Next.js répond sur `/api/health`

### Port déjà utilisé

```bash
# Utiliser un autre port
PORT=3001 npm run dev:electron
```

---

## 📝 Notes importantes

- **Dev** : Le serveur Next.js doit être lancé avant Electron
- **Production** : Le serveur est démarré automatiquement par Electron
- **Hot Reload** : Fonctionne uniquement en mode dev
- **Secrets** : Jamais exposés au client (même en production)

