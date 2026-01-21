/**
 * Récupère les métadonnées complètes d'une vidéo YouTube
 * Utilise le service YouTube unifié depuis src/services/youtube/
 */

export interface YouTubeVideoMetadata {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  duration: number; // en secondes
  viewCount: number;
  likeCount?: number;
  thumbnailUrl: string;
  thumbnailHighUrl: string;
  thumbnailMaxResUrl?: string;
  availableResolutions?: string[];
  tags?: string[];
  categoryId?: string;
}

export interface YouTubeVideoMetadataResponse {
  success: boolean;
  metadata?: YouTubeVideoMetadata;
  error?: string;
}

/**
 * Récupère les métadonnées d'une vidéo YouTube via le service unifié
 * Utilise automatiquement le cache et les fallbacks
 */
export async function fetchYouTubeVideoMetadata(
  videoId: string
): Promise<YouTubeVideoMetadataResponse> {
  try {
    const { YouTube } = await import('@/services/youtube');
    
    // Initialiser la clé API si disponible
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem("nexus-youtube-api-key");
      if (savedKey) {
        YouTube.setApiKey(savedKey);
      } else {
        const envKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
        if (envKey) YouTube.setApiKey(envKey);
      }
    }
    
    // Récupérer la vidéo via le service unifié (cache automatique)
    const video = await YouTube.getVideo(videoId);
    
    if (video) {
      return {
        success: true,
        metadata: {
          id: video.videoId,
          title: video.title,
          description: video.description || '',
          channelTitle: video.channelTitle,
          channelId: video.channelId || '',
          publishedAt: video.publishedAt || '',
          duration: video.duration || 0,
          viewCount: video.viewCount || 0,
          thumbnailUrl: video.thumbnailUrl,
          thumbnailHighUrl: video.thumbnailHighUrl || video.thumbnailUrl,
        },
      };
    } else {
      return {
        success: false,
        error: 'Impossible de récupérer les métadonnées',
      };
    }
  } catch (error) {
    console.error('[YouTubeMetadata] Erreur:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    };
  }
}

/**
 * Récupère les résolutions disponibles d'une vidéo YouTube
 */
export function getYouTubeStandardResolutions(): string[] {
  return [
    "144p",
    "240p",
    "360p",
    "480p",
    "720p",
    "1080p",
    "1440p",
    "2160p (4K)",
  ];
}

/**
 * Détermine la résolution actuelle du player YouTube
 */
export function getCurrentYouTubeResolution(player: any): string | null {
  return null;
}
