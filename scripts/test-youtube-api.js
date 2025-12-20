/**
 * Script de test rapide pour la clé API YouTube
 * Usage: node scripts/test-youtube-api.js [API_KEY]
 */

const API_KEY = process.argv[2] || 'AIzaSyBmSKgUHhbRaE3d1RzgDodNZE0NTZn-LxE';

async function testYouTubeApi() {
  console.log('🧪 Test de la clé API YouTube...\n');
  console.log(`Clé: ${API_KEY.substring(0, 10)}...${API_KEY.substring(API_KEY.length - 4)}\n`);

  try {
    // Test 1: Recherche simple
    console.log('📡 Test 1: Recherche de vidéos...');
    const searchResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?` +
      `part=snippet&` +
      `q=test&` +
      `type=video&` +
      `maxResults=5&` +
      `key=${API_KEY}`
    );

    if (!searchResponse.ok) {
      const errorData = await searchResponse.json();
      console.error('❌ Erreur:', errorData.error?.message || searchResponse.statusText);
      console.error('   Code:', searchResponse.status);
      if (searchResponse.status === 403) {
        console.error('\n💡 Vérifiez que:');
        console.error('   - L\'API YouTube Data v3 est activée dans Google Cloud Console');
        console.error('   - La clé API n\'a pas de restrictions qui bloquent l\'accès');
        console.error('   - Le quota n\'est pas dépassé');
      }
      process.exit(1);
    }

    const searchData = await searchResponse.json();
    console.log(`✅ Recherche réussie: ${searchData.items?.length || 0} résultats\n`);

    // Test 2: Détails d'une vidéo
    if (searchData.items && searchData.items.length > 0) {
      const videoId = searchData.items[0].id.videoId;
      console.log(`📹 Test 2: Détails de la vidéo ${videoId}...`);
      
      const detailsResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?` +
        `part=contentDetails,statistics&` +
        `id=${videoId}&` +
        `key=${API_KEY}`
      );

      if (detailsResponse.ok) {
        const detailsData = await detailsResponse.json();
        console.log(`✅ Détails récupérés: ${detailsData.items?.length || 0} vidéo(s)\n`);
      } else {
        console.warn('⚠️  Impossible de récupérer les détails');
      }
    }

    console.log('✅ Tous les tests sont passés !');
    console.log('\n💾 Pour utiliser cette clé dans Nexus:');
    console.log('   1. Ouvrez les Paramètres > Cloud');
    console.log('   2. Collez la clé dans "YouTube API"');
    console.log('   3. Cliquez sur "Tester" pour vérifier');
    console.log('   4. Cliquez sur "Sauvegarder"');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

testYouTubeApi();
