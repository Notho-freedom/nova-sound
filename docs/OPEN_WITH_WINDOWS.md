# "Ouvrir avec..." Windows - Guide d'implémentation

## ✅ Implémentation complète

NEXUS Audio Player supporte maintenant l'ouverture de fichiers via "Ouvrir avec..." de Windows pour **tous les formats audio et vidéo**.

## 🎯 Formats supportés

### Formats Audio (50+ formats)
- **MP3, WAV, FLAC, AAC, OGG, M4A, OPUS, WMA, AIFF**
- **MP2, MP1, AC3, DTS, APE, TTA, TAK**
- **OFR, OFS, OFF, RKA, SHN, AA, AAX**
- **ACT, ALAC, AU, AWB, DCT, DSS, DVF**
- **GSM, IKLAX, IVS, M4B, MMF, MSV, NMF, NSF**
- **OGA, MOGG, RA, RM, RAW, RF64, SLN**
- **VOC, VOX, WV, WEBM** (audio)

### Formats Vidéo (30+ formats)
- **MP4, AVI, MKV, WEBM, MOV, WMV, FLV, M4V**
- **3GP, 3G2, ASF, RM, RMVB, VOB, OGV**
- **DIVX, XVID, M2V, MTS, M2TS, TS, F4V**
- **AMV, DRC, GIFV, MXF, ROQ, NSV**
- **YUV, VIV, SVI, MNG, QT**

## 🔧 Configuration automatique

### Via electron-builder

Les associations de fichiers sont automatiquement configurées lors du build grâce à la configuration dans `package.json` :

```json
"fileAssociations": [
  {
    "ext": ["mp3", "wav", "flac", ...],
    "name": "Audio File",
    "role": "Viewer"
  },
  {
    "ext": ["mp4", "avi", "mkv", ...],
    "name": "Video File",
    "role": "Viewer"
  }
]
```

Lors de l'installation, Windows enregistre automatiquement NEXUS comme application par défaut pour ces formats.

## 🚀 Fonctionnement

### 1. Lancement depuis "Ouvrir avec..."

Quand l'utilisateur fait :
- Clic droit sur un fichier audio/vidéo
- "Ouvrir avec" → "NEXUS Audio"

Windows exécute :
```bash
Nexus.exe "C:\Users\Username\Music\track.mp3"
```

### 2. Gestion des instances multiples

L'application utilise `app.requestSingleInstanceLock()` pour :
- ✅ Détecter si une instance est déjà en cours
- ✅ Si oui : envoyer le fichier à l'instance existante et la mettre au premier plan
- ✅ Si non : créer une nouvelle instance et ouvrir le fichier

### 3. Parsing des arguments

Le code dans `electron/main.ts` :
- ✅ Parse `process.argv` pour trouver les fichiers
- ✅ Filtre les fichiers valides (extensions supportées)
- ✅ Envoie les fichiers au renderer via IPC (`file:open`)

### 4. Traitement côté renderer

Le code dans `src/components/DesktopApp.tsx` :
- ✅ Écoute l'événement `file:open`
- ✅ Détecte si c'est audio ou vidéo
- ✅ Pour audio : récupère les métadonnées, crée un Track, ajoute à la queue et joue
- ✅ Pour vidéo : ajoute à la bibliothèque vidéo et ouvre la vue vidéos

## 📝 Code clé

### electron/main.ts

```typescript
// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

// Handle second instance (file opened while app is running)
app.on('second-instance', (event, commandLine, workingDirectory) => {
  // Extract files and send to renderer
  const files = extractFilesFromCommandLine(commandLine);
  files.forEach(file => openMediaFile(file));
});

// Extract files from process.argv on first launch
function getFileArgsFromArgs(): string[] {
  // Parse argv and return valid media files
}
```

### src/components/DesktopApp.tsx

```typescript
// Listen for files opened via "Open with..."
useEffect(() => {
  const unsubscribe = window.electronAPI?.onFileOpen(async (filePath: string) => {
    // Detect audio/video
    // Get metadata
    // Add to library/queue
    // Play immediately
  });
  return unsubscribe;
}, []);
```

## 🧪 Test manuel

### Test via PowerShell

```powershell
# Test avec un fichier audio
.\dist-electron\main.js "C:\Users\Username\Music\track.mp3"

# Test avec un fichier vidéo
.\dist-electron\main.js "C:\Users\Username\Videos\video.mp4"
```

### Test via "Ouvrir avec..."

1. Clic droit sur un fichier `.mp3` ou `.mp4`
2. "Ouvrir avec" → "Choisir une autre application"
3. Sélectionner NEXUS Audio
4. Cocher "Toujours utiliser cette application"
5. Le fichier devrait s'ouvrir dans NEXUS

## 🔍 Dépannage

### L'application n'apparaît pas dans "Ouvrir avec..."

**Solution** : Réinstaller l'application ou exécuter manuellement :
```powershell
# Associer manuellement (exemple pour .mp3)
reg add "HKCU\Software\Classes\.mp3\OpenWithProgids" /v "NexusAudio" /t REG_SZ /d "" /f
```

### Les fichiers ne s'ouvrent pas

**Vérifier** :
1. ✅ Les extensions sont bien dans `fileAssociations` dans `package.json`
2. ✅ L'application est compilée avec `npm run build:electron`
3. ✅ Le handler `onFileOpen` est bien enregistré dans `preload.cjs`

### L'application s'ouvre mais ne joue pas le fichier

**Vérifier** :
1. ✅ Les logs de la console pour voir si `file:open` est reçu
2. ✅ Que les métadonnées sont bien récupérées
3. ✅ Que le track est bien ajouté à la queue

## 📦 Build et déploiement

Pour que les associations fonctionnent en production :

```bash
# Build complet
npm run build:electron

# Package pour Windows
npm run package:win
```

L'installer NSIS créera automatiquement les associations de fichiers dans le registre Windows.

## 🎉 Résultat

✅ **Tous les formats audio/vidéo** sont supportés  
✅ **"Ouvrir avec..."** fonctionne automatiquement  
✅ **Instance unique** : les fichiers s'ouvrent dans la même fenêtre  
✅ **Lecture immédiate** : les fichiers sont joués automatiquement  
✅ **Métadonnées** : récupération automatique des tags ID3/MP4  
✅ **Vidéos** : ajout automatique à la bibliothèque vidéo  

