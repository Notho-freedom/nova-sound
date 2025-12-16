# Configuration du Scrobbling - NEXUS Audio Player

## Vue d'ensemble

NEXUS Audio Player supporte le scrobbling vers Last.fm et Libre.fm. Le scrobbling permet de tracker automatiquement vos écoutes musicales.

## Prérequis

1. Un compte Last.fm (gratuit): https://www.last.fm/join
2. Une clé API Last.fm (gratuite): https://www.last.fm/api/account/create

## Obtenir une Clé API Last.fm

1. Connectez-vous à https://www.last.fm/api/account/create
2. Remplissez le formulaire:
   - **Application name**: NEXUS Audio Player
   - **Application description**: Personal audio player
   - **Application homepage**: (optionnel)
   - **Callback URL**: (laisser vide)
3. Cliquez sur "Submit"
4. Notez votre **API Key** et **Shared Secret**

## Configuration

### 1. Variables d'environnement

Ajoutez vos clés API dans `.env.local`:

```bash
LASTFM_API_KEY=votre-api-key
LASTFM_API_SECRET=votre-shared-secret
```

### 2. Redémarrage

Redémarrez l'application Electron pour charger les nouvelles variables.

### 3. Activation dans les Paramètres

1. Ouvrez NEXUS Audio Player
2. Allez dans **Paramètres** > **Intégrations**
3. Activez **Scrobbling**
4. Cliquez sur **Connecter Last.fm**
5. Autorisez l'accès dans la fenêtre qui s'ouvre
6. Attendez la confirmation de connexion

## Fonctionnement

### Quand une piste est scrobblée?

Selon les règles Last.fm, une piste est scrobblée quand:
- Elle a été écoutée pendant au moins **50%** de sa durée
- OU pendant au moins **4 minutes**
- La première condition atteinte déclenche le scrobble

### Now Playing

Le statut "Now Playing" est mis à jour:
- Au début de chaque piste
- Visible sur votre profil Last.fm pendant l'écoute

### Queue Offline

Si vous êtes hors ligne:
- Les scrobbles sont mis en queue localement
- Ils seront envoyés automatiquement à la reconnexion
- Vérification toutes les minutes

## Libre.fm

NEXUS supporte également Libre.fm (alternative open-source):
- Même configuration que Last.fm
- Les mêmes clés API fonctionnent
- Activable séparément dans les paramètres

## Dépannage

### "Last.fm API not configured"

- Vérifiez que `LASTFM_API_KEY` et `LASTFM_API_SECRET` sont définis
- Redémarrez l'application après modification de `.env.local`

### "Failed to authenticate"

- Vérifiez vos clés API
- Assurez-vous d'avoir autorisé l'accès dans le navigateur
- Réessayez après quelques secondes

### Scrobbles non envoyés

- Vérifiez que le scrobbling est activé dans les paramètres
- Vérifiez votre connexion internet
- Les scrobbles en queue seront envoyés automatiquement

### Vérifier les scrobbles

- Connectez-vous à https://www.last.fm
- Allez sur votre profil > Recent Tracks
- Les scrobbles apparaissent généralement en quelques secondes

## API Last.fm

### Endpoints utilisés

| Méthode | Description |
|---------|-------------|
| `auth.getToken` | Obtient un token d'authentification |
| `auth.getSession` | Obtient une session après autorisation |
| `track.updateNowPlaying` | Met à jour le statut "Now Playing" |
| `track.scrobble` | Scrobble une piste |

### Limites

- **Rate limit**: 5 requêtes par seconde
- **Scrobbles par requête**: 1 (batch non implémenté)

## Sécurité

- Les clés API ne sont **jamais** exposées côté client
- La session key est stockée localement (encrypted si Electron Keychain disponible)
- Les tokens expirent et sont renouvelés automatiquement

## Ressources

- [Documentation API Last.fm](https://www.last.fm/api)
- [Créer une application](https://www.last.fm/api/account/create)
- [Libre.fm](https://libre.fm/)
