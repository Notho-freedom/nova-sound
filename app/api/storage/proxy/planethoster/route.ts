import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '~/app/api/auth/middleware';
import { readFileFromPlanetHoster } from '~/lib/planethoster-sftp';

/**
 * Proxy sécurisé pour les fichiers PlanetHoster
 * 
 * Cette route vérifie l'authentification et la propriété du fichier avant de le servir.
 * Les fichiers ne sont accessibles qu'aux utilisateurs authentifiés qui en sont propriétaires.
 * 
 * @param request - Requête avec query param `path` (chemin relatif du fichier)
 */
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Non authentifié. Veuillez vous connecter.' },
        { status: 401 }
      );
    }

    // Récupérer le chemin du fichier depuis les query params
    const searchParams = request.nextUrl.searchParams;
    const filePath = searchParams.get('path');

    if (!filePath) {
      return NextResponse.json(
        { error: 'Paramètre "path" manquant' },
        { status: 400 }
      );
    }

    // Vérifier que le fichier appartient à l'utilisateur
    // Format attendu: nexus/{userId}/{filename}
    const pathParts = filePath.split('/');
    if (pathParts.length < 3 || pathParts[0] !== 'nexus' || pathParts[1] !== auth.userId) {
      return NextResponse.json(
        { error: 'Accès refusé. Ce fichier ne vous appartient pas.' },
        { status: 403 }
      );
    }

    // Lire le fichier depuis PlanetHoster
    const fileBuffer = await readFileFromPlanetHoster(filePath);

    // Déterminer le Content-Type basé sur l'extension
    const extension = filePath.split('.').pop()?.toLowerCase();
    const contentTypeMap: Record<string, string> = {
      // Audio
      'mp3': 'audio/mpeg',
      'flac': 'audio/flac',
      'ogg': 'audio/ogg',
      'wav': 'audio/wav',
      'm4a': 'audio/mp4',
      'aac': 'audio/aac',
      'opus': 'audio/opus',
      'wma': 'audio/x-ms-wma',
      'aiff': 'audio/aiff',
      // Video
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'ogv': 'video/ogg', // OGV pour les vidéos Ogg (différent de OGG audio)
      'avi': 'video/x-msvideo',
      'mov': 'video/quicktime',
      'wmv': 'video/x-ms-wmv',
      'flv': 'video/x-flv',
      'mkv': 'video/x-matroska',
      // Images
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
    };

    const contentType = contentTypeMap[extension || ''] || 'application/octet-stream';

    // Retourner le fichier avec les headers appropriés
    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'private, max-age=3600', // Cache privé pour 1 heure
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: any) {
    console.error('[PlanetHoster Proxy] Error:', error);
    
    if (error.message?.includes('not found') || error.message?.includes('No such file')) {
      return NextResponse.json(
        { error: 'Fichier introuvable' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Erreur lors de la récupération du fichier' },
      { status: 500 }
    );
  }
}

