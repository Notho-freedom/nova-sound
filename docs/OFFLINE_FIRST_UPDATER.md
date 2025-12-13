# Système de Mise à Jour Offline-First

## 📋 Vue d'ensemble

Le système de mise à jour est **offline-first** : l'application utilise toujours le build local (`local-ui/`), et Internet ne sert qu'à vérifier et télécharger une nouvelle version si disponible.

## 🏗️ Architecture

```
nova-sound/
├─ electron/
│   └─ updater/
│       └─ updater.ts          # Module de mise à jour
├─ local-ui/                    # Build local (généré automatiquement)
│   ├─ index.html
│   ├─ version.json             # Version actuelle
│   └─ ... (fichiers du build Next.js)
└─ scripts/
    ├─ generate-version.js      # Génère version.json
    └─ copy-build-to-local-ui.js # Copie le build vers local-ui
```

## 🔄 Flux de Mise à Jour

1. **Au lancement** : Electron charge toujours depuis `local-ui/index.html`
2. **Vérification** : En arrière-plan, vérifie si une nouvelle version existe
3. **Téléchargement** : Si une nouvelle version est disponible, télécharge et remplace le build local
4. **Offline** : Si pas de connexion, continue avec le build local

## ⚙️ Configuration

### Variables d'environnement

Définissez les URLs de mise à jour dans votre `.env` ou dans `electron/updater/updater.ts` :

```typescript
const REMOTE_VERSION_URL = 'https://your-server.com/latest-build/version.json';
const REMOTE_BUILD_URL = 'https://your-server.com/latest-build/build.zip';
```

### Format de version.json

Le fichier `version.json` doit avoir ce format :

```json
{
  "version": "1.0.0",
  "buildDate": "2024-01-15T10:30:00.000Z",
  "changelog": "Description des changements"
}
```

## 📦 Build et Déploiement

### 1. Build local

```bash
npm run build:electron
```

Cela va :
- Builder Next.js
- Copier le build vers `local-ui/`
- Générer `version.json`
- Compiler TypeScript Electron

### 2. Préparer le build pour le serveur

```bash
# Créer un zip du dossier local-ui
cd local-ui
zip -r ../build.zip .
```

### 3. Déployer sur le serveur

Placez sur votre serveur :
- `version.json` à l'URL `REMOTE_VERSION_URL`
- `build.zip` à l'URL `REMOTE_BUILD_URL`

## 🔧 Fonctionnalités

### ✅ Avantages

- **Offline-first** : Fonctionne sans Internet
- **Mises à jour automatiques** : Vérification au lancement
- **Sécurisé** : Backup automatique avant mise à jour
- **Robuste** : Restauration en cas d'erreur

### 🔒 Sécurité

- Backup automatique avant mise à jour
- Restauration si l'extraction échoue
- Vérification de version avant remplacement

## 🐛 Dépannage

### Le build ne se met pas à jour

1. Vérifiez que les URLs sont correctes
2. Vérifiez que `version.json` distant a une version différente
3. Vérifiez les logs dans la console Electron

### Erreur d'extraction ZIP

- **Windows** : Assurez-vous que PowerShell ou 7-Zip est disponible
- **Linux/Mac** : Assurez-vous que `unzip` est installé

### Le build local n'existe pas

Exécutez `npm run build:electron` pour générer le build initial.

## 📝 Notes

- Le système vérifie les mises à jour uniquement en mode production
- En mode développement, le système de mise à jour est désactivé
- Les mises à jour sont non-bloquantes (l'app démarre même si la vérification échoue)

