/**
 * Système de récupération automatique pour les tracks YouTube manquants
 * 
 * Quand un track YouTube est référencé (favoris, historique, playlists)
 * mais n'existe pas dans le cache local, on extrait son youtubeVideoId
 * et on fait une recherche en arrière-plan pour le recharger.
 */

import type { Track } from '@/types/music';
import { extractYouTubeVideoId } from './youtube';
import { cacheYouTubeTrack, getCachedYouTubeTrackByVideoId } from './youtube-track-cache';
import { YouTube, type YouTubeVideo } from '@/services/youtube';
import { youtubeSearch } from '@/services/youtube/search';

const DEBUG = process.env.NEXT_PUBLIC_DEBUG_YOUTUBE_RECOVERY === 'true';

// Track les IDs en cours de récupération pour éviter les doublons
const recoveryInProgress = new Set<string>();

// Queue pour les récupérations en attente (évite de surcharger l'API)
const recoveryQueue: string[] = [];
let isProcessingQueue = false;

/**
 * Tente de récupérer un track YouTube manquant à partir de son ID
 * @param trackId - L'ID du track (peut contenir le videoId ou être de forme "youtube-{videoId}")
 * @returns Le track récupéré ou null si impossible
 */
export async function recoverMissingYouTubeTrack(trackId: string): Promise<Track | null> {
  if (!trackId) return null;
  
  // Déjà en cours de récupération
  if (recoveryInProgress.has(trackId)) {
    if (DEBUG) {
      console.log(`[YouTubeRecovery] Récupération déjà en cours pour ${trackId}`);
    }
    return null;
  }
  
  // Extraire le videoId du trackId
  const videoId = extractVideoIdFromTrackId(trackId);
  
  if (!videoId) {
    if (DEBUG) {
      console.warn(`[YouTubeRecovery] Impossible d'extraire videoId de ${trackId}`);
    }
    return null;
  }
  
  // Vérifier si le track existe déjà dans le cache
  const cached = getCachedYouTubeTrackByVideoId(videoId);
  if (cached) {
    if (DEBUG) {
      console.log(`[YouTubeRecovery] Track ${trackId} déjà en cache`);
    }
    return cached;
  }
  
  try {
    recoveryInProgress.add(trackId);
    
    if (DEBUG) {
      console.log(`[YouTubeRecovery] 🔄 Récupération de ${trackId} (videoId: ${videoId})`);
    }
    
    // Initialiser la clé API si disponible
    initYouTubeApiKey();
    
    // Chercher la vidéo par son ID exact (plus efficace qu'une recherche)
    const video = await YouTube.getVideo(videoId);
    
    if (!video) {
      if (DEBUG) {
        console.warn(`[YouTubeRecovery] ❌ Vidéo ${videoId} introuvable`);
      }
      return null;
    }
    
    // Convertir en Track
    const recoveredTrack: Track = {
      id: `youtube-audio-${video.videoId}`,
      title: video.title,
      artist: video.channelTitle || 'Unknown Artist',
      album: video.channelTitle,
      duration: video.duration || 0,
      filePath: `https://www.youtube.com/watch?v=${video.videoId}`,
      coverUrl: video.thumbnailUrl,
      addedAt: new Date().toISOString(),
      mediaSource: 'youtube',
      youtubeVideoId: video.videoId,
    };
    
    // Sauvegarder dans le cache
    cacheYouTubeTrack(recoveredTrack);
    
    if (DEBUG) {
      console.log(`[YouTubeRecovery] ✅ Track ${trackId} récupéré et mis en cache`);
    }
    
    return recoveredTrack;
    
  } catch (error) {
    console.error(`[YouTubeRecovery] Erreur lors de la récupération de ${trackId}:`, error);
    return null;
  } finally {
    recoveryInProgress.delete(trackId);
  }
}

/**
 * Récupère plusieurs tracks YouTube manquants en batch
 * @param trackIds - Liste des IDs de tracks à récupérer
 * @returns Map des tracks récupérés (trackId -> Track)
 */
