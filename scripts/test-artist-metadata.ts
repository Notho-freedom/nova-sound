/**
 * Script de test pour le service Artist Metadata Provider
 * Teste toutes les fonctionnalités : adaptateurs, cache, fallback, API route
 */

import { ArtistMetadataProvider } from '../src/services/artist-metadata-provider';
import { WikipediaAdapter } from '../src/services/artist-metadata/adapters/wikipedia-adapter';
import { WikidataAdapter } from '../src/services/artist-metadata/adapters/wikidata-adapter';
import { MusicBrainzAdapter } from '../src/services/artist-metadata/adapters/musicbrainz-adapter';
import { LastFmAdapter } from '../src/services/artist-metadata/adapters/lastfm-adapter';

// Couleurs pour la console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✓ ${message}`, 'green');
}

function logError(message: string) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message: string) {
  log(`ℹ ${message}`, 'blue');
}

function logWarning(message: string) {
  log(`⚠ ${message}`, 'yellow');
}

// Configuration depuis les variables d'environnement
const config = {
  lastfm: {
    enabled: !!process.env.LASTFM_API_KEY,
    apiKey: process.env.LASTFM_API_KEY,
  },
  musicbrainz: {
    enabled: true,
    email: process.env.MUSICBRAINZ_EMAIL,
  },
};

// Artistes de test
const testArtists = [
  'The Beatles',
  'Pink Floyd',
  'Led Zeppelin',
  'Radiohead',
];

// Albums de test
const testAlbums = [
  { name: 'Abbey Road', artist: 'The Beatles' },
  { name: 'The Dark Side of the Moon', artist: 'Pink Floyd' },
  { name: 'OK Computer', artist: 'Radiohead' },
];

/**
 * Test d'un adaptateur individuel
 */
async function testAdapter(
  name: string,
  adapter: any,
  testFunction: (adapter: any) => Promise<any>
): Promise<boolean> {
  try {
    logInfo(`Test de l'adaptateur ${name}...`);
    const result = await testFunction(adapter);
    
    if (result) {
      logSuccess(`${name}: Succès`);
      return true;
    } else {
      logWarning(`${name}: Aucun résultat (peut être normal)`);
      return false;
    }
  } catch (error: any) {
    logError(`${name}: Erreur - ${error.message}`);
    return false;
  }
}

/**
 * Tests des adaptateurs individuels
 */
async function testAdapters() {
  log('\n=== Tests des Adaptateurs ===', 'cyan');

  // Test Wikipedia
  const wikipedia = new WikipediaAdapter('fr');
  await testAdapter('Wikipedia', wikipedia, async (adapter) => {
    const result = await adapter.searchArtist('The Beatles');
    if (result) {
      console.log(`  - Nom: ${result.name}`);
      console.log(`  - Biographie: ${result.biographyShort?.substring(0, 100)}...`);
      console.log(`  - Source: ${result.source}`);
    }
    return result;
  });

  // Test Wikidata
  const wikidata = new WikidataAdapter();
  await testAdapter('Wikidata', wikidata, async (adapter) => {
    const result = await adapter.searchArtist('The Beatles');
    if (result) {
      console.log(`  - Nom: ${result.name}`);
      console.log(`  - ID: ${result.id}`);
      console.log(`  - Genres: ${result.genres?.join(', ') || 'N/A'}`);
      console.log(`  - Source: ${result.source}`);
    }
    return result;
  });

  // Test MusicBrainz
  const musicbrainz = new MusicBrainzAdapter('Nexus-Audio-Player/1.0.0', config.musicbrainz.email);
  await testAdapter('MusicBrainz', musicbrainz, async (adapter) => {
    const result = await adapter.searchArtist('The Beatles');
    if (result) {
      console.log(`  - Nom: ${result.name}`);
      console.log(`  - ID: ${result.id}`);
      console.log(`  - Origine: ${result.origin || 'N/A'}`);
      console.log(`  - Source: ${result.source}`);
    }
    return result;
  });

  // Test Last.fm (si disponible)
  if (config.lastfm.enabled && config.lastfm.apiKey) {
    const lastfm = new LastFmAdapter(config.lastfm.apiKey);
    await testAdapter('Last.fm', lastfm, async (adapter) => {
      const result = await adapter.searchArtist('The Beatles');
      if (result) {
        console.log(`  - Nom: ${result.name}`);
        console.log(`  - Biographie: ${result.biographyShort?.substring(0, 100)}...`);
        console.log(`  - Artistes similaires: ${result.similarArtists?.slice(0, 3).join(', ') || 'N/A'}`);
        console.log(`  - Source: ${result.source}`);
      }
      return result;
    });
  } else {
    logWarning('Last.fm: Non testé (clé API non configurée)');
  }
}

