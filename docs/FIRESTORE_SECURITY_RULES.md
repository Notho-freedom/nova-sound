# Firestore Security Rules - NEXUS Audio Player

## Vue d'ensemble

Ce document décrit les règles de sécurité Firestore recommandées pour NEXUS Audio Player. Ces règles garantissent que chaque utilisateur ne peut accéder qu'à ses propres données.

## Règles Recommandées

Copiez ces règles dans votre console Firebase:
**Firebase Console > Firestore Database > Rules**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Fonction utilitaire: vérifie si l'utilisateur est authentifié
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Fonction utilitaire: vérifie si l'utilisateur accède à ses propres données
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    // Fonction utilitaire: limite la taille des données
    function isValidSize() {
      return request.resource.data.size() < 1000000; // 1MB max
    }
    
    // Collection users - données utilisateur
    match /users/{userId} {
      // Lecture: uniquement le propriétaire
      allow read: if isOwner(userId);
      
      // Écriture: uniquement le propriétaire, avec validation
      allow write: if isOwner(userId) && isValidSize();
      
      // Sous-collection playlists
      match /playlists/{playlistId} {
        allow read: if isOwner(userId);
        allow write: if isOwner(userId);
        
        // Pistes dans les playlists
        match /tracks/{trackId} {
          allow read: if isOwner(userId);
          allow write: if isOwner(userId);
        }
      }
      
      // Sous-collection favoris (optionnel si séparé)
      match /favorites/{favoriteId} {
        allow read: if isOwner(userId);
        allow write: if isOwner(userId);
      }
      
      // Sous-collection historique (optionnel si séparé)
      match /history/{historyId} {
        allow read: if isOwner(userId);
        allow write: if isOwner(userId);
      }
    }
    
    // Bloquer tout accès non autorisé par défaut
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Explication des Règles

### 1. Authentification Requise

Toutes les opérations nécessitent une authentification Firebase:
- `request.auth != null` vérifie qu'un utilisateur est connecté
- `request.auth.uid` contient l'identifiant unique de l'utilisateur

### 2. Isolation des Données

Chaque utilisateur ne peut accéder qu'à ses propres documents:
- Le chemin `/users/{userId}` utilise l'UID Firebase
- La fonction `isOwner()` vérifie que `request.auth.uid == userId`

### 3. Limite de Taille

Pour éviter les abus, les documents sont limités à 1MB:
- `request.resource.data.size() < 1000000`

### 4. Sous-collections

Les playlists utilisent des sous-collections pour:
- Éviter la limite de 1MB par document
- Permettre des requêtes plus efficaces
- Isolation des données par playlist

## Structure des Données

```
/users/{userId}
├── settings: { ... }
├── favorites: [ ... ]
├── history: [ ... ]
├── volume: number
├── theme: string
├── equalizerPresets: [ ... ]
└── /playlists/{playlistId}
    ├── name: string
    ├── createdAt: timestamp
    └── /tracks/{trackId}
        ├── title: string
        ├── artist: string
        └── ...
```

## Tests de Sécurité

### Test 1: Accès à ses propres données
```javascript
// Devrait réussir
const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
```

### Test 2: Accès aux données d'un autre utilisateur
```javascript
// Devrait échouer avec "permission-denied"
const otherUserDoc = await getDoc(doc(db, 'users', 'autre-uid'));
```

### Test 3: Écriture sans authentification
```javascript
// Devrait échouer avec "permission-denied"
await setDoc(doc(db, 'users', 'quelque-uid'), { data: 'test' });
```

## Utilisation avec Firebase Emulator

Pour tester localement:

1. Installez Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Initialisez Firestore:
```bash
firebase init firestore
```

3. Copiez les règles dans `firestore.rules`

4. Lancez l'émulateur:
```bash
firebase emulators:start --only firestore
```

## Déploiement

Pour déployer les règles en production:

```bash
firebase deploy --only firestore:rules
```

## Bonnes Pratiques

1. **Ne jamais désactiver les règles en production**
   - Utilisez l'émulateur pour le développement

2. **Audit régulier**
   - Vérifiez les règles après chaque mise à jour

3. **Logs Firebase**
   - Activez les logs de sécurité dans Firebase Console

4. **Tests automatisés**
   - Utilisez `@firebase/rules-unit-testing` pour les tests

## Ressources

- [Documentation Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Rules Unit Testing](https://firebase.google.com/docs/firestore/security/test-rules-emulator)
- [Common Security Rules Patterns](https://firebase.google.com/docs/firestore/security/rules-structure)
