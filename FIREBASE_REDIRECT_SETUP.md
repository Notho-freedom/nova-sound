# Configuration des URLs de redirection Firebase

Pour que la redirection Google fonctionne correctement, vous devez configurer les domaines autorisés dans Firebase.

## Configuration dans Firebase Console

1. Allez sur [Firebase Console](https://console.firebase.google.com)
2. Sélectionnez votre projet `nexus-player-d366f`
3. Allez dans **Authentication** > **Settings** > **Authorized domains**
4. Ajoutez les domaines suivants :
   - `localhost` (déjà présent normalement)
   - Votre domaine de production (ex: `nexus-audio.com`)
   - Pour Electron : `electron` (si nécessaire)

## URLs de redirection

Firebase utilise automatiquement l'URL actuelle de votre application comme URL de retour après authentification.

- **Développement local** : `http://localhost:8080`
- **Production** : `https://votre-domaine.com`

## Vérification

Après configuration, la redirection devrait :
1. Rediriger vers Google pour l'authentification
2. Rediriger automatiquement vers votre application après authentification
3. Afficher les informations utilisateur (nom, photo) dans l'UI

## Problèmes courants

### La redirection reste sur l'URL Firebase
- Vérifiez que votre domaine est dans la liste des domaines autorisés
- Vérifiez que l'URL de redirection correspond à l'URL de votre application

### Les données utilisateur ne s'affichent pas
- Vérifiez que Firestore est bien configuré
- Vérifiez les règles de sécurité Firestore
- Vérifiez la console du navigateur pour les erreurs

