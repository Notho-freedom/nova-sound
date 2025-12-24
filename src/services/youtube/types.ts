/**
 * Types dédiés pour le système YouTube unifié
 */

/**
 * Représente une vidéo YouTube avec toutes ses métadonnées
 */
export interface YouTubeVideo {
  id: string;                    // ID interne (yt_${videoId})
  videoId: string;               // ID YouTube (11 caractères)
  title: string;
  artist: string;                // Nom de l'artiste/auteur
  channelTitle: string;          // Nom de la chaîne
  channelId?: string;            // ID de la chaîne
  thumbnailUrl: string;          // URL thumbnail (HQ)
  thumbnailHighUrl?: string;     // URL thumbnail (MaxRes)
  duration: number;              // Durée en secondes
  description?: string;          // Description de la vidéo
  publishedAt?: string;          // Date de publication
  viewCount?: number;            // Nombre de vues
  likeCount?: number;            // Nombre de likes
  addedAt: string;               // Date d'ajout à la bibliothèque
  source: 'youtube';             // Toujours 'youtube'
  
  // Métadonnées additionnelles
  tags?: string[];
  categoryId?: string;
  isLive?: boolean;
  isUpcoming?: boolean;
  
  // Qualité disponible
  availableQualities?: string[];
  
  // Cache metadata
  cachedAt?: number;
  expiresAt?: number;
}

/**
 * Représente une playlist YouTube
 */
export interface YouTubePlaylist {
  id: string;                    // ID de la playlist
  title: string;                 // Titre de la playlist
  description?: string;          // Description
  thumbnailUrl: string;          // URL thumbnail
  channelTitle: string;          // Nom de la chaîne
  channelId?: string;            // ID de la chaîne
  itemCount: number;             // Nombre de vidéos
  publishedAt?: string;          // Date de publication
  videos?: YouTubeVideo[];       // Vidéos de la playlist (si chargées)
  cachedAt?: number;             // Timestamp de mise en cache
}

/**
 * Résultat d'une recherche YouTube
 */
export interface YouTubeSearchResult {
  videos: YouTubeVideo[];
  source: 'api' | 'cache' | 'fallback' | 'invidious';
  fromCache: boolean;
  totalResults?: number;
  nextPageToken?: string;
}

/**
 * Résultat d'une recherche de playlists
 */
export interface YouTubePlaylistSearchResult {
  playlists: YouTubePlaylist[];
  source: 'api' | 'cache' | 'invidious';
  fromCache: boolean;
}

/**
 * Options de recherche
 */
export interface YouTubeSearchOptions {
  maxResults?: number;
  forceRefresh?: boolean;
  useFallback?: boolean;
  pageToken?: string;
  type?: 'video' | 'channel' | 'playlist';
  order?: 'relevance' | 'date' | 'viewCount' | 'rating';
  videoDuration?: 'short' | 'medium' | 'long';
  videoDefinition?: 'high' | 'standard';
}

/**
 * État du quota
 */
export interface YouTubeQuotaStatus {
  remaining: number;
  used: number;
  limit: number;
  percentage: number;
  exhausted: boolean;
  circuitBreakerOpen: boolean;
  consecutiveFailures: number;
}

/**
 * Options de prefetch
 */
export interface YouTubePrefetchOptions {
  priority?: 'high' | 'normal' | 'low';
  includeRelated?: boolean;
}

/**
 * État du lecteur
 */
export type YouTubePlayerState = 
  | 'unstarted' 
  | 'ended' 
  | 'playing' 
  | 'paused' 
  | 'buffering' 
  | 'cued';

/**
 * Handlers d'événements du lecteur
 */
export interface YouTubePlayerEventHandlers {
  onReady?: () => void;
  onStateChange?: (state: YouTubePlayerState) => void;
  onError?: (error: number) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

/**
 * Convertit un YouTubeVideo en Track pour la compatibilité
 */
export function youtubeVideoToTrack(video: YouTubeVideo): import('@/types/music').Track {
  return {
    id: video.id,
    title: video.title,
    artist: video.artist,
    album: video.channelTitle || 'YouTube',
    duration: video.duration,
    coverUrl: video.thumbnailUrl,
    mediaSource: 'youtube',
    youtubeVideoId: video.videoId,
    addedAt: video.addedAt,
  };
}

/**
 * Convertit un YouTubeVideo en Video pour la compatibilité
 */
export function youtubeVideoToVideo(video: YouTubeVideo): import('@/types/music').Video {
  return {
    id: video.id,
    filePath: `youtube://${video.videoId}`, // Virtual path
    title: video.title,
    duration: video.duration,
    thumbnailUrl: video.thumbnailUrl,
    fileSize: 0, // Unknown for YouTube
    addedAt: video.addedAt,
    channelTitle: video.channelTitle,
    channelId: video.channelId,
    description: video.description,
    mediaSource: 'youtube',
    youtubeVideoId: video.videoId,
    playCount: 0,
  };
}

/**
 * Crée un YouTubeVideo à partir d'un ID et de données oEmbed
 */
export function createYouTubeVideo(
  videoId: string, 
  data: Partial<YouTubeVideo> = {}
): YouTubeVideo {
  return {
    id: `yt_${videoId}`,
    videoId,
    title: data.title || 'Vidéo YouTube',
    artist: data.artist || 'Artiste inconnu',
    channelTitle: data.channelTitle || 'YouTube',
    channelId: data.channelId,
    thumbnailUrl: data.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    thumbnailHighUrl: data.thumbnailHighUrl || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    duration: data.duration || 0,
    description: data.description,
    publishedAt: data.publishedAt,
    viewCount: data.viewCount,
    addedAt: data.addedAt || new Date().toISOString(),
    source: 'youtube',
  };
}
