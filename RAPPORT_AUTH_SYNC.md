# 📋 Rapport sur les Systèmes d'Authentification et de Synchronisation
## NEXUS Audio Player

**Date**: Décembre 2024  
**Version**: 1.0.0

---

## 📑 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture des Systèmes](#architecture-des-systèmes)
3. [Système d'Authentification](#système-dauthentification)
4. [Système de Synchronisation](#système-de-synchronisation)
5. [Flux d'Authentification](#flux-dauthentification)
6. [Flux de Synchronisation](#flux-de-synchronisation)
7. [Optimisations et Performances](#optimisations-et-performances)
8. [Sécurité](#sécurité)
9. [Points d'attention](#points-dattention)

---

## 🎯 Vue d'ensemble

L'application NEXUS utilise un système d'authentification hybride combinant **Firebase Authentication** et **OAuth manuel Google**, avec une synchronisation bidirectionnelle en temps réel via **Firestore**. Cette architecture permet une expérience utilisateur fluide tout en garantissant la sécurité et la persistance des données.

### Composants principaux

- **AuthService** (`src/services/auth.ts`) : Authentification OAuth manuelle Google
- **FirebaseService** (`src/services/firebase.ts`) : Authentification Firebase avec support anonyme
- **FirebaseSyncService** (`src/services/firebase-sync.ts`) : Synchronisation Firestore ↔ LocalStorage
- **NexusServerService** (`src/services/nexus-server.ts`) : Service serveur pour upload/download
- **useCloudSync** (`src/hooks/useCloudSync.ts`) : Hook React orchestrant tous les systèmes

---

## 🏗️ Architecture des Systèmes

### Hiérarchie des Services

```
┌─────────────────────────────────────┐
│      useCloudSync (Hook React)      │
│    Orchestrateur principal          │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼──────┐  ┌──────▼──────────┐
│ AuthService │  │ FirebaseService │
│ (OAuth)     │  │ (Firebase Auth) │
└──────┬──────┘  └──────┬──────────┘
       │                │
       └───────┬────────┘
               │
       ┌───────▼──────────┐
       │ FirebaseSync     │
       │ (Firestore Sync) │
       └───────┬──────────┘
               │
       ┌───────▼──────────┐
       │ NexusServer      │
       │ (API Backend)    │
       └──────────────────┘
```

### Priorité d'Authentification

Le système suit une logique de priorité en cascade :

1. **PRIORITÉ 1** : Utilisateur Firebase non-anonyme (Google connecté via Firebase)
2. **PRIORITÉ 2** : Utilisateur Google local (OAuth manuel) → Tentative de sync avec Firestore
3. **PRIORITÉ 3** : Utilisateur Firebase anonyme → En attente de liaison Google

---

## 🔐 Système d'Authentification

### 1. AuthService (OAuth Manuel)

**Fichier**: `src/services/auth.ts`

#### Fonctionnalités

- **OAuth 2.0 avec PKCE** : Flow sécurisé avec Proof Key for Code Exchange
- **Gestion des tokens** : Access token, refresh token, ID token avec expiration automatique
- **Stockage local** : localStorage pour persistance (profil + tokens)
- **API Route sécurisée** : Échange de code via `/api/oauth/token` (client_secret côté serveur)

#### Flux OAuth

```
1. Génération PKCE (codeVerifier + codeChallenge)
2. Redirection vers Google OAuth
3. Retour avec code + state
4. Vérification state
5. Échange code → tokens (via API route serveur)
6. Récupération userInfo Google
7. Création profil utilisateur
8. Notification listeners
```

#### Méthodes principales

```typescript
- signInWithGoogle(): Promise<void>
- handleCallback(): Promise<UserProfile | null>
- getAccessToken(): Promise<string | null>
- getIdToken(): Promise<string | null>
- refreshAccessToken(): Promise<AuthTokens>
- onAuthStateChange(callback): () => void
```

#### Stockage

- `nexus-user-profile` : Profil utilisateur JSON
- `nexus-auth-tokens` : Tokens OAuth (access, refresh, id, expiresAt)
- `nexus-google-client-id` : Client ID Google (cache)

---

### 2. FirebaseService (Firebase Authentication)

**Fichier**: `src/services/firebase.ts`

#### Fonctionnalités

- **Authentification anonyme** : Création automatique d'utilisateur anonyme
- **Authentification Google** : Via Firebase Auth (popup/redirect)
- **Liaison de comptes** : Fusion anonyme → Google avec priorité Google
- **Firestore Profile** : Stockage profil dans `users/{uid}`
- **Persistence automatique** : Firebase gère la persistance des sessions

#### Flux d'Authentification

```
1. Initialisation Firebase (config depuis /api/config/firebase)
2. Vérification utilisateur existant
3. Si aucun → Création utilisateur anonyme
4. Si anonyme + Google disponible → Liaison
5. Chargement profil Firestore
6. Notification listeners
```

#### Méthodes principales

```typescript
- signInAnonymously(): Promise<UserProfile>
- signInWithGoogle(): Promise<void>
- linkWithGoogleCredential(idToken, accessToken, googleData): Promise<UserProfile>
- findUserByEmail(email): Promise<UserProfile | null>
- getIdToken(forceRefresh): Promise<string | null>
- onAuthStateChange(callback): () => void
```

#### Structure Firestore

```
users/
  {uid}/
    - email: string
    - displayName: string
    - photoURL: string | null
    - plan: "free" | "pro"
    - subscriptionStatus: "active" | "canceled" | ...
    - storageUsed: number
    - createdAt: timestamp
    - lastLoginAt: timestamp
```

---

## 🔄 Système de Synchronisation

### FirebaseSyncService

**Fichier**: `src/services/firebase-sync.ts`

#### Architecture

Le service implémente une synchronisation **bidirectionnelle en temps réel** entre Firestore et localStorage, avec :

- **Listeners temps réel** : `onSnapshot` pour détecter changements Firestore
- **Queue de synchronisation** : Debounce et batch des modifications locales
- **Détection de changements** : Hash-based pour éviter syncs inutiles
- **Résolution de conflits** : Firestore prend priorité au premier chargement, puis last-write-wins

#### Données synchronisées

```typescript
interface UserAppData {
  settings?: Settings              // Paramètres application
  favorites?: string[]             // IDs pistes favorites
  history?: HistoryEntry[]         // Historique de lecture
  theme?: Theme                    // Thème UI
  notificationsEnabled?: boolean   // Notifications
  volume?: number                  // Volume (0-100)
  searchHistory?: string[]        // Historique recherche
  uploadedMedia?: Array<...>      // Médias uploadés
  cloudinaryConfig?: {...}         // Config Cloudinary
  equalizerPresets?: [...]        // Presets égaliseur
  scrobblerSettings?: {...}       // Config scrobbling
  playlists?: Playlist[]          // Playlists (subcollection)
}
```

#### Structure Firestore

```
users/
  {uid}/
    appData/
      data/                        // Données principales
        - settings
        - favorites
        - history
        - theme
        - ...
    playlists/                    // Subcollection playlists
      {playlistId}/
        - name
        - trackIds
        - createdAt
        - ...
```

#### Mécanismes de Synchronisation

**1. Synchronisation Temps Réel (Firestore → Local)**

```typescript
// Listener principal
onSnapshot(appDataRef, (snapshot) => {
  if (snapshot.exists() && !isSyncing) {
    const data = snapshot.data() as UserAppData;
    handleRemoteUpdate(data); // → localStorage + Electron
  }
});
```

**2. Synchronisation Locale → Firestore**

```typescript
// Queue avec debounce (2 secondes)
queueSync(type: string, data: any): void {
  // 1. Sauvegarde locale immédiate
  saveDataLocally({ [type]: data });
  
  // 2. Mark comme pending
  pendingChanges.add(type);
  
  // 3. Debounce sync Firestore
  setTimeout(() => {
    if (dataChanged) {
      saveToFirestore(userId, { [type]: data });
    }
  }, 2000);
}
```

**3. Synchronisation Périodique**

```typescript
// Toutes les heures
setInterval(async () => {
  const currentData = getCurrentLocalData();
  const newHash = calculateDataHash(currentData);
  
  if (pendingChanges.size > 0 || newHash !== lastSyncedDataHash) {
    await saveToFirestore(userId);
  }
}, 60 * 60 * 1000); // 1 heure
```

#### Gestion des Erreurs

- **Reconnexion automatique** : Exponential backoff (max 3 tentatives)
- **Fallback localStorage** : En cas d'erreur Firestore
- **Isolation utilisateur** : Clés localStorage isolées par UID
- **Migration automatique** : Migration anciennes clés → clés isolées

---

## 🔀 Flux d'Authentification

### Scénario 1 : Nouvel Utilisateur

```
1. Application démarre
2. useCloudSync s'initialise
3. Aucun utilisateur détecté
4. FirebaseService.signInAnonymously()
   → Création utilisateur anonyme Firebase
   → Création profil Firestore (plan: "free")
5. UI mise à jour : utilisateur anonyme (non authentifié)
6. Utilisateur clique "Se connecter avec Google"
7. AuthService.signInWithGoogle()
   → Redirection Google OAuth
8. Retour avec code OAuth
9. AuthService.handleCallback()
   → Échange code → tokens (via API route)
   → Récupération userInfo Google
10. FirebaseService.linkWithGoogleCredential()
    → Liaison compte Google à utilisateur anonyme
    → Firebase remplace automatiquement utilisateur anonyme
    → Mise à jour profil Firestore (Google data prioritaire)
11. FirebaseSyncService.initializeSync(uid)
    → Setup listeners temps réel
    → Chargement données Firestore → localStorage
12. UI mise à jour : utilisateur Google (authentifié)
```

### Scénario 2 : Utilisateur Existant

```
1. Application démarre
2. Firebase détecte session persistante
3. FirebaseService.onAuthStateChanged() déclenché
4. Chargement profil Firestore
5. Si utilisateur Google (non-anonyme) :
   → FirebaseSyncService.initializeSync(uid)
   → Chargement données Firestore
6. UI mise à jour : utilisateur connecté
```

### Scénario 3 : Utilisateur Local (OAuth Manuel)

```
1. Application démarre
2. AuthService charge profil depuis localStorage
3. Si profil Google local existe :
   → UI mise à jour immédiatement
   → Tentative sync avec Firestore (findUserByEmail)
   → Si utilisateur existe dans Firestore :
      → Remplacer profil local par profil Firestore
   → Sinon : garder profil local
4. FirebaseSyncService initialisé si Firebase user existe
```

---

## 🔄 Flux de Synchronisation

### Synchronisation Initiale

```
1. FirebaseSyncService.initializeSync(userId)
2. loadFromFirestore(userId)
   → Chargement données Firestore
   → Merge avec localStorage (Firestore prioritaire)
3. setupRealtimeListeners(userId)
   → Listener appData (onSnapshot)
   → Listener playlists (onSnapshot)
4. startPeriodicSync(userId)
   → Interval 1 heure
5. Calcul hash initial pour détection changements
```

### Synchronisation Locale → Firestore

```
1. Utilisateur modifie paramètre (ex: theme)
2. Composant appelle firebaseSyncService.queueSync('theme', 'dark')
3. Sauvegarde locale immédiate (localStorage)
4. Mark 'theme' comme pending
5. Debounce 2 secondes
6. Après 2 secondes :
   → Calcul hash données actuelles
   → Comparaison avec lastSyncedDataHash
   → Si différent : saveToFirestore()
   → Mise à jour hash
```

### Synchronisation Firestore → Local

```
1. Changement détecté dans Firestore (autre appareil)
2. onSnapshot déclenché
3. handleRemoteUpdate(data)
   → Sauvegarde dans localStorage
   → Si Electron : updateSettings()
   → Dispatch événement 'firebase-sync-update'
4. Composants React écoutent événement
5. UI mise à jour automatiquement
```

---

## ⚡ Optimisations et Performances

### 1. Cache et Debounce

**NexusServerService.getSyncStatus()**
- Cache de 5 secondes pour éviter appels API répétés
- Paramètre `forceRefresh` pour forcer rafraîchissement

**useCloudSync**
- Debounce de 1 seconde pour chargement sync status
- Timer géré via `useRef` pour éviter re-renders

**FirebaseSyncService.queueSync()**
- Debounce de 2 secondes pour batch modifications
- Détection changements via hash (évite syncs inutiles)

### 2. Prévention Initialisations Multiples

```typescript
// useCloudSync.ts
const syncInitializedRef = useRef<boolean>(false);
const lastUserIdRef = useRef<string | null>(null);
const anonymousUserInitRef = useRef<boolean>(false);

// FirebaseSyncService
private isInitializing: boolean = false;
private isInitialized: boolean = false;
```

### 3. Listeners Optimisés

- **Silent mode** : Logs minimaux pour opérations normales
- **Reconnexion intelligente** : Exponential backoff (max 3 tentatives)
- **Cleanup automatique** : Nettoyage listeners au démontage

### 4. Isolation Utilisateur

```typescript
// Clés localStorage isolées par UID
getUserStorageKey('nexus-uploaded-media', userId)
// → 'nexus-uploaded-media:userId123'
```

---

## 🔒 Sécurité

### 1. OAuth 2.0 avec PKCE

- **Code Verifier** : 128 caractères aléatoires
- **Code Challenge** : SHA256 hash (base64url)
- **State** : Protection CSRF (32 caractères aléatoires)
- **Client Secret** : Jamais exposé côté client (API route serveur)

### 2. Tokens

- **Access Token** : Auto-refresh si expiration < 5 minutes
- **Refresh Token** : Stocké localStorage (chiffrement recommandé en production)
- **ID Token** : Pour vérification backend (JWT)

### 3. API Routes Sécurisées

```typescript
// app/api/oauth/token/route.ts
// Utilise GOOGLE_CLIENT_SECRET (serveur uniquement)
// Jamais exposé au client

// app/api/auth/middleware.ts
// Vérification ID token Google
// Rate limiting
```

### 4. Firestore Security Rules

```javascript
// Recommandation (à implémenter)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## ⚠️ Points d'Attention

### 1. Gestion des Conflits

**Actuel** : Last-write-wins (Firestore prioritaire au premier chargement)

**Amélioration possible** :
- Timestamp-based conflict resolution
- Merge intelligent pour certains champs (ex: favorites)
- Versioning avec numéro de version

### 2. Performance Firestore

**Limites** :
- 1 Mo par document (limite Firestore)
- 500 opérations écriture/seconde par document
- Coûts selon utilisation

**Optimisations** :
- Subcollections pour playlists (évite limite 1 Mo)
- Batch writes pour modifications multiples
- Pagination pour grandes collections

### 3. Offline Support

**Actuel** : Firebase gère persistance automatique

**Amélioration possible** :
- Queue offline pour modifications
- Sync automatique à reconnexion
- Indicateur statut connexion

### 4. Migration Utilisateurs

**Scénario** : Utilisateur avec données locales → Migration Firestore

**Processus actuel** :
1. Détection utilisateur local
2. Tentative findUserByEmail()
3. Si existe : remplacement profil local
4. Si n'existe pas : création profil Firestore

**Amélioration possible** :
- Migration automatique données locales → Firestore
- Merge intelligent données existantes
- Backup avant migration

### 5. Gestion Erreurs Réseau

**Actuel** :
- Fallback localStorage
- Reconnexion automatique (max 3 tentatives)
- Silent failures pour certaines erreurs

**Amélioration possible** :
- Retry queue persistante
- Notification utilisateur erreurs critiques
- Mode offline complet

---

## 📊 Métriques et Monitoring

### Métriques Recommandées

1. **Authentification**
   - Taux succès connexion Google
   - Temps moyen authentification
   - Taux échec refresh token

2. **Synchronisation**
   - Latence sync Firestore → Local
   - Latence sync Local → Firestore
   - Nombre conflits résolus
   - Taux échec sync

3. **Performance**
   - Temps chargement initial
   - Nombre appels API redondants
   - Utilisation cache

### Logs Actuels

- ✅ Initialisation services
- ✅ Changements état authentification
- ✅ Erreurs critiques
- ⚠️ Logs minimaux pour opérations normales (silent mode)

---

## 🎯 Recommandations

### Court Terme

1. **Implémenter Security Rules Firestore** : Protection données utilisateur
2. **Améliorer gestion erreurs** : Notifications utilisateur erreurs critiques
3. **Monitoring** : Ajouter métriques clés (taux succès, latence)

### Moyen Terme

1. **Résolution conflits avancée** : Timestamp-based + merge intelligent
2. **Mode offline complet** : Queue persistante + sync auto reconnexion
3. **Migration automatique** : Données locales → Firestore

### Long Terme

1. **Multi-provider auth** : Support autres providers (Apple, Microsoft)
2. **Sync sélectif** : Permettre utilisateur choisir données à sync
3. **Backup/Restore** : Export/import données utilisateur

---

## 📝 Conclusion

Le système d'authentification et de synchronisation de NEXUS est **robuste et performant**, avec une architecture modulaire permettant une maintenance facile. Les optimisations récentes (cache, debounce, isolation utilisateur) ont considérablement amélioré les performances.

**Points forts** :
- ✅ Architecture modulaire et extensible
- ✅ Sécurité OAuth 2.0 avec PKCE
- ✅ Synchronisation temps réel bidirectionnelle
- ✅ Optimisations performance (cache, debounce)
- ✅ Gestion erreurs et reconnexion automatique

**Axes d'amélioration** :
- 🔄 Résolution conflits plus sophistiquée
- 🔄 Mode offline complet
- 🔄 Monitoring et métriques
- 🔄 Security Rules Firestore

---

**Document généré automatiquement**  
**Dernière mise à jour** : Décembre 2024

