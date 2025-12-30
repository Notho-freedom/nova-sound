# Parcours Complet: "Ouvrir des Fichiers" (Open Files)

## 🎯 Vue d'ensemble du flux

```
Utilisateur clique sur "Ouvrir des fichiers…" 
        ↓
MenuBar dispatche custom event "nexus-open-files"
        ↓
DesktopApp écoute et lance handleOpenFilesEvent
        ↓
Affichage du sélecteur de fichiers audio
        ↓
Utilisateur sélectionne un ou plusieurs fichiers
        ↓
Fichiers traités par onchange handler
```

---

## 📍 Étape 1: Déclenchement dans le Menu (MenuBar.tsx)

### Location: [MenuBar.tsx](src/components/MenuBar.tsx#L84-L88)

```tsx
const handleOpenFiles = () => {
  window.dispatchEvent(new CustomEvent("nexus-open-files", { detail: { multiple: true } }));
  setOpenMenu(null);
};
```

### Ce qui se passe:
1. **Création du Custom Event**: `new CustomEvent("nexus-open-files")`
2. **Données optionnelles**: `{ detail: { multiple: true } }` - indique la sélection multiple
3. **Dispatch globale**: `window.dispatchEvent()` - le composant envoie le message au système global
4. **Fermeture du menu**: `setOpenMenu(null)` - referme le dropdown menu après le clic

