/**
 * Route API Next.js pour récupérer des métadonnées d'artistes/albums
 * Utilise le service ArtistMetadataProvider côté serveur
 */

import { NextRequest, NextResponse } from 'next/server';
import { ArtistMetadataProvider } from '@/services/artist-metadata-provider';

// Initialiser le provider avec les variables d'environnement serveur
const provider = new ArtistMetadataProvider({
  wikipedia: {
    enabled: true,
    language: 'fr',
  },
  wikidata: {
    enabled: true,
  },
  musicbrainz: {
    enabled: true,
    userAgent: 'Nexus-Audio-Player/1.0.0',
    email: process.env.MUSICBRAINZ_EMAIL,
  },
  lastfm: {
    enabled: !!process.env.LASTFM_API_KEY,
    apiKey: process.env.LASTFM_API_KEY,
  },
  cache: {
    enabled: true,
    ttl: 30 * 24 * 60 * 60 * 1000, // 30 jours
  },
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as 'artist' | 'album' | 'track';
    const query = searchParams.get('query');
    const artistName = searchParams.get('artist'); // Pour les albums
    const combined = searchParams.get('combined') === 'true'; // Mode combiné pour artistes

    if (!type || !query) {
      return NextResponse.json(
        { error: 'Les paramètres "type" et "query" sont requis' },
        { status: 400 }
      );
    }

    if (type === 'artist') {
      if (combined) {
        // Mode combiné : récupère les métadonnées de toutes les sources
        const metadata = await provider.getCombinedArtistMetadata(query);
        
        if (!metadata) {
          return NextResponse.json(
            { error: 'Aucune métadonnée trouvée' },
            { status: 404 }
          );
        }

        return NextResponse.json({ metadata });
      } else {
        // Mode simple : une seule source avec fallback
        const metadata = await provider.getArtistMetadata(query);
        
        if (!metadata) {
          return NextResponse.json(
            { error: 'Aucune métadonnée trouvée' },
            { status: 404 }
          );
        }

        return NextResponse.json({ metadata });
      }
    } else if (type === 'album') {
      if (!artistName) {
        return NextResponse.json(
          { error: 'Le paramètre "artist" est requis pour les albums' },
          { status: 400 }
        );
      }

      const metadata = await provider.getAlbumMetadata(query, artistName);
      
      if (!metadata) {
        return NextResponse.json(
          { error: 'Aucune métadonnée trouvée' },
          { status: 404 }
        );
      }

      return NextResponse.json({ metadata });
    } else {
      return NextResponse.json(
        { error: 'Type non supporté. Utilisez "artist" ou "album"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[API] Artist metadata error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des métadonnées' },
      { status: 500 }
    );
  }
}

