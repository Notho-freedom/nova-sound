# Configuration Bunny CDN/Storage

## Activation du plan Pro sur Bunny

Pour activer le plan Pro sur votre compte Bunny (bobymomo6@gmail.com) :

1. Connectez-vous à https://bunny.net
2. Allez dans **Billing** > **Plans**
3. Sélectionnez le plan **Pro** et activez-le
4. Une fois activé, vous pourrez utiliser Bunny Storage avec votre clé API

## Configuration de la clé API

Votre clé API Bunny a été fournie. Pour l'utiliser :

1. Créez un fichier `.env.local` à la racine du projet (ou modifiez `.env` si existant)
2. Ajoutez les variables suivantes :

```env
# Bunny CDN/Storage Configuration
BUNNY_STORAGE_NAME=votre-storage-zone-name
BUNNY_API_KEY=cc39f108-c221-4042-8c1c-f4bd6367db7b05a43238-9734-41ff-9730-ef6877013d57
BUNNY_CDN_URL=https://votre-cdn-url.b-cdn.net
```

### Obtenir le nom de votre Storage Zone

1. Allez sur https://bunny.net
2. Naviguez vers **Storage** > **Storage Zones**
3. Créez une nouvelle Storage Zone ou utilisez une existante
4. Le nom de la zone est visible dans l'URL ou dans les paramètres

### Obtenir l'URL CDN

1. Allez sur https://bunny.net
2. Naviguez vers **CDN** > **Pull Zones**
3. Créez une Pull Zone liée à votre Storage Zone
4. L'URL CDN sera du format : `https://votre-zone.b-cdn.net`

## Fonctionnalités Pro

Une fois configuré, les utilisateurs Pro bénéficient automatiquement de :

- ✅ Upload jusqu'à **500MB par fichier** (vs 100MB pour les utilisateurs gratuits)
- ✅ **CDN mondial** pour une lecture ultra-rapide
- ✅ **Stockage illimité** sur Bunny Storage
- ✅ **Streaming optimisé** pour audio et vidéo
- ✅ Upload automatique vers Bunny (pas besoin de configuration manuelle)

## Comment ça fonctionne

1. Les utilisateurs **gratuits** utilisent le stockage local (limite 100MB)
2. Les utilisateurs **Pro** utilisent automatiquement Bunny Storage (limite 500MB)
3. Si Bunny n'est pas configuré, les utilisateurs Pro utilisent le stockage local en fallback

## Test de l'upload

Une fois configuré, testez l'upload :

1. Connectez-vous avec un compte Pro
2. Allez dans **Paramètres** > **Cloud**
3. Vous devriez voir "Bunny Storage activé" si tout est configuré
4. Uploadez un fichier via l'interface - il sera automatiquement envoyé à Bunny

## Support

Pour toute question sur Bunny :
- Documentation : https://docs.bunny.net
- Support : https://bunny.net/support

