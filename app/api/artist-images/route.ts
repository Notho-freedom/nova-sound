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
    const query = 'artiste '+searchParams.get('query');
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const random = searchParams.get('random') === 'true';
    const width = searchParams.get('width') ? parseInt(searchParams.get('width')!, 10) : undefined;
    const height = searchParams.get('height') ? parseInt(searchParams.get('height')!, 10) : undefined;
    const orientation = searchParams.get('orientation') as 'landscape' | 'portrait' | 'squarish' | undefined;

    if (!query) {
      return NextResponse.json(
        { error: 'Le paramètre "query" est requis' },
        { status: 400 }
      );
    }

    // Options de recherche avec dimensions et orientation
    const searchOptions: any = {
      query,
      limit: Math.min(limit, 50),
    };

    if (width) searchOptions.width = width;
    if (height) searchOptions.height = height;
    if (orientation) searchOptions.orientation = orientation;

    if (random) {
      // Récupérer une image aléatoire avec les options
      const result = await provider.search(searchOptions);
      if (result.images.length > 0) {
        // Sélectionner une image aléatoire parmi les résultats
        const randomIndex = Math.floor(Math.random() * result.images.length);
        return NextResponse.json({ image: result.images[randomIndex] });
      }
      
      return NextResponse.json(
        { error: 'Aucune image trouvée' },
        { status: 404 }
      );
    }

    // Recherche normale
    const result = await provider.search(searchOptions);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Artist images error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des images' },
      { status: 500 }
    );
  }
}