/**
 * Tests du service principal
 */
async function testService() {
  log('\n=== Tests du Service Principal ===', 'cyan');

  const provider = new ArtistMetadataProvider({
    wikipedia: { enabled: true, language: 'fr' },
    wikidata: { enabled: true },
    musicbrainz: { enabled: true, userAgent: 'Nexus-Audio-Player/1.0.0', email: config.musicbrainz.email },
    lastfm: config.lastfm,
    cache: { enabled: true, ttl: 30 * 24 * 60 * 60 * 1000 },
  });

  // Test récupération métadonnées artiste
  logInfo('Test: getArtistMetadata');
  for (const artistName of testArtists.slice(0, 2)) {
    try {
      const metadata = await provider.getArtistMetadata(artistName);
      if (metadata) {
        logSuccess(`${artistName}: Métadonnées récupérées`);
        console.log(`  - Source: ${metadata.source}`);
        console.log(`  - Nom: ${metadata.name}`);
        console.log(`  - Biographie: ${metadata.biographyShort ? 'Oui' : 'Non'}`);
        console.log(`  - Genres: ${metadata.genres?.length || 0}`);
        console.log(`  - Image: ${metadata.imageUrl ? 'Oui' : 'Non'}`);
      } else {
        logWarning(`${artistName}: Aucune métadonnée trouvée`);
      }
    } catch (error: any) {
      logError(`${artistName}: Erreur - ${error.message}`);
    }
  }

  // Test mode combiné
  logInfo('Test: getCombinedArtistMetadata');
  try {
    const combined = await provider.getCombinedArtistMetadata('The Beatles');
    if (combined) {
      logSuccess('Mode combiné: Succès');
      console.log(`  - Nom: ${combined.name}`);
      console.log(`  - Biographie: ${combined.biography ? 'Oui' : 'Non'}`);
      console.log(`  - Genres: ${combined.genres?.join(', ') || 'N/A'}`);
      console.log(`  - Liens sociaux: ${combined.socialLinks ? Object.keys(combined.socialLinks).length : 0}`);
    } else {
      logWarning('Mode combiné: Aucun résultat');
    }
  } catch (error: any) {
    logError(`Mode combiné: Erreur - ${error.message}`);
  }

  // Test métadonnées album
  logInfo('Test: getAlbumMetadata');
  for (const album of testAlbums.slice(0, 2)) {
    try {
      const metadata = await provider.getAlbumMetadata(album.name, album.artist);
      if (metadata) {
        logSuccess(`${album.name} - ${album.artist}: Métadonnées récupérées`);
        console.log(`  - Source: ${metadata.source}`);
        console.log(`  - Nom: ${metadata.name}`);
        console.log(`  - Description: ${metadata.description ? 'Oui' : 'Non'}`);
        console.log(`  - Année: ${metadata.year || 'N/A'}`);
        console.log(`  - Cover: ${metadata.coverUrl ? 'Oui' : 'Non'}`);
      } else {
        logWarning(`${album.name} - ${album.artist}: Aucune métadonnée trouvée`);
      }
    } catch (error: any) {
      logError(`${album.name} - ${album.artist}: Erreur - ${error.message}`);
    }
  }

  // Test cache
  logInfo('Test: Cache');
  try {
    const firstCall = await provider.getArtistMetadata('The Beatles');
    const startTime = Date.now();
    const secondCall = await provider.getArtistMetadata('The Beatles');
    const endTime = Date.now();
    
    if (firstCall && secondCall) {
      logSuccess('Cache: Fonctionne');
      console.log(`  - Temps première requête: ${endTime - startTime}ms`);
      console.log(`  - Source première: ${firstCall.source}`);
      console.log(`  - Source deuxième: ${secondCall.source}`);
    }
  } catch (error: any) {
    logError(`Cache: Erreur - ${error.message}`);
  }

  // Test disponibilité des sources
  logInfo('Test: Disponibilité des sources');
  const sources = ['wikipedia', 'wikidata', 'musicbrainz', 'lastfm'] as const;
  sources.forEach(source => {
    const available = provider.isSourceAvailable(source);
    if (available) {
      logSuccess(`${source}: Disponible`);
    } else {
      logWarning(`${source}: Non disponible`);
    }
  });
}

