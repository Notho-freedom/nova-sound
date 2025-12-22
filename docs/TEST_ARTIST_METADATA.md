# Tests du Service Artist Metadata Provider

Ce document explique comment exécuter et utiliser les tests pour le service Artist Metadata Provider.

## 📋 Types de Tests

### 1. Script de Test Standalone

Script de test complet qui teste toutes les fonctionnalités du service.

**Fichier** : `scripts/test-artist-metadata.ts`

**Utilisation** :
```bash
npm run test:metadata
```

**Ce que teste le script** :
- ✅ Adaptateurs individuels (Wikipedia, Wikidata, MusicBrainz, Last.fm)
- ✅ Service principal avec fallback
- ✅ Mode combiné
- ✅ Cache
- ✅ Route API Next.js
- ✅ Gestion des erreurs

**Configuration requise** :
- Variables d'environnement dans `.env.local` :
  ```env
  LASTFM_API_KEY=your-key (optionnel)
  MUSICBRAINZ_EMAIL=your-email@example.com (optionnel)
  NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000 (pour tester l'API)
  ```

**Exemple de sortie** :
```
╔══════════════════════════════════════════════════════════╗
║  Test du Service Artist Metadata Provider                ║
╚══════════════════════════════════════════════════════════╝

=== Tests des Adaptateurs ===
ℹ Test de l'adaptateur Wikipedia...
✓ Wikipedia: Succès
  - Nom: The Beatles
  - Biographie: The Beatles were an English rock band...
  - Source: wikipedia

=== Tests du Service Principal ===
ℹ Test: getArtistMetadata
✓ The Beatles: Métadonnées récupérées
  - Source: wikipedia
  - Nom: The Beatles
  - Biographie: Oui
  - Genres: 3
  - Image: Oui

=== Tests de la Route API ===
ℹ Test: GET /api/artist-metadata?type=artist&query=The+Beatles
✓ API Artist: Succès
  - Status: 200
  - Nom: The Beatles
  - Source: wikipedia
```

### 2. Tests Unitaires Vitest

Tests unitaires pour le développement et l'intégration continue.

**Fichier** : `src/services/__tests__/artist-metadata-provider.test.ts`

**Utilisation** :
```bash
# Tous les tests
npm test

# Tests spécifiques
npm test artist-metadata-provider

# Avec couverture
npm test -- --coverage
```

**Ce que testent les tests unitaires** :
- ✅ Configuration du provider
- ✅ Disponibilité des sources
- ✅ Récupération de métadonnées d'artiste
- ✅ Mode combiné
- ✅ Récupération de métadonnées d'album
- ✅ Recherche générique
- ✅ Système de cache
- ✅ Adaptateurs individuels

## 🚀 Exécution des Tests

### Script Standalone

```bash
# Test complet
npm run test:metadata

# Avec variables d'environnement spécifiques
LASTFM_API_KEY=your-key npm run test:metadata
```

### Tests Unitaires

```bash
# Exécuter tous les tests
npm test

# Exécuter uniquement les tests du service metadata
npm test artist-metadata-provider

# Mode watch (re-exécute les tests à chaque changement)
npm test -- --watch

# Avec couverture de code
npm test -- --coverage

# Mode verbose (affiche plus de détails)
npm test -- --reporter=verbose
```

## 📊 Résultats Attendus

### Script Standalone

Le script affiche :
- ✅ **Succès** : Tests qui passent (vert)
- ⚠️ **Avertissement** : Tests qui fonctionnent mais sans résultat (jaune)
- ✗ **Erreur** : Tests qui échouent (rouge)
- ℹ **Info** : Informations de débogage (bleu)

### Tests Unitaires

Les tests Vitest affichent :
- ✅ Tests qui passent
- ❌ Tests qui échouent
- ⏱️ Temps d'exécution
- 📊 Couverture de code (si activée)

## 🔧 Configuration

### Variables d'Environnement

Pour des tests complets, configurez dans `.env.local` :

```env
# Last.fm (optionnel mais recommandé)
LASTFM_API_KEY=your-lastfm-api-key

# MusicBrainz (optionnel mais recommandé)
MUSICBRAINZ_EMAIL=your-email@example.com

# Pour tester l'API route
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
```

**Note** : Le service fonctionne sans clés API (utilise uniquement Wikipedia/Wikidata/MusicBrainz).

### Tester l'API Route

Pour tester la route API, vous devez démarrer le serveur Next.js :

```bash
# Terminal 1 : Démarrer le serveur
npm run dev

# Terminal 2 : Exécuter les tests
npm run test:metadata
```

## 🐛 Dépannage

### Erreur : "Serveur non disponible"

**Cause** : Le serveur Next.js n'est pas démarré.

**Solution** :
```bash
# Démarrer le serveur dans un terminal
npm run dev

# Puis exécuter les tests dans un autre terminal
npm run test:metadata
```

### Erreur : "Clé API invalide"

**Cause** : La clé API Last.fm est incorrecte ou expirée.

**Solution** :
1. Vérifiez votre clé dans `.env.local`
2. Obtenez une nouvelle clé : https://www.last.fm/api/account/create

### Tests qui timeout

**Cause** : Les APIs externes sont lentes ou indisponibles.

**Solution** :
- Les tests ont des timeouts de 10-20 secondes
- Si un test timeout, c'est probablement que l'API est lente
- Vérifiez votre connexion internet

### Cache qui interfère

**Cause** : Le cache localStorage peut contenir de vieilles données.

**Solution** :
```bash
# Le script nettoie automatiquement le cache
# Mais vous pouvez aussi le faire manuellement dans la console du navigateur :
localStorage.clear();
```

## 📝 Exemples de Tests

### Test d'un adaptateur spécifique

```typescript
import { WikipediaAdapter } from '@/services/artist-metadata/adapters/wikipedia-adapter';

const adapter = new WikipediaAdapter('fr');
const result = await adapter.searchArtist('The Beatles');
console.log(result);
```

### Test du service complet

```typescript
import { getArtistMetadataProvider } from '@/services/artist-metadata-provider';

const provider = getArtistMetadataProvider();
const metadata = await provider.getArtistMetadata('The Beatles');
console.log(metadata);
```

### Test de l'API route

```typescript
const response = await fetch('/api/artist-metadata?type=artist&query=The+Beatles');
const data = await response.json();
console.log(data);
```

## ✅ Checklist de Tests

Avant de déployer, vérifiez :

- [ ] Script standalone : `npm run test:metadata` passe
- [ ] Tests unitaires : `npm test` passe
- [ ] Cache fonctionne correctement
- [ ] Fallback automatique fonctionne
- [ ] Mode combiné fonctionne
- [ ] Route API répond correctement
- [ ] Gestion des erreurs fonctionne
- [ ] Pas de fuites mémoire dans le cache

## 📚 Ressources

- [Documentation du service](./ARTIST_METADATA_PROVIDER.md)
- [Vitest Documentation](https://vitest.dev/)
- [TypeScript Testing](https://www.typescriptlang.org/docs/handbook/testing.html)