export async function recoverMissingYouTubeTracks(
  trackIds: string[]
): Promise<Map<string, Track>> {
  if (!trackIds || trackIds.length === 0) {
    return new Map();
  }
  
  // Filtrer les tracks YouTube uniquement
  const youtubeTrackIds = trackIds.filter(id => isYouTubeTrackId(id));
  
  if (youtubeTrackIds.length === 0) {
    return new Map();
  }
  
  if (DEBUG) {
    console.log(`[YouTubeRecovery] 📦 Batch récupération de ${youtubeTrackIds.length} tracks`);
  }
  
  // Extraire tous les videoIds (avec déduplication)
  const videoIdSet = new Set<string>();
  const trackIdToVideoId = new Map<string, string>();
  const recoveredTracks = new Map<string, Track>();
  
  youtubeTrackIds.forEach(trackId => {
    const videoId = extractVideoIdFromTrackId(trackId);
    if (videoId) {
      // Vérifier d'abord si le track est déjà en cache
      const cached = getCachedYouTubeTrackByVideoId(videoId);
      if (cached) {
        // Track déjà en cache, pas besoin de le récupérer
        recoveredTracks.set(trackId, cached);
      } else {
        // Ajouter à la liste des videoIds à récupérer
        videoIdSet.add(videoId);
        trackIdToVideoId.set(trackId, videoId);
      }
    }
  });
  
  const videoIds = Array.from(videoIdSet);
  
  if (videoIds.length === 0) {
    if (DEBUG && recoveredTracks.size > 0) {
      console.log(`[YouTubeRecovery] ✅ ${recoveredTracks.size}/${youtubeTrackIds.length} tracks déjà en cache`);
    }
    return recoveredTracks;
  }
  
  try {
    initYouTubeApiKey();
    
    // L'API YouTube limite à 50 vidéos par requête
    // Découper en batches de 50 maximum
    const MAX_BATCH_SIZE = 50;
    const batches: string[][] = [];
    
    for (let i = 0; i < videoIds.length; i += MAX_BATCH_SIZE) {
      batches.push(videoIds.slice(i, i + MAX_BATCH_SIZE));
    }
    
    // Traiter chaque batch
    for (const batch of batches) {
      const videos = await youtubeSearch.getVideoDetails(batch);
      
      videos.forEach(video => {
      const track: Track = {
        id: `youtube-audio-${video.videoId}`,
        title: video.title,
        artist: video.channelTitle || 'Unknown Artist',
        album: video.channelTitle,
        duration: video.duration || 0,
        filePath: `https://www.youtube.com/watch?v=${video.videoId}`,
        coverUrl: video.thumbnailUrl,
        addedAt: new Date().toISOString(),
        mediaSource: 'youtube',
        youtubeVideoId: video.videoId,
      };
      
      // Sauvegarder dans le cache
      cacheYouTubeTrack(track);
      
      // Trouver tous les trackIds originaux correspondant à ce videoId
      youtubeTrackIds.forEach(trackId => {
        if (trackIdToVideoId.get(trackId) === video.videoId) {
          recoveredTracks.set(trackId, track);
        }
      });
      });
    }
    
    if (DEBUG) {
      console.log(`[YouTubeRecovery] ✅ ${recoveredTracks.size}/${youtubeTrackIds.length} tracks récupérés`);
    }
    
    return recoveredTracks;
    
  } catch (error) {
    console.error('[YouTubeRecovery] Erreur batch récupération:', error);
    return new Map();
  }
}

/**
 * Ajoute des tracks à la queue de récupération (traitement différé)
 * Utile pour ne pas bloquer l'UI
 */