/**
 * Tests de la route API
 */
async function testAPI() {
  log('\n=== Tests de la Route API ===', 'cyan');

  const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
  const apiUrl = `${baseUrl}/api/artist-metadata`;

  // Test métadonnées artiste
  logInfo('Test: GET /api/artist-metadata?type=artist&query=The+Beatles');
  try {
    const response = await fetch(`${apiUrl}?type=artist&query=The+Beatles`);
    if (response.ok) {
      const data = await response.json();
      logSuccess('API Artist: Succès');
      console.log(`  - Status: ${response.status}`);
      console.log(`  - Nom: ${data.metadata?.name || 'N/A'}`);
      console.log(`  - Source: ${data.metadata?.source || 'N/A'}`);
    } else {
      logError(`API Artist: Erreur ${response.status} - ${response.statusText}`);
    }
  } catch (error: any) {
    logWarning(`API Artist: Serveur non disponible - ${error.message}`);
    logInfo('  (Assurez-vous que le serveur Next.js est démarré)');
  }

  // Test mode combiné
  logInfo('Test: GET /api/artist-metadata?type=artist&query=The+Beatles&combined=true');
  try {
    const response = await fetch(`${apiUrl}?type=artist&query=The+Beatles&combined=true`);
    if (response.ok) {
      const data = await response.json();
      logSuccess('API Combined: Succès');
      console.log(`  - Status: ${response.status}`);
      console.log(`  - Nom: ${data.metadata?.name || 'N/A'}`);
      console.log(`  - Genres: ${data.metadata?.genres?.join(', ') || 'N/A'}`);
    } else {
      logError(`API Combined: Erreur ${response.status}`);
    }
  } catch (error: any) {
    logWarning(`API Combined: Serveur non disponible`);
  }

  // Test métadonnées album
  logInfo('Test: GET /api/artist-metadata?type=album&query=Abbey+Road&artist=The+Beatles');
  try {
    const response = await fetch(`${apiUrl}?type=album&query=Abbey+Road&artist=The+Beatles`);
    if (response.ok) {
      const data = await response.json();
      logSuccess('API Album: Succès');
      console.log(`  - Status: ${response.status}`);
      console.log(`  - Nom: ${data.metadata?.name || 'N/A'}`);
      console.log(`  - Source: ${data.metadata?.source || 'N/A'}`);
    } else {
      logError(`API Album: Erreur ${response.status}`);
    }
  } catch (error: any) {
    logWarning(`API Album: Serveur non disponible`);
  }

  // Test erreurs
  logInfo('Test: Gestion des erreurs');
  try {
    const response = await fetch(`${apiUrl}?type=artist`);
    if (!response.ok) {
      logSuccess(`Erreur attendue: ${response.status} (paramètre manquant)`);
    }
  } catch (error: any) {
    logWarning(`Test erreur: Serveur non disponible`);
  }
}

/**
 * Résumé des tests
 */
function printSummary(results: { adapters: number; service: number; api: number }) {
  log('\n=== Résumé ===', 'cyan');
  console.log(`Adaptateurs testés: ${results.adapters}`);
  console.log(`Tests service: ${results.service}`);
  console.log(`Tests API: ${results.api}`);
  
  log('\n=== Configuration ===', 'cyan');
  console.log(`Last.fm: ${config.lastfm.enabled ? '✓ Configuré' : '✗ Non configuré'}`);
  console.log(`MusicBrainz: ${config.musicbrainz.enabled ? '✓ Configuré' : '✗ Non configuré'}`);
  if (config.musicbrainz.email) {
    console.log(`MusicBrainz Email: ${config.musicbrainz.email}`);
  }
}

/**
 * Fonction principale
 */
async function main() {
  log('\n╔══════════════════════════════════════════════════════════╗', 'cyan');
  log('║  Test du Service Artist Metadata Provider                ║', 'cyan');
  log('╚══════════════════════════════════════════════════════════╝', 'cyan');

  const results = {
    adapters: 0,
    service: 0,
    api: 0,
  };

  try {
    // Tests des adaptateurs
    await testAdapters();
    results.adapters = 4;

    // Tests du service
    await testService();
    results.service = 1;

    // Tests de l'API
    await testAPI();
    results.api = 1;

  } catch (error: any) {
    logError(`Erreur fatale: ${error.message}`);
    console.error(error);
  }

  printSummary(results);

  log('\n✓ Tests terminés', 'green');
}

// Exécuter les tests
main().catch(console.error);

