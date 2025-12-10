# Arguments CLI - NEXUS Audio Player

NEXUS Audio Player supporte des arguments en ligne de commande pour personnaliser son comportement au démarrage.

## Utilisation

```bash
nexus-audio [options]
```

ou en mode développement :

```bash
npm run electron:dev -- [options]
```

## Options disponibles

### Mode développement

- `-d, --dev` : Lance l'application en mode développement (connecte à `http://localhost:3000`)

### Configuration du serveur

- `-p, --port <number>` : Définit le port du serveur Next.js (par défaut: 3000)
  ```bash
  nexus-audio --port 3001
  ```

### Scan de la bibliothèque

- `--no-scan, --no-auto-scan` : Désactive le scan automatique de la bibliothèque au démarrage
  ```bash
  nexus-audio --no-scan
  ```

- `--auto-scan` : Force le scan automatique de la bibliothèque au démarrage
  ```bash
  nexus-audio --auto-scan
  ```

### Dossiers de musique

- `-m, --music-dir <path>`, `--music-directory <path>` : Ajoute un dossier de musique à scanner (peut être utilisé plusieurs fois)
  ```bash
  nexus-audio --music-dir "C:\Music" --music-dir "D:\Audio"
  ```

### Mode debug

- `--debug` : Active le mode debug (logging verbeux et DevTools automatiques)
  ```bash
  nexus-audio --debug
  ```

### Réinitialisation

- `--reset` : Réinitialise tous les paramètres aux valeurs par défaut
  ```bash
  nexus-audio --reset
  ```

- `--clear-cache` : Vide le cache de l'application
  ```bash
  nexus-audio --clear-cache
  ```

### Informations

- `-h, --help` : Affiche le message d'aide
  ```bash
  nexus-audio --help
  ```

- `-v, --version` : Affiche la version de l'application
  ```bash
  nexus-audio --version
  ```

## Exemples d'utilisation

### Développement avec port personnalisé

```bash
nexus-audio --dev --port 3001 --debug
```

### Ajouter des dossiers de musique et forcer le scan

```bash
nexus-audio --music-dir "C:\Users\Username\Music" --music-dir "D:\Audio" --auto-scan
```

### Réinitialisation complète

```bash
nexus-audio --reset --clear-cache
```

### Mode production sans scan automatique

```bash
nexus-audio --no-scan
```

## Notes

- Les arguments peuvent être combinés
- Les dossiers de musique ajoutés via CLI sont persistés dans les paramètres
- Le mode debug ouvre automatiquement les DevTools
- La réinitialisation restaure tous les paramètres aux valeurs par défaut

