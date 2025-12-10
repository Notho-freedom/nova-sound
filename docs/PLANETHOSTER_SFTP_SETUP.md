# Configuration PlanetHoster SFTP - Guide Sécurisé

## ⚠️ IMPORTANT : Sécurité

**NE JAMAIS utiliser FTP en production !**

- ❌ **FTP** : Mots de passe en clair, aucune protection, vulnérable aux attaques
- ✅ **SFTP** : 100% chiffré, authentification sécurisée, standard pour la production

NEXUS utilise **SFTP (SSH File Transfer Protocol)** qui est **100% sécurisé** et chiffré.

---

## 🔐 Pourquoi SFTP et pas FTP ?

| Protocole | Sécurité | Chiffrement | Recommandé |
|-----------|----------|-------------|------------|
| **FTP** | ❌ Dangereux | ❌ Aucun | ❌ Jamais en prod |
| **FTPS** | ✅ Bon | ✅ TLS | ✅ Acceptable |
| **SFTP** | ✅ Excellent | ✅ SSH (100%) | ✅ **Recommandé** |

**SFTP** utilise le protocole SSH qui chiffre :
- ✅ Les mots de passe
- ✅ Toutes les données transférées
- ✅ Les commandes
- ✅ Impossible à intercepter

---

## 📋 Configuration

### 1. Obtenir les identifiants SFTP

1. Connectez-vous à votre **panneau de contrôle PlanetHoster**
2. Allez dans **FTP / SFTP**
3. Notez :
   - **Hôte SFTP** : `ftp.votredomaine.com`
   - **Port** : `22` (par défaut)
   - **Nom d'utilisateur** : votre identifiant FTP
   - **Mot de passe** : votre mot de passe FTP

### 2. Méthode d'authentification

#### Option A : Mot de passe (simple mais moins sécurisé)

```env
PLANETHOSTER_SFTP_HOST=ftp.votredomaine.com
PLANETHOSTER_SFTP_PORT=22
PLANETHOSTER_SFTP_USER=votre-username
PLANETHOSTER_SFTP_PASSWORD=votre-password
PLANETHOSTER_SFTP_BASE_PATH=/public_html
PLANETHOSTER_CDN_URL=https://votredomaine.com
```

#### Option B : Clé SSH (recommandé - plus sécurisé) 🔥

**Étape 1 : Générer une clé SSH**

```bash
# Générer une clé RSA 4096 bits
ssh-keygen -t rsa -b 4096 -C "nexus-audio@planethoster"

# Suivez les instructions
# Entrez un nom de fichier (ex: planethoster_key)
# Entrez un passphrase (optionnel mais recommandé)
```

**Étape 2 : Ajouter la clé publique à PlanetHoster**

1. Copiez le contenu de `planethoster_key.pub`
2. Dans le panneau PlanetHoster, allez dans **SSH Keys**
3. Ajoutez votre clé publique

**Étape 3 : Configurer dans .env**

```env
PLANETHOSTER_SFTP_HOST=ftp.votredomaine.com
PLANETHOSTER_SFTP_PORT=22
PLANETHOSTER_SFTP_USER=votre-username
# Ne pas mettre PLANETHOSTER_SFTP_PASSWORD si vous utilisez une clé
PLANETHOSTER_SFTP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----\n"
PLANETHOSTER_SFTP_PASSPHRASE=votre-passphrase-si-encryptee
PLANETHOSTER_SFTP_BASE_PATH=/public_html
PLANETHOSTER_CDN_URL=https://votredomaine.com
```

**Important** : Pour la clé privée dans `.env`, gardez les `\n` - ils seront convertis automatiquement.

---

## 🧪 Test de connexion

### Test manuel avec sftp

```bash
# Test avec mot de passe
sftp -P 22 votre-username@ftp.votredomaine.com

# Test avec clé SSH
sftp -i ~/.ssh/planethoster_key -P 22 votre-username@ftp.votredomaine.com
```

### Test depuis l'application

1. Configurez les variables dans `.env.local`
2. Lancez l'application : `npm run dev`
3. Tentez un upload via l'interface
4. Vérifiez les logs pour les erreurs de connexion

