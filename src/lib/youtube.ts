/**
 * Utilitaires pour la détection et le parsing des URLs YouTube
 */

export type MediaSource = 'local' | 'youtube' | 'cloudinary' | 'nexus' | 'bunny' | 'planethoster' | 'soundcloud' | 'vimeo' | 'unknown';

export interface YouTubeVideoInfo {
  videoId: string;
  source: 'youtube';
  url: string;
}

/**
 * Détecte le type de source média à partir d'une URL ou d'un chemin
 */
export function detectMediaSource(filePath?: string): MediaSource {
  if (!filePath) return 'unknown';
  
  // YouTube
  if (isYouTubeUrl(filePath)) return 'youtube';
  
  // URLs cloud
  if (filePath.includes('cloudinary.com')) return 'cloudinary';
  if (filePath.includes('bunny.net') || filePath.includes('b-cdn.net')) return 'bunny';
  if (filePath.includes('nexus') || filePath.includes('planethoster')) return 'planethoster';
  if (filePath.includes('soundcloud.com')) return 'soundcloud';
  if (filePath.includes('vimeo.com')) return 'vimeo';
  
  // URLs web (http/https)
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return 'unknown';
  
  // Local files
  if (filePath.startsWith('local-audio://') || filePath.startsWith('local-video://')) return 'local';
  
  // Fichiers locaux (chemins)
  return 'local';
}

/**
 * Vérifie si une URL est une URL YouTube
 */
export function isYouTubeUrl(url: string): boolean {
  if (!url) return false;
  
  const patterns = [
    /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//,
    /^https?:\/\/m\.youtube\.com\//,
    /^youtube:\/\//,
  ];
  
  return patterns.some(pattern => pattern.test(url));
}

/**
 * Extrait l'ID vidéo YouTube d'une URL
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!isYouTubeUrl(url)) return null;
  
  // Patterns pour différents formats d'URL YouTube
  const patterns = [
    // youtube.com/watch?v=VIDEO_ID
    /[?&]v=([^&#]+)/,
    // youtube.com/embed/VIDEO_ID
    /\/embed\/([^?#]+)/,
    // youtube.com/v/VIDEO_ID
    /\/v\/([^?#]+)/,
    // youtu.be/VIDEO_ID
    /youtu\.be\/([^?#]+)/,
    // youtube.com/shorts/VIDEO_ID
    /\/shorts\/([^?#]+)/,
    // youtube://VIDEO_ID
    /youtube:\/\/([^?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Parse une URL YouTube et retourne les informations de la vidéo
 */
export function parseYouTubeUrl(url: string): YouTubeVideoInfo | null {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;
  
  return {
    videoId,
    source: 'youtube',
    url: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

/**
 * Génère une URL YouTube embed
 */
export function getYouTubeEmbedUrl(videoId: string, options?: {
  autoplay?: boolean;
  controls?: boolean;
  modestbranding?: boolean;
  rel?: boolean;
  loop?: boolean;
  start?: number;
  end?: number;
  mute?: boolean;
}): string {
  const params = new URLSearchParams();
  
  if (options?.autoplay) params.set('autoplay', '1');
  if (options?.controls === false) params.set('controls', '0');
  if (options?.modestbranding) params.set('modestbranding', '1');
  if (options?.rel === false) params.set('rel', '0');
  if (options?.loop) params.set('loop', '1');
  if (options?.start) params.set('start', options.start.toString());
  if (options?.end) params.set('end', options.end.toString());
  if (options?.mute) params.set('mute', '1');
  
  const queryString = params.toString();
  return `https://www.youtube.com/embed/${videoId}${queryString ? `?${queryString}` : ''}`;
}

/**
 * Normalise une URL YouTube en format standard
 */
export function normalizeYouTubeUrl(url: string): string {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return url;
  
  return `https://www.youtube.com/watch?v=${videoId}`;
}
