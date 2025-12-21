/**
 * Route API Next.js pour récupérer des images d'artistes
 * Utilise le service ArtistImageProvider côté serveur
 */

import { NextRequest, NextResponse } from 'next/server';
import { ArtistImageProvider } from '@/services/artist-image-provider';

// Initialiser le provider avec les variables d'environnement serveur
const provider = new ArtistImageProvider({
  unsplash: {
    enabled: !!process.env.UNSPLASH_ACCESS_KEY,
    accessKey: process.env.UNSPLASH_ACCESS_KEY,
  },
  pexels: {
    enabled: !!process.env.PEXELS_API_KEY,
    apiKey: process.env.PEXELS_API_KEY,
  },
  pixabay: {
    enabled: !!process.env.PIXABAY_API_KEY,
    apiKey: process.env.PIXABAY_API_KEY,
  },
  wikimedia: {
    enabled: true,
  },
  cache: {
    enabled: true,
    ttl: 7 * 24 * 60 * 60 * 1000, // 7 jours
  },
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const random = searchParams.get('random') === 'true';

    if (!query) {
      return NextResponse.json(
        { error: 'Le paramètre "query" est requis' },
        { status: 400 }
      );
    }

    if (random) {
      // Récupérer une image aléatoire
      const image = await provider.getRandomImage(query);
      
      if (!image) {
        return NextResponse.json(
          { error: 'Aucune image trouvée' },
          { status: 404 }
        );
      }

      return NextResponse.json({ image });
    }

    // Recherche normale
    const result = await provider.search({
      query,
      limit: Math.min(limit, 50),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Artist images error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des images' },
      { status: 500 }
    );
  }
}