---

## 🔧 Dépannage

### Erreur : "Connection refused"

**Cause** : Le port SFTP est incorrect ou le serveur n'accepte pas les connexions SFTP

**Solution** :
- Vérifiez que le port est `22` (SFTP standard)
- Contactez PlanetHoster pour confirmer que SFTP est activé
- Vérifiez votre firewall

### Erreur : "Authentication failed"

**Cause** : Identifiants incorrects ou clé SSH non autorisée

**Solution** :
- Vérifiez le nom d'utilisateur et le mot de passe
- Si vous utilisez une clé SSH, vérifiez que la clé publique est bien ajoutée dans PlanetHoster
- Vérifiez le format de la clé privée dans `.env` (doit inclure `-----BEGIN` et `-----END`)

### Erreur : "Permission denied"

**Cause** : Le répertoire de destination n'existe pas ou permissions insuffisantes

**Solution** :
- Vérifiez que `PLANETHOSTER_SFTP_BASE_PATH` existe
- Créez le répertoire manuellement si nécessaire
- Vérifiez les permissions du répertoire (doit être en écriture)

### Erreur : "Host key verification failed"

**Cause** : La clé d'hôte du serveur a changé

**Solution** :
- C'est normal lors de la première connexion
- Le code gère automatiquement la vérification de la clé d'hôte

---

## 📊 Comparaison avec les autres providers

| Provider | Protocole | Sécurité | Vitesse | Coût |
|----------|-----------|----------|---------|------|
| **Bunny CDN** | HTTPS API | ✅ Excellent | ⚡ Très rapide | 💰 Payant |
| **PlanetHoster SFTP** | SFTP | ✅ Excellent | ⚡ Rapide | 💰 Hébergement |
| **Cloudinary** | HTTPS API | ✅ Excellent | ⚡ Très rapide | 💰 Payant |
| **FTP** | FTP | ❌ **Dangereux** | ⚡ Rapide | 💰 Hébergement |

---

## 🎯 Utilisation dans l'application

### Priorité des providers (pour les utilisateurs Pro)

1. **Bunny CDN** (si configuré) → Rapide, CDN global
2. **PlanetHoster SFTP** (si configuré) → Hébergement dédié
3. **Stockage local** (fallback) → Serveur Next.js

### Configuration automatique

L'application détecte automatiquement les providers configurés et les utilise dans l'ordre de priorité.

---

## 🔒 Bonnes pratiques de sécurité

1. ✅ **Utilisez toujours SFTP**, jamais FTP
2. ✅ **Préférez les clés SSH** aux mots de passe
3. ✅ **Protégez votre clé privée** avec un passphrase
4. ✅ **Ne commitez jamais** `.env.local` dans Git
5. ✅ **Limitez les permissions** du compte SFTP (lecture/écriture uniquement)
6. ✅ **Utilisez un compte SFTP dédié** pour l'application (pas le compte principal)
7. ✅ **Activez les logs** pour surveiller les connexions

---

## 📝 Exemple de configuration complète

```env
# PlanetHoster SFTP (avec clé SSH - recommandé)
PLANETHOSTER_SFTP_HOST=ftp.mondomaine.com
PLANETHOSTER_SFTP_PORT=22
PLANETHOSTER_SFTP_USER=nexus-upload
PLANETHOSTER_SFTP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----\n"
PLANETHOSTER_SFTP_PASSPHRASE=mon-passphrase-securise
PLANETHOSTER_SFTP_BASE_PATH=/public_html/uploads
PLANETHOSTER_CDN_URL=https://mondomaine.com/uploads
```

---

## ✅ Validation

Exécutez le script de validation :

```bash
npm run validate:env
```

Cela vérifiera que toutes les variables PlanetHoster sont correctement configurées.

---

## 🎉 Résultat

Une fois configuré, les utilisateurs Pro pourront uploader leurs fichiers vers PlanetHoster via **SFTP sécurisé**, et les fichiers seront accessibles via l'URL publique configurée.

