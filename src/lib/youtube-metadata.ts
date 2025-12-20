/**
 * Récupère les métadonnées complètes d'une vidéo YouTube via l'API YouTube Data v3
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
  // Résolutions disponibles (via l'API IFrame, pas directement via Data API)
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
 * Récupère la clé API YouTube depuis localStorage ou env
 */
function getYouTubeApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  
  // Priorité: localStorage > env
  const fromStorage = localStorage.getItem("nexus-youtube-api-key");
  if (fromStorage) return fromStorage;
  
  return process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || null;
}

/**
 * Récupère les métadonnées d'une vidéo YouTube via l'API YouTube Data v3
 * Utilise le cache multi-niveaux (L1 mémoire + L2 Firebase) pour économiser le quota
 */
export async function fetchYouTubeVideoMetadata(
  videoId: string
): Promise<YouTubeVideoMetadataResponse> {
  // 1. Vérifier le cache d'abord (L1 puis L2)
  try {
    const { youtubeCacheService } = await import('@/services/youtube-cache');
    const cached = await youtubeCacheService.getVideo(videoId);
    
    if (cached) {
      // Convertir en format de réponse
      return {
        success: true,
        metadata: {
          id: cached.videoId,
          title: cached.title,
          description: cached.description || '',
          channelTitle: cached.channelTitle,
          channelId: cached.channelId,
          publishedAt: cached.publishedAt,
          duration: cached.duration || 0,
          viewCount: cached.viewCount || 0,
          likeCount: cached.likeCount,
          thumbnailUrl: cached.thumbnailUrl,
          thumbnailHighUrl: cached.thumbnailHighUrl || cached.thumbnailUrl,
          tags: cached.tags,
          categoryId: cached.categoryId,
        },
      };
    }
  } catch (error) {
    console.warn('[YouTubeMetadata] Erreur cache, fallback API:', error);
  }

  // 2. Vérifier le quota avant d'appeler l'API
  try {
    const { youtubeQuotaManager } = await import('@/services/youtube-quota-manager');
    if (!youtubeQuotaManager.canGetMetadata(1)) {
      return {
        success: false,
        error: "Quota API YouTube épuisé. Réessayez demain.",
      };
    }
  } catch (error) {
    console.warn('[YouTubeMetadata] Erreur quota manager:', error);
  }

  const apiKey = getYouTubeApiKey();
  
  if (!apiKey) {
    return {
      success: false,
      error: "Clé API YouTube non configurée",
    };
  }

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("id", videoId);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("part", "snippet,contentDetails,statistics");
    url.searchParams.set("fields", "items(id,snippet(title,description,channelTitle,channelId,publishedAt,thumbnails,tags,categoryId),contentDetails(duration),statistics(viewCount,likeCount))");

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error?.message || `Erreur HTTP ${response.status}`,
      };
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return {
        success: false,
        error: "Vidéo introuvable",
      };
    }

    const item = data.items[0];
    const snippet = item.snippet || {};
    const contentDetails = item.contentDetails || {};
    const statistics = item.statistics || {};

    // Parser la durée ISO 8601 (ex: PT1H2M10S)
    const durationMatch = contentDetails.duration?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    let duration = 0;
    if (durationMatch) {
      const hours = parseInt(durationMatch[1] || "0", 10);
      const minutes = parseInt(durationMatch[2] || "0", 10);
      const seconds = parseInt(durationMatch[3] || "0", 10);
      duration = hours * 3600 + minutes * 60 + seconds;
    }

    // Récupérer les thumbnails
    const thumbnails = snippet.thumbnails || {};
    const thumbnailUrl = thumbnails.default?.url || thumbnails.medium?.url || "";
    const thumbnailHighUrl = thumbnails.high?.url || thumbnails.medium?.url || thumbnailUrl;
    const thumbnailMaxResUrl = thumbnails.maxres?.url || thumbnailHighUrl;

    const metadata: YouTubeVideoMetadata = {
      id: item.id,
      title: snippet.title || "",
      description: snippet.description || "",
      channelTitle: snippet.channelTitle || "",
      channelId: snippet.channelId || "",
      publishedAt: snippet.publishedAt || "",
      duration,
      viewCount: parseInt(statistics.viewCount || "0", 10),
      likeCount: statistics.likeCount ? parseInt(statistics.likeCount, 10) : undefined,
      thumbnailUrl,
      thumbnailHighUrl,
      thumbnailMaxResUrl,
      tags: snippet.tags || [],
      categoryId: snippet.categoryId,
    };

    // 3. Mettre en cache pour les prochaines fois
    try {
      const { youtubeCacheService } = await import('@/services/youtube-cache');
      const { youtubeQuotaManager } = await import('@/services/youtube-quota-manager');
      
      await youtubeCacheService.setVideo({
        id: metadata.id,
        videoId: metadata.id,
        title: metadata.title,
        description: metadata.description,
        channelTitle: metadata.channelTitle,
        channelId: metadata.channelId,
        publishedAt: metadata.publishedAt,
        duration: metadata.duration,
        viewCount: metadata.viewCount,
        likeCount: metadata.likeCount,
        thumbnailUrl: metadata.thumbnailUrl,
        thumbnailHighUrl: metadata.thumbnailHighUrl,
        tags: metadata.tags,
        categoryId: metadata.categoryId,
      });
      
      // Consommer le quota
      youtubeQuotaManager.consumeMetadata(1);
    } catch (error) {
      console.warn('[YouTubeMetadata] Erreur mise en cache:', error);
    }

    return {
      success: true,
      metadata,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des métadonnées YouTube:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
  }
}

/**
 * Récupère les résolutions disponibles d'une vidéo YouTube
 * Note: L'API YouTube Data v3 ne fournit pas directement les résolutions.
 * Les résolutions sont déterminées dynamiquement par le player IFrame selon
 * la qualité disponible pour la vidéo.
 * 
 * Cette fonction retourne les résolutions standard YouTube.
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
 * Note: L'API IFrame ne permet pas de récupérer directement la résolution actuelle.
 * Cette fonction est un placeholder pour une future implémentation.
 */
export function getCurrentYouTubeResolution(player: any): string | null {
  // L'API YouTube IFrame ne fournit pas directement la résolution
  // On peut essayer de l'inférer depuis la taille de l'iframe, mais ce n'est pas fiable
  return null;
}