### Où est appelé:
[MenuBar.tsx ligne 239](src/components/MenuBar.tsx#L239) - Dans le dropdown menu "Bibliothèque"

```tsx
<DropdownMenuItem className="gap-2 text-xs" onClick={handleOpenFiles}>
  <FileText className="w-3.5 h-3.5" />
  Ouvrir des fichiers…
</DropdownMenuItem>
```

---

## 📍 Étape 2: Event Listener Setup (DesktopApp.tsx)

### Location: [DesktopApp.tsx](src/components/DesktopApp.tsx#L1375-L1548)

#### 2.1 Enregistrement du listener (ligne 1446)

```tsx
window.addEventListener('nexus-open-files', handleOpenFilesEvent);
```

#### 2.2 Définition du handler (lignes 1428-1445)

```tsx
const handleOpenFilesEvent = async () => {
  try {
    // Browser fallback
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'audio/*';
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      // Handle file loading
      console.log('[DesktopApp] Files selected:', files.length);
    };
    input.click();
  } catch (err) {
    console.error('[DesktopApp] Error opening files:', err);
    toast.error('Erreur lors de l\'ouverture des fichiers');
  }
};
```

### Ce qui se passe dans le handler:

#### Création du sélecteur de fichiers
```tsx
const input = document.createElement('input');
```
- Crée un élément HTML invisible `<input type="file">`

#### Configuration
```tsx
input.type = 'file';              // Type: sélection de fichiers
input.multiple = true;             // Permet la sélection multiple
input.accept = 'audio/*';          // Filtre les fichiers audio seulement
```

#### Gestion du changement
```tsx
input.onchange = async (e) => {
  const files = Array.from((e.target as HTMLInputElement).files || []);
  console.log('[DesktopApp] Files selected:', files.length);
};
```
- Quand l'utilisateur sélectionne des fichiers, on les récupère
- Conversion en Array avec `Array.from()`
- Log du nombre de fichiers sélectionnés

#### Activation
```tsx
input.click();
```
- Simule un clic programmatique sur l'input
- Affiche le dialogue du système d'exploitation

#### Gestion des erreurs
```tsx
catch (err) {
  console.error('[DesktopApp] Error opening files:', err);
  toast.error('Erreur lors de l\'ouverture des fichiers');
}
```
- Affiche une notification d'erreur en cas de problème

---

## 🔄 Flux Complet Détaillé

### Séquence temporelle:

```
[T=0ms] Utilisateur clique sur "Ouvrir des fichiers…" dans le menu
          │
          ├─ MenuBar.handleOpenFiles() exécuté
          │
[T=1ms]   ├─ window.dispatchEvent('nexus-open-files', { detail: { multiple: true } })
          │   └─ Le custom event est broadcasté à tous les listeners
          │
[T=2ms]   ├─ DesktopApp's handleOpenFilesEvent() déclenché
          │
          ├─ Création d'un <input type="file">
          │
          ├─ Configuration:
          │   ├─ multiple = true
          │   └─ accept = "audio/*"
          │
          ├─ Simulation d'un clic: input.click()
          │
[T=3ms]   └─ Le système d'exploitation ouvre le dialogue de sélection

[T=3000ms+] Utilisateur sélectionne un ou plusieurs fichiers audio

          ├─ Le handler onchange est déclenché
          │
          ├─ Les fichiers sont convertis en Array
          │
          └─ console.log('[DesktopApp] Files selected:', files.length)
             └─ Affiche le nombre de fichiers sélectionnés
```

---

## 📊 Diagramme d'Architecture

```
┌─────────────────────┐
│   UTILISATEUR       │
│   (Interface)       │
└──────────┬──────────┘
           │
           │ Clic sur "Ouvrir des fichiers…"
           │
           ▼
┌─────────────────────────────────────┐
│   MENUBAR.TSX                       │
│  ┌──────────────────────────────┐   │
│  │ handleOpenFiles()            │   │
│  │  • Dispatch custom event     │   │
│  │  • Close menu                │   │
│  └──────────────────────────────┘   │
└──────────────┬──────────────────────┘
               │
               │ window.dispatchEvent(
               │   'nexus-open-files',
               │   { detail: { multiple: true } }
               │ )
               │
               ▼
        ┌──────────────┐
        │ GLOBAL SCOPE │
        │ (window)     │
        └──────────────┘
               │
               │ Event propagates
               │
               ▼
┌─────────────────────────────────────┐
│   DESKTOPAPP.TSX                    │
│  ┌──────────────────────────────┐   │
│  │ useEffect (listener setup)    │   │
│  │  • addEventListener(...)      │   │
│  └──────────────────────────────┘   │
│                                      │
│  ┌──────────────────────────────┐   │
│  │ handleOpenFilesEvent()       │   │
│  │  • Create <input>            │   │
│  │  • Set type=file             │   │
│  │  • Set accept=audio/*        │   │
│  │  • Set onchange handler      │   │
│  │  • Trigger click()           │   │
│  └──────────────────────────────┘   │
└──────────────┬──────────────────────┘
               │
               │ input.click()
               │
               ▼
┌─────────────────────┐
│  OS FILE DIALOG     │
│  (System Dialog)    │
└──────────┬──────────┘
           │
           │ User selects files
           │
           ▼
┌─────────────────────────────────────┐
│   INPUT ONCHANGE HANDLER            │
│  ┌──────────────────────────────┐   │
│  │ Process selected files       │   │
│  │  • Array.from(files)         │   │
│  │  • console.log count         │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## 🔐 Type Safety & Error Handling

### Type Assertion
```tsx
const files = Array.from((e.target as HTMLInputElement).files || []);
```
- `e.target as HTMLInputElement` - Assure que TypeScript connaît le type
- `files ||  []` - Fallback à un array vide si files est null

### Try/Catch Block
```tsx
try {
  // ... all handler logic
} catch (err) {
  console.error('[DesktopApp] Error opening files:', err);
  toast.error('Erreur lors de l\'ouverture des fichiers');
}
```
- Capture toute erreur lors du processus
- Affiche une notification toast à l'utilisateur

---

## ⚙️ Configuration Actuelle

| Aspect | Valeur | Raison |
|--------|--------|--------|
| **Type d'input** | `file` | Sélection de fichiers |
| **Multiple** | `true` | Permettre plusieurs fichiers |
| **Accept** | `audio/*` | Filtrer pour audio seulement |
| **Display** | Hidden (créé dynamiquement) | Pas d'élément visible dans le DOM |
| **Trigger** | `.click()` programmatique | Ouvre le dialogue système |

---

## 🚀 Ce qui est implémenté

✅ **Ouvrir le sélecteur de fichiers**
- Crée un input type=file
- Accepte les fichiers audio
- Permet la sélection multiple
- Déclenche le dialogue système

✅ **Écouter la sélection**
- onchange handler déclenché
- Fichiers convertis en Array
- Log du nombre de fichiers

❌ **À implémenter**
- Traitement réel des fichiers sélectionnés
- Validation des fichiers audio
- Ajout à la bibliothèque/playlist
- Feedback utilisateur sur la progression

---

## 🔗 Intégration avec le système

### Comment les fichiers seraient traités (pseudo-code pour le futur)

```tsx
input.onchange = async (e) => {
  const files = Array.from((e.target as HTMLInputElement).files || []);
  
  // Validation
  const audioFiles = files.filter(f => f.type.startsWith('audio/'));
  
  // Conversion en tracks
  const newTracks = await Promise.all(
    audioFiles.map(f => convertFileToTrack(f))
  );
  
  // Ajout à la bibliothèque
  addTracksToLibrary(newTracks);
  
  // Feedback
  toast.success(`${newTracks.length} fichiers ajoutés`);
};
```

---

## 📝 Points Clés à Retenir

1. **Custom Event Pattern**: MenuBar dispatche, DesktopApp écoute
2. **Global Scope**: L'événement passe par `window` (accessible partout)
3. **Native DOM API**: Utilise `<input type="file">` natif du navigateur
4. **Non-Bloquant**: Async/await pour les opérations potentiellement longues
5. **Gestion d'erreurs**: Try/catch + user feedback via toast

---

**Last Updated**: December 30, 2025
