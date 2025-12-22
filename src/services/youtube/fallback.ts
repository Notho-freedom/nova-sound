/**
 * Stratégies de fallback pour YouTube
 * Utilisées quand le quota API est épuisé ou en cas d'erreur
 */

import { YouTubeVideo, createYouTubeVideo } from './types';

interface OEmbedResponse {
  title: string;
  author_name: string;
  author_url: string;
  thumbnail_url: string;
  thumbnail_width: number;
  thumbnail_height: number;
  html: string;
  provider_name: string;
}

// ==================== OEMBED FALLBACK ====================

/**
 * Récupère les infos d'une vidéo via oEmbed (sans quota API)
 */
export async function getVideoViaOEmbed(videoId: string): Promise<YouTubeVideo | null> {
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(url);

    if (!response.ok) {
      console.warn('[YouTubeFallback] oEmbed failed:', response.status);
      return null;
    }

    const data: OEmbedResponse = await response.json();
    
    return createVideoFromOEmbed(videoId, data);
  } catch (error) {
    console.error('[YouTubeFallback] oEmbed error:', error);
    return null;
  }
}

/**
 * Récupère les infos de plusieurs vidéos via oEmbed
 */
export async function getVideosViaOEmbed(videoIds: string[]): Promise<YouTubeVideo[]> {
  const results = await Promise.allSettled(
    videoIds.map(id => getVideoViaOEmbed(id))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<YouTubeVideo | null> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter((v): v is YouTubeVideo => v !== null);
}

function createVideoFromOEmbed(videoId: string, data: OEmbedResponse): YouTubeVideo {
  // Extraire l'ID de chaîne de l'URL auteur si possible
  const channelIdMatch = data.author_url?.match(/channel\/([^/?]+)/);
  const channelId = channelIdMatch?.[1] || undefined;

  // Améliorer la qualité de la thumbnail
  const thumbnailUrl = data.thumbnail_url?.replace('hqdefault', 'maxresdefault') || 
                       `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  return createYouTubeVideo(videoId, {
    title: data.title || 'Vidéo YouTube',
    artist: data.author_name || 'Artiste inconnu',
    channelTitle: data.author_name || 'YouTube',
    channelId,
    thumbnailUrl,
    thumbnailHighUrl: thumbnailUrl,
  });
}

// ==================== MINIMAL FALLBACK ====================

/**
 * Crée une vidéo minimale avec juste l'ID (dernier recours)
 */
export function createMinimalVideo(videoId: string, title?: string): YouTubeVideo {
  return createYouTubeVideo(videoId, {
    title: title || `Vidéo ${videoId}`,
  });
}

// ==================== THUMBNAIL FALLBACK ====================

const THUMBNAIL_QUALITIES = [
  'maxresdefault',
  'sddefault', 
  'hqdefault',
  'mqdefault',
  'default',
] as const;

/**
 * Obtient la meilleure thumbnail disponible avec fallback
 */
export async function getBestThumbnail(videoId: string): Promise<string> {
  for (const quality of THUMBNAIL_QUALITIES) {
    const url = `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        return url;
      }
    } catch {
      continue;
    }
  }
  
  // Fallback ultime
  return `https://img.youtube.com/vi/${videoId}/default.jpg`;
}

/**
 * Vérifie si une thumbnail existe (sans télécharger)
 */
export async function thumbnailExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

// ==================== SEARCH FALLBACK ====================

/**
 * Recherche basique via Invidious (sans API)
 */
export async function searchViaInvidious(query: string): Promise<YouTubeVideo[]> {
  const instances = [
    'https://vid.puffyan.us',
    'https://invidious.snopyta.org',
    'https://invidious.kavin.rocks',
  ];

  for (const instance of instances) {
    try {
      const url = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
      const response = await fetch(url, { 
        signal: AbortSignal.timeout(5000) 
      });

      if (!response.ok) continue;

      const data = await response.json();
      
      return data.slice(0, 10).map((item: any) => createYouTubeVideo(item.videoId, {
        title: item.title || 'Vidéo',
        artist: item.author || 'Artiste inconnu',
        channelTitle: item.author || 'YouTube',
        channelId: item.authorId,
        thumbnailUrl: item.videoThumbnails?.[0]?.url || `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`,
        thumbnailHighUrl: `https://img.youtube.com/vi/${item.videoId}/maxresdefault.jpg`,
        duration: item.lengthSeconds || 0,
      }));
    } catch {
      continue;
    }
  }

  console.warn('[YouTubeFallback] Toutes les instances Invidious ont échoué');
  return [];
}

// ==================== AUTOCOMPLETE FALLBACK ====================

const POPULAR_SUGGESTIONS = [
  'music video',
  'official audio', 
  'lyrics',
  'live performance',
  'acoustic version',
  'remix',
  'cover',
  'concert',
  'behind the scenes',
  'interview',
];

/**
 * Suggestions populaires pré-définies quand l'API est indisponible
 */
export function getPopularSuggestions(query: string): string[] {
  if (!query.trim()) {
    return POPULAR_SUGGESTIONS.slice(0, 5);
  }

  const q = query.toLowerCase();
  return POPULAR_SUGGESTIONS
    .filter(s => s.includes(q) || q.includes(s.split(' ')[0]))
    .slice(0, 5);
}

/**
 * Génère des suggestions basées sur le query
 */
export function generateSmartSuggestions(query: string): string[] {
  if (!query.trim()) return [];

  const suggestions: string[] = [];
  const q = query.trim();

  // Suggestions basées sur le pattern
  suggestions.push(`${q} official video`);
  suggestions.push(`${q} audio`);
  suggestions.push(`${q} live`);
  suggestions.push(`${q} lyrics`);
  suggestions.push(`${q} remix`);

  return suggestions.slice(0, 5);
}
