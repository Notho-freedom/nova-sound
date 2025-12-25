# Système de Backup Automatique

## Vue d'ensemble

Le système de backup automatique crée des sauvegardes horaires de toutes les données utilisateur (appData) dans Firebase Firestore, permettant une restauration complète en cas de perte de données.

## Fonctionnalités

### 🕐 Backups Automatiques
- **Fréquence** : Toutes les heures
- **Déclenchement** : Seulement si les données ont changé depuis le dernier backup
- **Collection** : `users/{userId}/backups/backup_appdata_{timestamp}`
- **Rétention** : 10 backups maximum (les plus anciens sont supprimés automatiquement)

### 🧠 Détection Intelligente des Changements
Le système utilise un hash pour détecter si les données ont changé :
- Si le hash est identique → pas de backup (économie d'espace)
- Si le hash diffère → création d'un nouveau backup
- Hash basé sur : settings, favorites, history, cloudinary, equalizer, etc.

### 📦 Données Sauvegardées
Chaque backup contient :
- Settings (paramètres utilisateur)
- Favorites (favoris)
- History (historique de lecture - 50 dernières entrées)
- Theme & Volume
- Cloudinary Config
- Equalizer Presets
- Uploaded Media
- Scrobbler Settings
- YouTube API Key
- Notifications
- Search History

### 🔄 Restauration
La restauration utilise la **même logique de merge intelligente** que la synchronisation initiale :

```typescript
// Règles de merge intelligent
1. Firebase a X, Local est vide → Restaurer X
2. Même valeur → Pas de changement
3. Valeurs différentes → Garder Local (sauf restauration explicite)
```

## Architecture Technique

### Initialisation
```typescript
// Au login, démarrage automatique du système
private startAutomaticBackup(userId: string): void {
  // Premier backup après 5 secondes
  // Puis toutes les heures
  setInterval(() => createBackupIfNeeded(), 1 hour)
}
```

### Création de Backup
```typescript
private async createBackupIfNeeded(userId: string): Promise<void> {
  // 1. Récupérer données actuelles
  const currentData = await getCurrentLocalData();
  
  // 2. Calculer hash
  const currentHash = calculateDataHash(currentData);
  
  // 3. Comparer avec dernier backup
  if (currentHash === lastBackupDataHash) {
    console.log('⏩ Backup skipped: No changes');
    return;
  }
  
  // 4. Créer backup avec timestamp
  const backupId = `backup_appdata_${Date.now()}`;
  await setDoc(backupRef, {
    ...currentData,
    backupCreatedAt: new Date().toISOString(),
    backupTimestamp: Date.now()
  });
  
  // 5. Nettoyer vieux backups (garder 10)
  await cleanupOldBackups(userId);
}
```

### Structure Firestore
```
users/
  {userId}/
    appData           ← Données actuelles
    playlists/        ← Playlists
    backups/          ← Backups automatiques
      backup_appdata_1234567890/
        settings: {...}
        favorites: [...]
        history: [...]
        backupCreatedAt: "2024-01-15T10:30:00Z"
        backupTimestamp: 1234567890
```

## Comparaison Intelligente

### Logique de `intelligentCompare()`
```typescript
function intelligentCompare(local, firebase, type):
  // Cas 1: Local vide, Firebase a des données
  if (localIsEmpty && !firebaseIsEmpty):
    return 'use-firebase'  // Restaurer
  
  // Cas 2: Local a des données, Firebase vide
  if (!localIsEmpty && firebaseIsEmpty):
    return 'keep-local'    // Garder local
  
  // Cas 3: Les deux vides
  if (localIsEmpty && firebaseIsEmpty):
    return 'no-change'     // Rien à faire
  
  // Cas 4: Les deux ont des valeurs
  if (type === 'array'):
    return 'merge'         // Union pour favoris/history
  
  if (type === 'object'):
    return local === firebase ? 'no-change' : 'keep-local'
  
  // Primitives
  return local === firebase ? 'no-change' : 'keep-local'
```

### Exemple de Merge
```typescript
// Scénario: Restauration après login
mergeFirebaseWithLocal(firebaseBackup):
  
  // Settings
  if (local.settings === null && firebase.settings):
    ✅ Restaurer settings depuis Firebase
  
  // Favorites (merge = union)
  if (local.favorites && firebase.favorites):
    merged = [...new Set([...local, ...firebase])]
    ✅ Merger les deux listes (pas de doublons)
  
  // Theme & Volume
  ✅ TOUJOURS garder local (préférences actuelles)
  
  // History
  if (local.history === null && firebase.history):
    ✅ Restaurer history depuis Firebase
```

## Interface Utilisateur

### Composant `BackupManager`
```tsx
<BackupManager />
```

**Fonctionnalités UI** :
- 📋 Liste des backups disponibles (par ordre chronologique)
- 🕐 Affichage de la date et heure de création
- ⏱️ Temps relatif ("Il y a 2 heures")
- 🔄 Bouton "Actualiser" pour recharger la liste
- ⬇️ Bouton "Restaurer" pour chaque backup
- ⚠️ Confirmation avant restauration

### Intégration dans Settings
```tsx
// Dans src/components/views/SettingsView.tsx
import { BackupManager } from '@/components/BackupManager';

<TabsContent value="backup">
  <BackupManager />
</TabsContent>
```

## API Publique

### Méthodes Disponibles
```typescript
// Lister les backups
const backups = await firebaseSync.listBackups(userId);
// Returns: Array<{ id, timestamp, date }>

// Restaurer depuis un backup
const success = await firebaseSync.restoreFromBackup(userId, backupId);
// Returns: boolean

// Forcer un backup maintenant
await firebaseSync.createBackupIfNeeded(userId);
```

## Logs Console

### Création de Backup
```
🕐 Starting automatic backup system (every 1 hour if data changed)
💾 Backup created: backup_appdata_1705315800000
🗑️ Cleaned up 2 old backup(s)
```

### Backup Skipped
```
ℹ️ Backup skipped: No changes detected
```

### Restauration
```
🔄 Intelligent merge: Comparing Firebase backup with local data...
📥 Settings: Local empty → Restoring from Firebase
📥 Favorites: Merging 5 local + 3 Firebase = 8 total
✓ History: Keeping local
✓ Theme & Volume: Keeping local (user preferences)
✅ Intelligent merge complete: 2 changes applied from Firebase backup.
```

## Sécurité

### Protection des Données
- ✅ Confirmation requise avant restauration
- ✅ Backup créé avant toute opération risquée
- ✅ Rétention de 10 versions (historique)
- ✅ Hash pour éviter les backups inutiles

### Règles Firestore
```javascript
// Backups: lecture/écriture uniquement par le propriétaire
match /users/{userId}/backups/{backupId} {
  allow read, write: if request.auth.uid == userId;
}
```

## Cas d'Usage

### 1. Perte de Données Locale
```
Problème: localStorage corrompu ou effacé
Solution: Restaurer depuis le dernier backup
Résultat: Toutes les données récupérées
```

### 2. Erreur Utilisateur
```
Problème: Suppression accidentelle de favoris
Solution: Restaurer depuis un backup antérieur
Résultat: Favoris récupérés
```

### 3. Test de Nouvelles Fonctionnalités
```
Problème: Tester sans risquer les données
Solution: Backup avant test, restaurer si problème
Résultat: Données protégées
```

### 4. Migration entre Appareils
```
Problème: Nouveau PC, données à transférer
Solution: Login → backup automatique restauré
Résultat: Configuration identique
```

## Performance

### Optimisations
- **Hash rapide** : Détection de changements en O(n)
- **Cleanup automatique** : Max 10 backups pour limiter l'espace
- **Données compressées** : JSON minifié dans Firestore
- **Backup conditionnel** : Seulement si changements détectés

### Limites Firestore
- **Taille max document** : 1 MB
- **Écritures gratuites** : 20K/jour (largement suffisant)
- **Stockage** : Illimité (facturation après 1 GB)

## Maintenance

### Nettoyage Manuel
```typescript
// Supprimer tous les backups
const backups = await listBackups(userId);
for (const backup of backups) {
  await deleteDoc(doc(db, 'users', userId, 'backups', backup.id));
}
```

### Exporter un Backup
```typescript
// Récupérer les données d'un backup
const backupRef = doc(db, 'users', userId, 'backups', backupId);
const backupSnap = await getDoc(backupRef);
const backupData = backupSnap.data();

// Exporter en JSON
const json = JSON.stringify(backupData, null, 2);
// Sauvegarder dans un fichier
```

## Dépannage

### Backup non créé
**Symptôme** : Aucun backup après 1 heure
**Causes possibles** :
1. Aucun changement détecté (normal)
2. Utilisateur non connecté
3. Erreur Firestore

**Solution** : Vérifier les logs console

### Restauration échoue
**Symptôme** : Erreur lors de la restauration
**Causes possibles** :
1. Backup corrompu
2. Permissions Firestore incorrectes
3. Backup supprimé

**Solution** : Essayer un backup plus ancien

### Trop de backups
**Symptôme** : Plus de 10 backups stockés
**Cause** : Cleanup automatique désactivé
**Solution** : Relancer l'app ou cleanup manuel

## Roadmap

### Fonctionnalités Futures
- [ ] Export/Import de backups en fichiers locaux
- [ ] Backup avant actions critiques (reset, etc.)
- [ ] Compression des backups anciens
- [ ] Diff visuel entre backups
- [ ] Restauration sélective (seulement favoris, etc.)
- [ ] Backup cloud alternatif (Google Drive, Dropbox)

---

**Dernière mise à jour** : Janvier 2024  
**Version** : 1.0.0  
**Auteur** : Nova Sound Team