export function queueTrackRecovery(trackIds: string[]): void {
  const youtubeTrackIds = trackIds.filter(id => {
    if (!isYouTubeTrackId(id)) return false;
    if (recoveryInProgress.has(id)) return false;
    if (recoveryQueue.includes(id)) return false; // Éviter les doublons dans la queue
    
    // Vérifier si le track n'est pas déjà en cache
    const videoId = extractVideoIdFromTrackId(id);
    if (videoId) {
      const cached = getCachedYouTubeTrackByVideoId(videoId);
      if (cached) {
        // Track déjà en cache, pas besoin de le récupérer
        return false;
      }
    }
    
    return true;
  });
  
  if (youtubeTrackIds.length === 0) return;
  
  // Ajouter à la queue (sans doublons)
  recoveryQueue.push(...youtubeTrackIds);
  
  if (DEBUG) {
    console.log(`[YouTubeRecovery] 📋 ${youtubeTrackIds.length} tracks ajoutés à la queue`);
  }
  
  // Démarrer le traitement si pas déjà en cours
  if (!isProcessingQueue) {
    processRecoveryQueue();
  }
}

/**
 * Traite la queue de récupération (par batches)
 */
async function processRecoveryQueue(): Promise<void> {
  if (isProcessingQueue || recoveryQueue.length === 0) {
    return;
  }
  
  isProcessingQueue = true;
  
  try {
    while (recoveryQueue.length > 0) {
      // Traiter par batch de 10
      const batch = recoveryQueue.splice(0, 10);
      
      if (DEBUG) {
        console.log(`[YouTubeRecovery] ⏳ Traitement batch de ${batch.length} tracks...`);
      }
      
      await recoverMissingYouTubeTracks(batch);
      
      // Petite pause entre les batches pour ne pas surcharger
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } finally {
    isProcessingQueue = false;
  }
}

/**
 * Extrait le videoId d'un trackId
 * Supporte plusieurs formats:
 * - "youtube-audio-{videoId}"
 * - "youtube-{videoId}"
 * - "yt-track-{videoId}"
 * - "{videoId}" (direct)
 * - URL YouTube complète
 */
function extractVideoIdFromTrackId(trackId: string): string | null {
  if (!trackId) return null;
  
  // Si c'est une URL YouTube, extraire le videoId
  if (trackId.includes('youtube.com') || trackId.includes('youtu.be')) {
    return extractYouTubeVideoId(trackId);
  }
  
  // Préfixes connus
  const prefixes = [
    'youtube-audio-',
    'youtube-',
    'yt-track-',
    'yt-',
  ];
  
  for (const prefix of prefixes) {
    if (trackId.startsWith(prefix)) {
      const extracted = trackId.substring(prefix.length);
      // Vérifier que c'est bien un videoId (11 caractères alphanumériques)
      if (extracted.length === 11) {
        return extracted;
      }
    }
  }
  
  // Si le trackId fait 11 caractères, peut-être que c'est directement le videoId
  if (trackId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(trackId)) {
    return trackId;
  }
  
  return null;
}

/**
 * Vérifie si un trackId correspond à un track YouTube
 */
function isYouTubeTrackId(trackId: string): boolean {
  if (!trackId) return false;
  
  return (
    trackId.startsWith('youtube-') ||
    trackId.startsWith('yt-') ||
    trackId.includes('youtube.com') ||
    trackId.includes('youtu.be') ||
    (trackId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(trackId))
  );
}

/**
 * Initialise la clé API YouTube
 */
function initYouTubeApiKey(): void {
  if (typeof window === 'undefined') return;
  
  const savedKey = localStorage.getItem('nexus-youtube-api-key');
  if (savedKey) {
    YouTube.setApiKey(savedKey);
    return;
  }
  
  const envKey = process.env.YOUTUBE_API_KEY;
  if (envKey) {
    YouTube.setApiKey(envKey);
  }
}

/**
 * Nettoie la queue de récupération (utile pour les tests)
 */
export function clearRecoveryQueue(): void {
  recoveryQueue.length = 0;
  recoveryInProgress.clear();
  isProcessingQueue = false;
}
