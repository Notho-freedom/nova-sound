import { useState, useEffect, useCallback, useRef, useMemo, startTransition, memo } from "react";
import { flushSync } from "react-dom";

// Load debug performance utilities (for console monitoring)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  import('@/lib/debug-performance').catch(() => {}); // Non-blocking
}
import { TitleBar } from "./TitleBar";
import { Sidebar, ViewType } from "./Sidebar";
import { useViewNavigation } from "@/hooks/useViewNavigation";
import { NowPlayingBar } from "./NowPlayingBar";
import { QueuePanel } from "./QueuePanel";
import { VisionProPlayer } from "./VisionProPlayer";
import { LoadingScreen } from "./LoadingScreen";
import { LyricsDisplay } from "./LyricsDisplay";
import { NotificationsPanel } from "./NotificationsPanel";
import { ArtistInfoPanel } from "./ArtistInfoPanel";
import { PlayQueueChoiceDialog } from "./PlayQueueChoiceDialog";
// import { KaraokePanel } from "./KaraokePanel"; // DÉSACTIVÉ - Système karaoke désactivé
import { UpdateNotification } from "./UpdateNotification";
import { AssistantPanel } from "./AssistantPanel";
import { lazy, Suspense } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lazyWithRetry = <T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  key: string
): React.LazyExoticComponent<T> =>
  lazy(() =>
    factory().catch((error): Promise<{ default: T }> => {
      if (typeof window !== "undefined") {
        const storageKey = `lazy-retry:${key}`;
        if (!sessionStorage.getItem(storageKey)) {
          sessionStorage.setItem(storageKey, "1");
          window.location.reload();
          // Return a never-resolving promise to prevent further rendering while reloading
          return new Promise<{ default: T }>(() => {});
        }
      }
      throw error;
    })
  );

// Lazy load ALL heavy view components for better initial load
const HomeView = lazyWithRetry(() => import("./views/HomeView").then(m => ({ default: m.HomeView })), "HomeView");
const SearchView = lazyWithRetry(() => import("./views/SearchView").then(m => ({ default: m.SearchView })), "SearchView");
const LibraryView = lazyWithRetry(() => import("./views/LibraryView").then(m => ({ default: m.LibraryView })), "LibraryView");
const PlaylistView = lazyWithRetry(() => import("./views/PlaylistView").then(m => ({ default: m.PlaylistView })), "PlaylistView");
const SettingsView = lazyWithRetry(() => import("./views/SettingsView").then(m => ({ default: m.SettingsView })), "SettingsView");
const NotificationsView = lazyWithRetry(() => import("./views/NotificationsView").then(m => ({ default: m.NotificationsView })), "NotificationsView");
const ArtistView = lazyWithRetry(() => import("./views/ArtistView").then(m => ({ default: m.ArtistView })), "ArtistView");
const VideosView = lazyWithRetry(() => import("./views/VideosView").then(m => ({ default: m.VideosView })), "VideosView");
const CloudView = lazyWithRetry(() => import("./views/CloudView").then(m => ({ default: m.CloudView })), "CloudView");
const AudioSensesView = lazyWithRetry(() => import("./views/AudioSensesView").then(m => ({ default: m.AudioSensesView })), "AudioSensesView");

import { BackgroundEffects } from "./BackgroundEffects";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { FileTableSkeleton, SettingsViewSkeleton, NotificationListSkeleton } from "@/components/ui/skeletons";
import { Clock, Music, Play, Search, X } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useLibrary } from "@/hooks/useLibrary";
import { useFavorites } from "@/hooks/useFavorites";
import { usePlayHistory } from "@/hooks/usePlayHistory";
import { usePlaylists } from "@/hooks/usePlaylists";
import { spawnTask } from "@/app/actions/spawn-task";
import { useTaskStatus } from "@/hooks/useTaskStatus";
import { useQueue } from "@/hooks/useQueue";
import { useFileProcessing } from "@/hooks/useFileProcessing";
import { useCloudSync } from "@/hooks/useCloudSync";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";
import { useNotifications } from "@/hooks/useNotifications";
import { useI18n } from "@/i18n";
import { useTheme } from "@/hooks/useTheme";
import { getAudioSrc } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Track } from "@/types/music";
import { YouTubePlayer, type YouTubePlayerRef } from "@/components/YouTubePlayer";
import { getCachedYouTubeTrackByVideoId } from "@/lib/youtube-track-cache";
import { mapHistoryEntriesToTracks } from "@/lib/history-utils";
import { getTrackFromAllOrCache } from "@/lib/track-resolver";
import { Input } from "@/components/ui/input";
import { CoachmarkProvider } from "@/features/coachmarks";
import "@/features/coachmarks/styles/shepherd-theme.css";
//import { VibrantUI, BassPulse } from "@/components/VibrantUI";
//import { useAudioVibes } from "@/hooks/useAudioVibes";
//import { useAudioAI } from "@/hooks/useAudioAI";
//import { extractYouTubeVideoId } from "@/lib/youtube";

const DEBUG_SIDEBAR_COUNTS = process.env.NEXT_PUBLIC_DEBUG_SIDEBAR === 'true';

export const DesktopApp = () => {
  // Initialize theme hook to ensure theme is loaded and applied on mount
  useTheme();
  const { t } = useI18n();
  const { tracks: libraryTracks, loading: libraryLoading, scanning, scanProgress } = useLibrary();
  
  // État pour stocker les tracks YouTube chargés dynamiquement
  const [youtubeTracksCache, setYoutubeTracksCache] = useState<Map<string, Track[]>>(new Map());
  
  // Initialize Redis cache migration on app startup (NON-BLOCKING)
  useEffect(() => {
    // Defer cache migration to background - don't block initial render
    const timeoutId = setTimeout(async () => {
      try {
        const { ensureMigrated } = await import('@/lib/cache-migration');
        const result = await ensureMigrated();
        console.log('[DesktopApp] Cache migration result:', result);
      } catch (err) {
        console.warn('[DesktopApp] Cache migration failed:', err);
      }
    }, 3000); // Defer 3s after initial render to avoid blocking boot
    
    return () => clearTimeout(timeoutId);
  }, []);
  
  // Charger les tracks YouTube en cache au démarrage (ASYNC - pas de blocage)
  useEffect(() => {
    // Load YouTube cache asynchronously to restore playlists
    // This runs in parallel with HomeView rendering
    const loadYouTubeCache = async () => {
      try {
        const { getYouTubeTracksCache } = await import('@/lib/youtube-track-cache');
        const cachedTracks = getYouTubeTracksCache();
        if (cachedTracks && cachedTracks.size > 0) {
          const cachedArray = Array.from(cachedTracks.values());
          setYoutubeTracksCache(prev => {
            const newMap = new Map(prev);
            newMap.set('persistent-cache', cachedArray);
            return newMap;
          });
          console.log(`[DesktopApp] Loaded ${cachedArray.length} cached YouTube tracks`);
        }
      } catch (err) {
        // Ignore errors loading cache - app works fine without it
        console.debug('[DesktopApp] YouTube cache load skipped:', err);
      }
    };

    // Schedule load in next microtask to avoid blocking render
    Promise.resolve().then(loadYouTubeCache).catch(console.debug);
  }, []);
  
  // Écouter les événements de chargement de tracks YouTube
  useEffect(() => {
    const handleYouTubeTracksLoaded = (event: CustomEvent<{ playlistId: string; tracks: Track[] }>) => {
      const { playlistId, tracks } = event.detail;
      setYoutubeTracksCache(prev => {
        const newMap = new Map(prev);
        newMap.set(playlistId, tracks);
        return newMap;
      });

      // Persister les tracks dans le cache local (pour survive au redémarrage)
      try {
        import('@/lib/youtube-track-cache').then(({ cacheYouTubeTrack }) => {
          tracks.forEach(t => {
            try { if (t.mediaSource === 'youtube') cacheYouTubeTrack(t); } catch (e) { /* ignore */ }
          });
        }).catch(() => {});
      } catch {}
    };
    
    // Écouter aussi les événements de récupération de tracks (depuis youtube-track-recovery)
    const handleTracksRecovered = (event: Event) => {
      console.log('[DesktopApp] 🔄 Tracks récupérés détectés, rechargement du cache...');
      const { tracks } = (event as CustomEvent<{ tracks: Track[] }>).detail || { tracks: [] };

      // Recharger tout le cache depuis localStorage pour avoir les tracks fraîchement récupérés
      void (async () => {
        try {
          const { getYouTubeTracksCache } = await import('@/lib/youtube-track-cache');
          const cachedTracks = getYouTubeTracksCache();
          if (cachedTracks && cachedTracks.size > 0) {
            const cachedArray = Array.from(cachedTracks.values());
            setYoutubeTracksCache(prev => {
              const newMap = new Map(prev);
              newMap.set('persistent-cache', cachedArray);
              return newMap;
            });
            console.log(`[DesktopApp] ✅ ${cachedArray.length} tracks rechargés dans l'état`);
          }
        } catch (err) {
          console.error('[DesktopApp] Erreur rechargement cache:', err);
        }
      })();
    };
    
    window.addEventListener('youtube-tracks-loaded', handleYouTubeTracksLoaded as EventListener);
    window.addEventListener('youtube-tracks-recovered', handleTracksRecovered);
    return () => {
      window.removeEventListener('youtube-tracks-loaded', handleYouTubeTracksLoaded as EventListener);
      window.removeEventListener('youtube-tracks-recovered', handleTracksRecovered);
    };
  }, []);
  
  // Combiner libraryTracks avec les tracks YouTube en cache
  const allTracks = useMemo(() => {
    const tracksMap = new Map<string, Track>();
    
    // Ajouter les tracks de la bibliothèque
    libraryTracks.forEach(track => tracksMap.set(track.id, track));
    
    // Ajouter les tracks YouTube en cache
    youtubeTracksCache.forEach(tracks => {
      tracks.forEach(track => {
        if (!tracksMap.has(track.id)) {
          tracksMap.set(track.id, track);
        }
      });
    });
    
    return Array.from(tracksMap.values());
  }, [libraryTracks, youtubeTracksCache]);
  const { favorites, isFavorite, addFavorite, removeFavorite } = useFavorites();
  const { history, addToHistory, recordPlayback } = usePlayHistory();
  const { 
    playlists, 
    createPlaylist, 
    updatePlaylist, 
    deletePlaylist, 
    addTracksToPlaylist, 
    removeTracksFromPlaylist 
  } = usePlaylists();
  
  // Récupération automatique des tracks YouTube manquants au démarrage (ASYNC - background task)
  useEffect(() => {
    const recoverMissingTracks = async () => {
      // Don't block on libraryLoading - spawn recovery task in background
      // It's OK if task runs before library is fully loaded
      
      try {
        // Collecter tous les IDs de tracks référencés
        const referencedIds = new Set<string>();
        
        // Favoris
        favorites.forEach(id => referencedIds.add(id));
        
        // Historique
        history.forEach(entry => {
          referencedIds.add(entry.trackId);
        });
        
        // Playlists
        playlists.forEach(playlist => {
          playlist.trackIds?.forEach(id => referencedIds.add(id));
        });
        
        // Filtrer les IDs qui ne sont pas dans allTracks
        const missingIds = Array.from(referencedIds).filter(id => {
          return !allTracks.find(t => t.id === id);
        });
        
        if (missingIds.length > 0) {
          console.log(`[DesktopApp] Spawning recovery task for ${missingIds.length} missing YouTube tracks...`);
          try {
            // Spawn async recovery task via bus (doesn't block boot)
            await spawnTask("youtube-recovery", { trackIds: missingIds })
          } catch (err) {
            console.debug("[DesktopApp] Task spawn skipped (OK on boot):", err);
            // Fallback to inline recovery only if needed later
          }
        }
      } catch (error) {
        console.debug('[DesktopApp] Recovery task deferral OK:', error);
      }
    };
    
    // Defer recovery to background (5s delay) - don't block initial render at all
    const timer = setTimeout(recoverMissingTracks, 5000);
    return () => clearTimeout(timer);
  }, [favorites, history, playlists, allTracks]); // Include deps but recovery still deferred
  
  const { overallProgress: cloudSyncProgress, isUploading: cloudSyncUploading } = useCloudSync();
  const { overallProgress: cloudinaryProgress, isUploading: cloudinaryUploading } = useCloudinaryUpload();
  const { notifications, notifySuccess, notifyError } = useNotifications();
  
  // Combined upload progress (Cloudinary or Nexus)
  const overallProgress = cloudinaryUploading ? cloudinaryProgress : (cloudSyncUploading ? cloudSyncProgress : undefined);
  const isUploading = cloudinaryUploading || cloudSyncUploading;
  
  // Queue management
  const {
    queue,
    currentTrack: queueCurrentTrack,
    addToQueue,
    addToQueueNext,
    removeFromQueue,
    clearQueue,
    setCurrentIndex,
    setQueue,
    shuffle: shuffleQueue,
    unshuffle: unshuffleQueue,
    isShuffled: queueIsShuffled,
  } = useQueue(libraryTracks);

  // File processing with async worker
  const { processFiles } = useFileProcessing();

  // Si la file restaurée correspond exactement à toute la bibliothèque (héritage de l'ancien autofill), on la vide
  useEffect(() => {
    if (!libraryTracks.length || !queue.tracks.length) return;
    if (queue.tracks.length !== libraryTracks.length) return;
    const sameOrder = queue.tracks.every((t, i) => t.id === libraryTracks[i]?.id);
    if (sameOrder) {
      clearQueue();
    }
  }, [libraryTracks, queue.tracks, clearQueue]);
  
  // Préchargement YouTube au démarrage (en arrière-plan)
  useEffect(() => {
    // Attendre que les données soient chargées
    if (libraryLoading || !libraryTracks.length) return;

    // Précharger via le service YouTube unifié
    const prefetchTrending = async () => {
      try {
        const { youtubePlayer } = await import('@/services/youtube/player');
        // Le service player gère le prefetch automatiquement
        console.log('[DesktopApp] YouTube service prêt');
      } catch (error) {
        console.warn('[DesktopApp] Erreur initialisation YouTube:', error);
      }
    };

    // Précharger avec délai pour ne pas surcharger au démarrage
    const timeout = setTimeout(prefetchTrending, 2000);
    return () => clearTimeout(timeout);
  }, [libraryLoading, libraryTracks.length]);
  
  const tracks = queue.tracks.length > 0 ? queue.tracks : libraryTracks;
  const currentTrackIndex = queue.currentIndex;
  const currentTrack = queueCurrentTrack || (tracks.length > 0 ? tracks[currentTrackIndex] || tracks[0] : null);
  
  // Refs pour suivre le temps d'écoute de chaque piste
  const playbackStartTimeRef = useRef<number | null>(null);
  const playbackStartTrackIdRef = useRef<string | null>(null);
  const accumulatedPlaybackTimeRef = useRef<number>(0);
  const lastTimeUpdateRef = useRef<number>(Date.now());
  
  // Refs pour stocker les fonctions de manière stable
  const recordPlaybackRef = useRef(recordPlayback);
  const addToHistoryRef = useRef(addToHistory);
  const handleNextRef = useRef<(() => void) | null>(null);
  
  // Mettre à jour les refs quand les fonctions changent
  useEffect(() => {
    recordPlaybackRef.current = recordPlayback;
    addToHistoryRef.current = addToHistory;
  }, [recordPlayback, addToHistory]);
  
  const [isLoading, setIsLoading] = useState(true);
  
  // Navigation orchestrator with history
  const { 
    currentView, 
    navigateTo, 
    goBack, 
    goForward, 
    canGoBack, 
    canGoForward,
    viewParams
  } = useViewNavigation();
  
  // Alias for compatibility with existing code
  const setCurrentView = navigateTo;
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isArtistInfoOpen, setIsArtistInfoOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [showInlinePlayer, setShowInlinePlayer] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [albumToOpen, setAlbumToOpen] = useState<string | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [showVideoMode, setShowVideoMode] = useState(false); // Toggle between audio visualizer and video in fullscreen
  const [playlistToOpen, setPlaylistToOpen] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [recentSearchQuery, setRecentSearchQuery] = useState<string>("");
  const [isPlayQueueDialogOpen, setIsPlayQueueDialogOpen] = useState(false);
  const [pendingFilesToProcess, setPendingFilesToProcess] = useState<File[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [currentOpenFilesTaskId, setCurrentOpenFilesTaskId] = useState<string | null>(null);
  // const [isKaraokeOpen, setIsKaraokeOpen] = useState(false); // DÉSACTIVÉ - Système karaoke désactivé

  // Monitor open-files task status with polling
  const { snapshot: openFilesSnapshot, isLoading: isOpenFilesLoading } = useTaskStatus(currentOpenFilesTaskId);

  // Restore sidebar collapsed state
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem('nexus-sidebar-collapsed');
      if (saved !== null) {
        setSidebarCollapsed(saved === 'true');
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  // Persist sidebar collapsed state
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem('nexus-sidebar-collapsed', String(sidebarCollapsed));
    } catch {
      // ignore storage errors
    }
  }, [sidebarCollapsed]);

  // Audio element ref for real playback
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // YouTube Player ref pour lecture persistante en arrière-plan
  const youtubePlayerRef = useRef<YouTubePlayerRef | null>(null);
  const youtubePausedMuteRef = useRef(false);
  const youtubePrevVolumeRef = useRef(volume);

  // Audio AI Analysis - DÉSACTIVÉ TEMPORAIREMENT
  // TODO: Réactiver le système d'analyse audio plus tard
  // const audioUrl = currentTrack?.filePath 
  //   ? (getAudioSrc(currentTrack.filePath) ?? undefined)
  //   : (currentTrack?.mediaSource === 'youtube' && currentTrack?.youtubeVideoId
  //     ? `https://www.youtube.com/watch?v=${currentTrack.youtubeVideoId}`
  //     : undefined);
  
  // const { analysis: audioAnalysis, startBrowserAnalysis, startAIAnalysis, isPro: isAudioAIPro } = useAudioAI({
  //   mediaElement: audioRef.current,
  //   audioUrl: audioUrl,
  //   autoStart: true,
  //   enableAI: false,
  // });
  
  // Valeurs par défaut pour éviter les erreurs
  const audioAnalysis = null;
  const startAIAnalysis = () => {};
  const isAudioAIPro = false;
  
  // Durée du player YouTube (pour les tracks YouTube où currentTrack.duration peut être 0)
  const [youtubeDuration, setYoutubeDuration] = useState(0);

  // Loading complete handler
  const handleLoadComplete = useCallback(() => {
    setIsLoading(false);
  }, []);


  // Listen for video playing state changes
  useEffect(() => {
    const handleVideoPlaying = (e: CustomEvent) => {
      setIsVideoPlaying(e.detail.isPlaying);
    };

    window.addEventListener("video-playing", handleVideoPlaying as EventListener);
    return () => {
      window.removeEventListener("video-playing", handleVideoPlaying as EventListener);
    };
  }, []);

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume / 100;
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Update audio source when track changes
  useEffect(() => {
    if (!audioRef.current || !currentTrack) return;

    // Pour les tracks YouTube, on ne peut pas utiliser l'élément audio HTML
    // Le player YouTube sera géré séparément via le composant YouTubePlayer
    if ((currentTrack.mediaSource as string) === 'youtube') {
      console.log('Track YouTube détecté, le player YouTube sera utilisé');
      // Réinitialiser seulement la durée, currentTime sera géré par le player YouTube persistant
      setYoutubeDuration(0);
      // Ne pas charger dans l'élément audio HTML
      return;
    }

    // Check if we have a real file path (Electron mode)
    if (currentTrack.filePath) {
      const audioSrc = getAudioSrc(currentTrack.filePath);
      if (audioSrc) {
        console.log('Loading audio:', audioSrc);
        
        // Attendre que l'audio soit chargé avant de jouer pour éviter l'erreur
        const handleCanPlay = () => {
          if (isPlaying && audioRef.current) {
            audioRef.current.play().catch((err) => {
              console.error('Failed to play audio:', err);
            });
          }
          audioRef.current?.removeEventListener('canplay', handleCanPlay);
        };
        
        const handleLoadedData = () => {
          if (isPlaying && audioRef.current) {
            audioRef.current.play().catch((err) => {
              console.error('Failed to play audio:', err);
            });
          }
          audioRef.current?.removeEventListener('loadeddata', handleLoadedData);
        };
        
        // Ajouter les listeners avant de changer la source
        audioRef.current.addEventListener('canplay', handleCanPlay);
        audioRef.current.addEventListener('loadeddata', handleLoadedData);
        
        // Changer la source et charger
        audioRef.current.src = audioSrc;
        audioRef.current.load();
      }
    }

    // Enregistrer le temps d'écoute de la piste précédente si elle existe et est différente
    const previousTrackId = playbackStartTrackIdRef.current;
    if (previousTrackId && previousTrackId !== currentTrack?.id) {
      // Mettre à jour le temps accumulé une dernière fois avant de changer
      if (playbackStartTimeRef.current !== null) {
        const realTimeNow = Date.now();
        const delta = (realTimeNow - lastTimeUpdateRef.current) / 1000;
        accumulatedPlaybackTimeRef.current += delta;
        lastTimeUpdateRef.current = realTimeNow;
      }
      
      const elapsedTime = accumulatedPlaybackTimeRef.current;
      if (elapsedTime > 0) {
        const previousTrack = tracks.find(t => t.id === previousTrackId);
        const previousTrackDuration = previousTrack?.duration || 0;
        const completedPercentage = previousTrackDuration > 0
          ? Math.min(100, (elapsedTime / previousTrackDuration) * 100)
          : 100;
        
        // Enregistrer la session d'écoute de la piste précédente
        recordPlaybackRef.current(previousTrackId, elapsedTime, completedPercentage, previousTrack?.youtubeVideoId);
      }
      
      if (isPlaying) {
        // Si on reprend la lecture, redémarrer le compteur
        if (playbackStartTimeRef.current === null) {
          playbackStartTimeRef.current = Date.now();
          lastTimeUpdateRef.current = Date.now();
        }
      } else {
        // Si on pause, on garde le temps accumulé mais on arrête le compteur
        // Ne pas mettre à null si on a déjà du temps accumulé
        if (playbackStartTimeRef.current !== null) {
          // Mettre à jour le temps accumulé une dernière fois avant de pause
          const realTimeNow = Date.now();
          const delta = (realTimeNow - lastTimeUpdateRef.current) / 1000;
          accumulatedPlaybackTimeRef.current += delta;
          lastTimeUpdateRef.current = realTimeNow;
          playbackStartTimeRef.current = null;
        }
      }
    }
  }, [currentTrack?.id, isPlaying, tracks]);

  // Handle play/pause
  useEffect(() => {
    // Pour les tracks YouTube, ne pas utiliser l'audio HTML5
    // Le player YouTube sera géré par FullscreenPlayer
    if ((currentTrack?.mediaSource as string) === 'youtube') {
      // S'assurer que l'audio HTML5 est arrêté si un track YouTube est sélectionné
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      
      // Démarrer le suivi du temps d'écoute pour YouTube
      if (isPlaying && currentTrack && playbackStartTrackIdRef.current === currentTrack.id && playbackStartTimeRef.current === null) {
        playbackStartTimeRef.current = Date.now();
        lastTimeUpdateRef.current = Date.now();
      } else if (!isPlaying && playbackStartTimeRef.current !== null) {
        // Mettre à jour le temps accumulé une dernière fois avant de pause
        const realTimeNow = Date.now();
        const delta = (realTimeNow - lastTimeUpdateRef.current) / 1000;
        accumulatedPlaybackTimeRef.current += delta;
        lastTimeUpdateRef.current = realTimeNow;
        playbackStartTimeRef.current = null;
      }
      
      return;
    }

    if (!audioRef.current || !currentTrack?.filePath) return;

    if (isPlaying) {
      // Reprendre le suivi du temps si on reprend la lecture
      if (playbackStartTrackIdRef.current === currentTrack.id && playbackStartTimeRef.current === null) {
        playbackStartTimeRef.current = Date.now();
        lastTimeUpdateRef.current = Date.now();
      }
      // Vérifier si l'audio n'est pas déjà en train de jouer pour éviter les appels multiples
      if (audioRef.current.paused) {
        audioRef.current.play().catch((err) => {
          console.error('Erreur lors de la lecture:', err);
          // Si la lecture échoue, mettre à jour l'état
          setIsPlaying(false);
        });
      }
    } else {
      // Enregistrer le temps d'écoute accumulé quand on pause (pour tracks locaux ET YouTube)
      if (playbackStartTrackIdRef.current === currentTrack.id && accumulatedPlaybackTimeRef.current > 0) {
        // Mettre à jour le temps accumulé une dernière fois
        if (playbackStartTimeRef.current !== null) {
          const realTimeNow = Date.now();
          const delta = (realTimeNow - lastTimeUpdateRef.current) / 1000;
          accumulatedPlaybackTimeRef.current += delta;
          lastTimeUpdateRef.current = realTimeNow;
        }
        
        const elapsedTime = accumulatedPlaybackTimeRef.current;
        // Pour YouTube, utiliser youtubeDuration si disponible
        const trackDuration = (currentTrack.mediaSource as string) === 'youtube' 
          ? (youtubeDuration || currentTrack.duration || 0)
          : (currentTrack.duration || 0);
        const completedPercentage = trackDuration > 0
          ? Math.min(100, (elapsedTime / trackDuration) * 100)
          : 100;
        
        // Enregistrer seulement si on a écouté au moins 5 secondes (éviter les clics accidentels)
        if (elapsedTime >= 5) {
          recordPlaybackRef.current(currentTrack.id, elapsedTime, completedPercentage, currentTrack.youtubeVideoId);
          // Réinitialiser pour la prochaine session
          accumulatedPlaybackTimeRef.current = 0;
        }
        playbackStartTimeRef.current = null;
      }
      
      // Pour les tracks locaux uniquement, pauser l'audio HTML5
      if ((currentTrack?.mediaSource as string) !== 'youtube' && audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrack?.filePath, currentTrack?.id, currentTrack?.mediaSource, currentTrack?.youtubeVideoId]);

  // Handle volume changes
  useEffect(() => {
    // Pour les tracks YouTube, le volume est géré par le player YouTube dans FullscreenPlayer
    if ((currentTrack?.mediaSource as string) === 'youtube') {
      return;
    }
    
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }

    // Sync YouTube player volume/mute as well
    if ((currentTrack?.mediaSource as string)?.toString().toLowerCase().includes('youtube')) {
      const applyYouTubeVolume = () => {
        if (!youtubePlayerRef.current) return;
        const player = youtubePlayerRef.current;
        try {
          player.setVolume(isMuted ? 0 : volume);
          if (isMuted && !player.isMuted) {
            player.toggleMute();
          } else if (!isMuted && player.isMuted) {
            player.toggleMute();
          }
        } catch (err) {
          console.warn('[DesktopApp] Unable to sync YouTube volume/mute', err);
        }
      };

      applyYouTubeVolume();
      // Retry shortly in case the player wasn't fully ready
      const retryId = setTimeout(applyYouTubeVolume, 300);
      return () => clearTimeout(retryId);
    }
    
    // Save volume to localStorage and sync to Firebase
    localStorage.setItem('nexus-volume', volume.toString());
    
    // Sync to Firebase (debounced)
    const timeoutId = setTimeout(async () => {
      try {
        const { firebaseSyncService } = await import('@/services/firebase-sync');
        firebaseSyncService.queueSync('volume', volume);
      } catch (error) {
        // Silently fail if Firebase sync is not available
      }
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [volume, isMuted, currentTrack?.mediaSource, currentTrack?.youtubeVideoId]);

  // Define handlers before useEffects that use them
  const handlePlayPause = useCallback(() => {
    // Pour les tracks YouTube, contrôler directement le player YouTube
    if ((currentTrack?.mediaSource as string) === 'youtube' && youtubePlayerRef.current) {
      const player = youtubePlayerRef.current;
      
      // Utiliser l'état local comme source de vérité (plus fiable que player.isPlaying)
      // Le callback onStateChange synchronisera l'état après l'action
      if (isPlaying) {
        try {
          youtubePrevVolumeRef.current = volume;
          try {
            player.setVolume(0);
          } catch {
            // Ignore volume errors
          }
          if (!player.isMuted && typeof player.toggleMute === 'function') {
            player.toggleMute();
            youtubePausedMuteRef.current = true;
          }
          player.pause();
          // Mettre à jour l'état immédiatement (optimistic update)
          // Le callback onStateChange confirmera la mise à jour
          flushSync(() => setIsPlaying(false));
        } catch (err) {
          console.error('[DesktopApp] Erreur lors de la pause YouTube:', err);
        }
      } else {
        try {
          if (!isMuted) {
            try {
              const restoreVolume = volume > 0 ? volume : youtubePrevVolumeRef.current || 100;
              player.setVolume(restoreVolume);
            } catch {
              // Ignore volume sync failures
            }
          }
          if (youtubePausedMuteRef.current && player.isMuted && typeof player.toggleMute === 'function') {
            if (!isMuted && volume > 0) {
              player.toggleMute();
            }
            youtubePausedMuteRef.current = false;
          }
          player.play();
          // Mettre à jour l'état immédiatement (optimistic update)
          flushSync(() => setIsPlaying(true));
        } catch (err) {
          console.error('[DesktopApp] Erreur lors de la lecture YouTube:', err);
        }
      }
    } else {
      // Pour les tracks locaux, basculer l'état
      flushSync(() => setIsPlaying(prev => !prev));
    }
  }, [currentTrack?.mediaSource, isPlaying]);

  const handlePrevious = useCallback(() => {
    if (tracks.length === 0) return;
    
    // Enregistrer le temps d'écoute de la piste actuelle avant de changer
    if (playbackStartTrackIdRef.current && accumulatedPlaybackTimeRef.current > 0) {
      // Mettre à jour le temps accumulé une dernière fois
      if (playbackStartTimeRef.current !== null) {
        const realTimeNow = Date.now();
        const delta = (realTimeNow - lastTimeUpdateRef.current) / 1000;
        accumulatedPlaybackTimeRef.current += delta;
        lastTimeUpdateRef.current = realTimeNow;
      }
      
      const elapsedTime = accumulatedPlaybackTimeRef.current;
      const currentTrackData = tracks.find(t => t.id === playbackStartTrackIdRef.current);
      if (currentTrackData && elapsedTime > 0) {
        const completedPercentage = currentTrackData.duration > 0
          ? Math.min(100, (elapsedTime / currentTrackData.duration) * 100)
          : 100;
        recordPlaybackRef.current(playbackStartTrackIdRef.current, elapsedTime, completedPercentage, currentTrackData.youtubeVideoId);
      }
      
      // Réinitialiser les refs après enregistrement pour éviter les conflits
      playbackStartTimeRef.current = null;
      playbackStartTrackIdRef.current = null;
      accumulatedPlaybackTimeRef.current = 0;
    }
    
    // Pour les tracks YouTube, ne pas utiliser la logique de réinitialisation basée sur currentTime
    // car currentTime est géré par le player YouTube persistant
    if ((currentTrack?.mediaSource as string) === 'youtube') {
      const newIndex = currentTrackIndex === 0 ? tracks.length - 1 : currentTrackIndex - 1;
      setCurrentIndex(newIndex);
      setCurrentTime(0);
      return;
    }
    
    if (currentTime > 3) {
      setCurrentTime(0);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
    } else {
      const newIndex = currentTrackIndex === 0 ? tracks.length - 1 : currentTrackIndex - 1;
      setCurrentIndex(newIndex);
      setCurrentTime(0);
    }
  }, [currentTime, tracks, currentTrackIndex, setCurrentIndex, currentTrack?.mediaSource]);

  const handleNext = useCallback(() => {
    if (tracks.length === 0) return;

    // Enregistrer le temps d'écoute de la piste actuelle avant de changer (sauf pour repeat one)
    if (repeatMode !== "one" && playbackStartTrackIdRef.current && accumulatedPlaybackTimeRef.current > 0) {
      // Mettre à jour le temps accumulé une dernière fois
      if (playbackStartTimeRef.current !== null) {
        const realTimeNow = Date.now();
        const delta = (realTimeNow - lastTimeUpdateRef.current) / 1000;
        accumulatedPlaybackTimeRef.current += delta;
        lastTimeUpdateRef.current = realTimeNow;
      }
      
      const elapsedTime = accumulatedPlaybackTimeRef.current;
      const currentTrackData = tracks.find(t => t.id === playbackStartTrackIdRef.current);
      if (currentTrackData && elapsedTime > 0) {
        const completedPercentage = currentTrackData.duration > 0
          ? Math.min(100, (elapsedTime / currentTrackData.duration) * 100)
          : 100;
        recordPlaybackRef.current(playbackStartTrackIdRef.current, elapsedTime, completedPercentage, currentTrackData.youtubeVideoId);
      }
      
      // Réinitialiser les refs après enregistrement pour éviter les conflits
      playbackStartTimeRef.current = null;
      playbackStartTrackIdRef.current = null;
      accumulatedPlaybackTimeRef.current = 0;
    }

    // Repeat one: restart current track
    if (repeatMode === "one") {
      setCurrentTime(0);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(console.error);
      }
      return;
    }

    // Handle shuffle mode
    if (isShuffle) {
      let randomIndex;
      do {
        randomIndex = Math.floor(Math.random() * tracks.length);
      } while (randomIndex === currentTrackIndex && tracks.length > 1);
      setCurrentIndex(randomIndex);
      setCurrentTime(0);
      return;
    }

    // Normal progression with repeat mode handling
    const isLastTrack = currentTrackIndex === tracks.length - 1;
    
    if (isLastTrack) {
      // At the end of the queue
      if (repeatMode === "all") {
        // Loop back to beginning
        setCurrentIndex(0);
        setCurrentTime(0);
      } else {
        // Repeat off: stop playback at the end
        setIsPlaying(false);
        if (audioRef.current) {
          audioRef.current.pause();
        }
      }
    } else {
      // Move to next track and continue playing
      setCurrentIndex(currentTrackIndex + 1);
      setCurrentTime(0);
      // Keep playing when moving to next track
      setIsPlaying(true);
    }
  }, [repeatMode, isShuffle, currentTrackIndex, tracks, setCurrentIndex]);

  // Update current time from audio element with higher precision
  // Ne pas s'exécuter pour les tracks YouTube (géré par le player YouTube persistant)
  useEffect(() => {
    if (!audioRef.current || (currentTrack?.mediaSource as string) === 'youtube') return;

    // Use requestAnimationFrame for smoother, more frequent updates
    let animationFrameId: number;
    let lastUpdateTime = 0;

    const updateTime = () => {
      if (audioRef.current) {
        const now = audioRef.current.currentTime;
        // Update more frequently (every ~50ms or on significant change)
        if (Math.abs(now - lastUpdateTime) >= 0.05 || !lastUpdateTime) {
          setCurrentTime(now); // Keep decimal precision for lyrics sync
          lastUpdateTime = now;
          
          // Mettre à jour le temps d'écoute accumulé en temps réel
          if (isPlaying && currentTrack && playbackStartTrackIdRef.current === currentTrack.id) {
            const realTimeNow = Date.now();
            const delta = (realTimeNow - lastTimeUpdateRef.current) / 1000; // en secondes
            accumulatedPlaybackTimeRef.current += delta;
            lastTimeUpdateRef.current = realTimeNow;
          }
        }
        if (isPlaying) {
          animationFrameId = requestAnimationFrame(updateTime);
        }
      }
    };

    const handleTimeUpdate = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime); // Keep precision
        
        // Mettre à jour le temps d'écoute accumulé
        if (isPlaying && currentTrack && playbackStartTrackIdRef.current === currentTrack.id) {
          const realTimeNow = Date.now();
          const delta = (realTimeNow - lastTimeUpdateRef.current) / 1000;
          accumulatedPlaybackTimeRef.current += delta;
          lastTimeUpdateRef.current = realTimeNow;
        }
      }
    };

    const handleEnded = () => {
      // Enregistrer le temps d'écoute complet de la piste
      if (currentTrack && playbackStartTrackIdRef.current === currentTrack.id) {
        const elapsedTime = accumulatedPlaybackTimeRef.current;
        const completedPercentage = currentTrack.duration > 0
          ? Math.min(100, (elapsedTime / currentTrack.duration) * 100)
          : 100;
        
        recordPlaybackRef.current(currentTrack.id, elapsedTime, completedPercentage, currentTrack.youtubeVideoId);
        
        // Réinitialiser pour la prochaine piste
        playbackStartTimeRef.current = null;
        playbackStartTrackIdRef.current = null;
        accumulatedPlaybackTimeRef.current = 0;
      }
      
      // Always move to next track when current track ends
      // The handleNext logic will handle repeat modes and stopping at the end
      handleNextRef.current?.();
    };

    // Start animation frame loop for smooth updates when playing
    if (isPlaying) {
      animationFrameId = requestAnimationFrame(updateTime);
    }

    // Also listen to timeupdate as backup
    audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
    audioRef.current.addEventListener('ended', handleEnded);
    
    // Synchroniser l'état avec les événements natifs de l'audio
    const handlePlay = () => {
      // Si l'audio joue mais l'état dit pause, synchroniser
      if (!isPlaying && audioRef.current && !audioRef.current.paused) {
        setIsPlaying(true);
      }
    };
    
    const handlePause = () => {
      // Si l'audio est en pause mais l'état dit play, synchroniser
      if (isPlaying && audioRef.current && audioRef.current.paused) {
        setIsPlaying(false);
      }
    };
    
    const handlePlaying = () => {
      // L'audio a réellement commencé à jouer
      if (!isPlaying) {
        setIsPlaying(true);
      }
    };
    
    audioRef.current.addEventListener('play', handlePlay);
    audioRef.current.addEventListener('pause', handlePause);
    audioRef.current.addEventListener('playing', handlePlaying);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (audioRef.current) {
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        audioRef.current.removeEventListener('ended', handleEnded);
        audioRef.current.removeEventListener('play', handlePlay);
        audioRef.current.removeEventListener('pause', handlePause);
        audioRef.current.removeEventListener('playing', handlePlaying);
      }
    };
  }, [isPlaying, repeatMode, currentTrack?.id, currentTrack?.mediaSource]);

  // Fallback: Simulate playback progress when no real audio file
  // Ne pas s'exécuter pour les tracks YouTube (géré par le player YouTube persistant)
  useEffect(() => {
    if ((currentTrack?.mediaSource as string) === 'youtube') return;
    if (!isPlaying || !currentTrack || currentTrack.filePath) return;

    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        if (prev >= currentTrack.duration) {
          // Handle repeat mode when simulated track ends
          if (repeatMode === "one") {
            return 0; // Restart current track
          } else {
            handleNextRef.current?.();
            return 0;
          }
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, currentTrack?.duration, currentTrack?.filePath, repeatMode, currentTrack?.mediaSource]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.code) {
        case "Space":
          e.preventDefault();
          setIsPlaying((prev) => !prev);
          break;
        case "ArrowRight":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleNextRef.current?.();
          }
          break;
        case "ArrowLeft":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handlePrevious();
          }
          break;
        case "ArrowUp":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setVolume((prev) => Math.min(100, prev + 5));
          }
          break;
        case "ArrowDown":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setVolume((prev) => Math.max(0, prev - 5));
          }
          break;
        case "KeyM":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setIsMuted((prev) => !prev);
          }
          break;
        case "F11":
          e.preventDefault();
          setIsFullscreen((prev) => !prev);
          break;
        case "Escape":
          if (isFullscreen) {
            setIsFullscreen(false);
          } else if (showInlinePlayer) {
            setShowInlinePlayer(false);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, showInlinePlayer]);

  const handleSeek = useCallback((value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);
    // Pour les tracks YouTube, utiliser le player YouTube persistant
    if ((currentTrack?.mediaSource as string) === 'youtube' && youtubePlayerRef.current) {
      try {
        youtubePlayerRef.current.seek(newTime);
      } catch (err) {
        console.error('[DesktopApp] Erreur seek YouTube:', err);
      }
      return;
    }
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  }, [currentTrack?.mediaSource]);

  const handleVolumeChange = useCallback((value: number[]) => {
    const nextVol = value[0];
    setVolume(nextVol);
    setIsMuted(prev => (prev && nextVol > 0 ? false : prev));

    // Apply immediately to YouTube player to avoid waiting for effect ticks
    if ((currentTrack?.mediaSource as string)?.toString().toLowerCase().includes('youtube') && youtubePlayerRef.current) {
      try {
        youtubePlayerRef.current.setVolume(nextVol);
        if (nextVol === 0 && !youtubePlayerRef.current.isMuted) {
          youtubePlayerRef.current.toggleMute();
        } else if (nextVol > 0 && youtubePlayerRef.current.isMuted) {
          youtubePlayerRef.current.toggleMute();
        }
      } catch (err) {
        console.warn('[DesktopApp] Immediate YouTube volume sync failed:', err);
      }
    }
  }, []);

  const handleRepeat = useCallback(() => {
    const modes: ("off" | "all" | "one")[] = ["off", "all", "one"];
    const currentIndex = modes.indexOf(repeatMode);
    setRepeatMode(modes[(currentIndex + 1) % modes.length]);
  }, [repeatMode]);

  const handleTrackSelect = useCallback((index: number) => {
    setCurrentIndex(index);
    setCurrentTime(0);
    setIsPlaying(true);
    
    // Auto-fill queue with album tracks from current track
    const track = tracks[index];
    if (track) {
      const albumTracks = libraryTracks.filter(
        t => t.album === track.album && t.artist === track.artist
      ).sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0));
      
      const currentTrackIndexInAlbum = albumTracks.findIndex(t => t.id === track.id);
      if (currentTrackIndexInAlbum >= 0) {
        const remainingAlbumTracks = albumTracks.slice(currentTrackIndexInAlbum + 1);
        // Add remaining album tracks to queue after current position
        if (remainingAlbumTracks.length > 0) {
          const currentQueueTracks = queue.tracks;
          const insertIndex = index + 1;
          const tracksToAdd = remainingAlbumTracks.filter(
            t => !currentQueueTracks.slice(insertIndex).some(qt => qt.id === t.id)
          );
          if (tracksToAdd.length > 0) {
            addToQueueNext(tracksToAdd);
          }
        }
      }
    }
  }, [tracks, libraryTracks, queue.tracks, setCurrentIndex, addToQueueNext]);

  // Play a track directly (add to queue if not present, then play)
  const handlePlayTrack = useCallback((track: Track) => {
    // Check if track is already in queue
    const existingIndex = queue.tracks.findIndex(t => t.id === track.id);
    
    if (existingIndex >= 0) {
      // Track is already in queue, just play it
      setCurrentIndex(existingIndex);
      setCurrentTime(0);
      setIsPlaying(true);
    } else {
      // Add track to queue - it will be added at the end
      const newIndex = queue.tracks.length;
      addToQueue([track]);
      // Play it immediately (the track will be at the end of the queue)
      setCurrentIndex(newIndex);
      setCurrentTime(0);
      setIsPlaying(true);
    }
  }, [queue.tracks, setCurrentIndex, addToQueue]);

  // Queue management handlers
  const handlePlayNext = useCallback((track: Track | Track[]) => {
    const tracksToAdd = Array.isArray(track) ? track : [track];
    addToQueueNext(tracksToAdd);
    const message = `Ajouté${tracksToAdd.length > 1 ? 's' : ''} à la suite`;
    toast.success(message);
    notifySuccess(message);
  }, [addToQueueNext, notifySuccess]);

  const handleAddToQueue = useCallback((track: Track | Track[]) => {
    const tracksToAdd = Array.isArray(track) ? track : [track];
    addToQueue(tracksToAdd);
    const message = `Ajouté${tracksToAdd.length > 1 ? 's' : ''} à la file`;
    toast.success(message);
    notifySuccess(message);
  }, [addToQueue, notifySuccess]);

  const handleAddToPlaylist = useCallback(async (playlistId: string, track: Track | Track[]) => {
    const tracksToAdd = Array.isArray(track) ? track : [track];
    const trackIds = tracksToAdd.map(t => t.id);
    try {
      await addTracksToPlaylist(playlistId, trackIds);
      const message = `Ajouté${tracksToAdd.length > 1 ? 's' : ''} à la playlist`;
      toast.success(message);
      notifySuccess(message);
    } catch (error) {
      console.error('Failed to add tracks to playlist:', error);
      const errorMsg = 'Erreur lors de l\'ajout à la playlist';
      toast.error(errorMsg);
      notifyError(errorMsg);
    }
  }, [addTracksToPlaylist, notifySuccess, notifyError]);

  const handleShuffle = useCallback(() => {
    if (isShuffle) {
      unshuffleQueue();
      setIsShuffle(false);
    } else {
      shuffleQueue();
      setIsShuffle(true);
    }
  }, [isShuffle, shuffleQueue, unshuffleQueue]);

  // Sync shuffle state with queue
  useEffect(() => {
    setIsShuffle(queueIsShuffled);
  }, [queueIsShuffled]);

  // Playlist handlers
  // IMPORTANT: Cette fonction remplace UNIQUEMENT la file d'attente (UI)
  // Elle ne supprime AUCUNE autre donnée (playlists, favoris, historique, etc.)
  const handlePlayPlaylist = useCallback((playlistId: string) => {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) {
      const errorMsg = 'Playlist introuvable';
      toast.error(errorMsg);
      notifyError(errorMsg);
      return;
    }

    // Get tracks from playlist trackIds - utiliser getTrackFromAllOrCache pour fallback au cache YouTube
    const playlistTracks = playlist.trackIds
      .map(id => getTrackFromAllOrCache(allTracks, id))
      .filter((t): t is Track => t !== null);

    if (playlistTracks.length === 0) {
      const errorMsg = 'La playlist est vide';
      toast.error(errorMsg);
      notifyError(errorMsg);
      return;
    }

    // Remplace uniquement la file d'attente (UI) - ne supprime aucune autre donnée
    setQueue(playlistTracks);
    setCurrentIndex(0);
    setIsPlaying(true);
    const message = `Lecture de "${playlist.name}"`;
    toast.success(message);
    notifySuccess(message);
  }, [playlists, allTracks, setQueue, setCurrentIndex, setIsPlaying, notifySuccess, notifyError]);

  // IMPORTANT: Cette fonction remplace UNIQUEMENT la file d'attente (UI)
  // Elle ne supprime AUCUNE autre donnée (playlists, favoris, historique, etc.)
  const handleShufflePlaylist = useCallback((playlistId: string) => {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) {
      const errorMsg = 'Playlist introuvable';
      toast.error(errorMsg);
      notifyError(errorMsg);
      return;
    }

    // Get tracks from playlist trackIds - utiliser getTrackFromAllOrCache pour fallback au cache YouTube
    const playlistTracks = playlist.trackIds
      .map(id => getTrackFromAllOrCache(allTracks, id))
      .filter((t): t is Track => t !== null);

    if (playlistTracks.length === 0) {
      const errorMsg = 'La playlist est vide';
      toast.error(errorMsg);
      notifyError(errorMsg);
      return;
    }

    // Shuffle tracks
    const shuffled = [...playlistTracks].sort(() => Math.random() - 0.5);

    // Remplace uniquement la file d'attente (UI) - ne supprime aucune autre donnée
    setQueue(shuffled);
    setCurrentIndex(0);
    setIsPlaying(true);
    setIsShuffle(true);
    const message = t("toastShufflePlaylist", { name: playlist.name });
    toast.success(message);
    notifySuccess(message);
  }, [playlists, allTracks, setQueue, setCurrentIndex, setIsShuffle, notifySuccess, notifyError, t]);

  // Handler pour supprimer un track de la file par son ID
  const handleRemoveFromQueue = useCallback((trackId: string) => {
    const index = tracks.findIndex(t => t.id === trackId);
    if (index !== -1 && index > currentTrackIndex) {
      removeFromQueue(index);
      toast.success(t("toastQueueRemoved"));
    }
  }, [tracks, currentTrackIndex, removeFromQueue, t]);

  // Handlers for PlaylistView - play/shuffle tracks by IDs
  // IMPORTANT: Cette fonction remplace UNIQUEMENT la file d'attente (UI)
  // Elle ne supprime AUCUNE autre donnée (playlists, favoris, historique, etc.)
  const handlePlayTracks = useCallback((trackIds: string[]) => {
    const tracksToPlay = trackIds
      .map(id => allTracks.find(t => t.id === id))
      .filter((t): t is Track => t !== undefined);

    if (tracksToPlay.length === 0) {
      const errorMsg = t("errorNoTracksFound");
      toast.error(errorMsg);
      notifyError(errorMsg);
      return;
    }

    // Remplace uniquement la file d'attente (UI) - ne supprime aucune autre donnée
    setQueue(tracksToPlay);
    setCurrentIndex(0);
    setIsPlaying(true);
    const message = t("toastPlayTracksCount", {
      count: tracksToPlay.length,
      suffix: tracksToPlay.length > 1 ? "s" : "",
    });
    toast.success(message);
    notifySuccess(message);
  }, [allTracks, setQueue, setCurrentIndex, setIsPlaying, notifySuccess, notifyError, t]);

  // Lecture d'une liste de tracks (remplace entièrement la file)
  // IMPORTANT: Cette fonction remplace UNIQUEMENT la file d'attente (UI)
  // Elle ne supprime AUCUNE autre donnée (playlists, favoris, historique, etc.)
  const handlePlayTrackList = useCallback((trackList: Track[], startIndex: number = 0) => {
    const validTracks = trackList.filter(Boolean);
    if (validTracks.length === 0) {
      toast.error(t("errorNoTracksFound"));
      notifyError(t("errorNoTracksFound"));
      return;
    }

    const clampedIndex = Math.max(0, Math.min(startIndex, validTracks.length - 1));
    // Remplace uniquement la file d'attente (UI) - ne supprime aucune autre donnée
    setQueue(validTracks);
    setCurrentIndex(clampedIndex);
    setIsPlaying(true);
    setIsShuffle(false);
    const message = t("toastPlayTracksCount", {
      count: validTracks.length,
      suffix: validTracks.length > 1 ? "s" : "",
    });
    toast.success(message);
    notifySuccess(message);
  }, [setQueue, setCurrentIndex, setIsPlaying, setIsShuffle, notifyError, notifySuccess, t]);

  // Action manuelle pour vider la file
  const handleClearQueue = useCallback(() => {
    clearQueue();
    toast.success(t("toastQueueCleared"));
  }, [clearQueue, t]);

  // IMPORTANT: Cette fonction remplace UNIQUEMENT la file d'attente (UI)
  // Elle ne supprime AUCUNE autre donnée (playlists, favoris, historique, etc.)
  const handleShuffleTracks = useCallback((trackIds: string[]) => {
    const tracksToPlay = trackIds
      .map(id => getTrackFromAllOrCache(allTracks, id))
      .filter((t): t is Track => t !== null);

    if (tracksToPlay.length === 0) {
      const errorMsg = t("errorNoTracksFound");
      toast.error(errorMsg);
      notifyError(errorMsg);
      return;
    }

    // Shuffle tracks
    const shuffled = [...tracksToPlay].sort(() => Math.random() - 0.5);

    // Remplace uniquement la file d'attente (UI) - ne supprime aucune autre donnée
    setQueue(shuffled);
    setCurrentIndex(0);
    setIsPlaying(true);
    setIsShuffle(true);
    const message = t("toastShuffleTracksCount", {
      count: shuffled.length,
      suffix: shuffled.length > 1 ? "s" : "",
    });
    toast.success(message);
    notifySuccess(message);
  }, [allTracks, setQueue, setCurrentIndex, setIsPlaying, setIsShuffle, notifySuccess, notifyError, t]);

  // Handler pour ouvrir une playlist dans PlaylistView
  const handleOpenPlaylist = useCallback((playlistId: string) => {
    setPlaylistToOpen(playlistId);
    setCurrentView("playlists");
    // Réinitialiser après un court délai pour permettre la réouverture
    setTimeout(() => setPlaylistToOpen(null), 100);
  }, []);

  const handleToggleFavorite = useCallback(() => {
    if (!currentTrack) return;
    if (isFavorite(currentTrack.id)) {
      removeFavorite(currentTrack.id);
    } else {
      addFavorite(currentTrack.id);
    }
  }, [currentTrack, isFavorite, addFavorite, removeFavorite]);

  const handleShowPlayer = useCallback(() => {
    if (showInlinePlayer) {
      setShowInlinePlayer(false);
      goBack(); // Use navigation history to go back
    } else {
      setShowInlinePlayer(true);
      setCurrentView("player");
    }
  }, [showInlinePlayer, goBack, setCurrentView]);

  // Écouter les événements pour jouer des vidéos YouTube comme audio
  useEffect(() => {
    const handleYouTubeAudioPlay = async (event: CustomEvent<Track>) => {
      const track = event.detail;
      
      // Cache la track YouTube pour persistance (metadata) si nécessaire
      if (track.mediaSource === 'youtube') {
        try {
          import('@/lib/youtube-track-cache').then(({ cacheYouTubeTrack }) => {
            try { cacheYouTubeTrack(track); } catch (e) { /* ignore */ }
          }).catch(() => {});
        } catch {}
      }

      // Ajouter le track à la queue s'il n'y est pas déjà
      const existingIndex = tracks.findIndex(t => t.id === track.id);
      if (existingIndex >= 0) {
        // Track déjà dans la queue, le jouer
        handleTrackSelect(existingIndex);
      } else {
        // Ajouter à la queue et jouer
        addToQueueNext(track);
        const newIndex = queue.tracks.length;
        // Attendre un peu plus pour s'assurer que le track est bien ajouté
        setTimeout(() => {
          setCurrentIndex(newIndex);
          // Démarrer la lecture automatiquement
          setIsPlaying(true);
        }, 200);
      }
      
      // Naviguer vers le player inline
      if (!showInlinePlayer) {
        setShowInlinePlayer(true);
        setCurrentView("player");
      }
      
      toast.success(`Lecture de "${track.title}" en mode audio`);
    };

    window.addEventListener('youtube-audio-play', handleYouTubeAudioPlay as unknown as EventListener);
    
    return () => {
      window.removeEventListener('youtube-audio-play', handleYouTubeAudioPlay as unknown as EventListener);
    };
  }, [tracks, queue.tracks.length, addToQueueNext, setCurrentIndex, handleTrackSelect, showInlinePlayer, setCurrentView]);

  // Écouter les événements pour ajouter les vidéos YouTube à l'historique audio
  useEffect(() => {
    const handleYouTubeVideoPlayed = (event: CustomEvent<{ videoId: string; trackId: string; title: string }>) => {
      const { trackId, videoId } = event.detail;
      
      // Ajouter à l'historique audio si le track est dans la queue
      const track = tracks.find(t => t.id === trackId);
      if (track) {
        console.log('[DesktopApp] Ajout de la vidéo YouTube à l\'historique audio:', track.title);
        // Cache la track YouTube si nécessaire (pour persistance des métadonnées)
        if (track.mediaSource === 'youtube') {
          import('@/lib/youtube-track-cache').then(({ cacheYouTubeTrack }) => {
            try { cacheYouTubeTrack(track); } catch (e) { /* ignore */ }
          }).catch(() => {});
        }
        addToHistory(trackId, videoId);
      } else {
        // Si le track n'est pas encore dans la queue, l'ajouter à l'historique quand même
        // Il sera synchronisé quand le track sera ajouté à la queue
        console.log('[DesktopApp] Track YouTube non trouvé dans la queue, ajout direct à l\'historique:', trackId);
        addToHistory(trackId, videoId);
      }
    };

    window.addEventListener('youtube-video-played', handleYouTubeVideoPlayed as unknown as EventListener);
    
    return () => {
      window.removeEventListener('youtube-video-played', handleYouTubeVideoPlayed as unknown as EventListener);
    };
  }, [tracks, addToHistory]);

  // Écouter les mises à jour Firebase pour volume et autres paramètres
  useEffect(() => {
    const handleFirebaseUpdate = (event: CustomEvent) => {
      const data = event.detail;
      console.log('[DesktopApp] Firebase sync: received data', data);
      
      // Synchroniser le volume depuis Firebase
      if (data?.volume !== undefined && data.volume !== volume) {
        console.log('[DesktopApp] Firebase sync: updating volume from', volume, 'to', data.volume);
        setVolume(data.volume);
      }
      
      // Synchroniser d'autres paramètres si nécessaire
      // Note: Les favoris, historique, theme sont gérés par leurs hooks respectifs
    };

    window.addEventListener('firebase-sync-update', handleFirebaseUpdate as EventListener);

    return () => {
      window.removeEventListener('firebase-sync-update', handleFirebaseUpdate as EventListener);
    };
  }, [volume]);

  // Lorsque les playlists locales sont chargées ou mises à jour, s'assurer
  // que les tracks YouTube référencés sont présents dans le cache local
  useEffect(() => {
    const handleLocalPlaylistsUpdate = (event: CustomEvent) => {
      const lists = event.detail as any[];
      (async () => {
        try {
          const [{ ensurePlaylistTracksCached }, { fetchYouTubePlaylistVideos }, { cacheYouTubeTrack }] = await Promise.all([
            import('@/lib/playlist-cache'),
            import('@/lib/youtube-playlists'),
            import('@/lib/youtube-track-cache'),
          ]);
          await ensurePlaylistTracksCached(lists, allTracks, { fetchYouTubePlaylistVideos, cacheYouTubeTrack });
        } catch (err) {
          console.warn('[DesktopApp] Error ensuring playlist tracks cached:', err);
        }
      })();
    };

    window.addEventListener('local-playlists-update', handleLocalPlaylistsUpdate as EventListener);

    // Run once on mount with the current playlists state to populate cache after initial load
    (async () => {
      try {
        const [{ ensurePlaylistTracksCached }, { fetchYouTubePlaylistVideos }, { cacheYouTubeTrack }] = await Promise.all([
          import('@/lib/playlist-cache'),
          import('@/lib/youtube-playlists'),
          import('@/lib/youtube-track-cache'),
        ]);
        await ensurePlaylistTracksCached(playlists, allTracks, { fetchYouTubePlaylistVideos, cacheYouTubeTrack });
      } catch (err) {
        // Ignore
      }
    })();

    return () => {
      window.removeEventListener('local-playlists-update', handleLocalPlaylistsUpdate as EventListener);
    };
  }, [playlists, allTracks]);

  // MenuBar Custom Events Handlers
  useEffect(() => {
    // Play/Pause toggle
    const handlePlayToggleEvent = () => {
      handlePlayPause();
    };
    window.addEventListener('nexus-play-toggle', handlePlayToggleEvent);

    // Previous track
    const handlePrevEvent = () => {
      handlePrevious();
    };
    window.addEventListener('nexus-play-prev', handlePrevEvent);

    // Next track
    const handleNextEvent = () => {
      handleNext();
    };
    window.addEventListener('nexus-play-next', handleNextEvent);

    // Toggle mini player
    const handleMiniPlayerEvent = () => {
      setShowInlinePlayer(prev => !prev);
    };
    window.addEventListener('nexus-toggle-mini-player', handleMiniPlayerEvent);

    // Open now playing view
    const handleNowPlayingEvent = () => {
      if (currentTrack) {
        setShowInlinePlayer(false);
        setCurrentView('player');
      }
    };
    window.addEventListener('nexus-open-now-playing', handleNowPlayingEvent);

    // Open queue view
    const handleQueueEvent = () => {
      setIsQueueOpen(prev => !prev);
    };
    window.addEventListener('nexus-open-queue', handleQueueEvent);

    // Toggle sidebar
    const handleSidebarEvent = () => {
      setSidebarCollapsed(prev => !prev);
    };
    window.addEventListener('nexus-toggle-sidebar', handleSidebarEvent);

    // New playlist - navigate to playlists view
    const handleNewPlaylistEvent = () => {
      setCurrentView('playlists');
    };
    window.addEventListener('nexus-new-playlist', handleNewPlaylistEvent);

    // Open files
    const handleOpenFilesEvent = async () => {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'audio/*';
        
        input.onchange = async (e) => {
          const files = Array.from((e.target as HTMLInputElement).files || []);
          if (files.length === 0) return;
          
          console.log('[DesktopApp] Files selected:', files.length);
          
          try {
            // Spawn a task to process the files asynchronously
            // Files will be serialized as a list of { name, size, lastModified, type }
            const fileData = files.map(f => ({
              name: f.name,
              size: f.size,
              lastModified: f.lastModified,
              type: f.type,
              arrayBuffer: null as any, // Will need to be handled differently via Blob URL or base64
            }))
            
            const envelope = await spawnTask("open-files", {
              fileCount: files.length,
              files: fileData,
              action: "queue", // Will be overridden by dialog choice
              timestamp: Date.now(),
            })
            
            // Store the files in state for the dialog (still needed for choice UI)
            setPendingFilesToProcess(files);
            
            // Track the task ID for polling status
            setCurrentOpenFilesTaskId(envelope.id);
            
            // Open the dialog for play/queue choice
            setIsPlayQueueDialogOpen(true);
            
            console.log('[DesktopApp] Task spawned:', envelope.id);
            
          } catch (err) {
            console.error('[DesktopApp] Error spawning task:', err);
            toast.error(t("errorProcessFiles"));
          }
        };
        
        input.click();
      } catch (err) {
        console.error('[DesktopApp] Error opening files:', err);
        toast.error(t("errorOpenFiles"));
      }
    };
    window.addEventListener('nexus-open-files', handleOpenFilesEvent);

    // Open folders
    const handleOpenFoldersEvent = async () => {
      try {
        console.log('[DesktopApp] Folder opening not available in browser mode');
        toast.info(t("infoDesktopOnly"));
      } catch (err) {
        console.error('[DesktopApp] Error opening folders:', err);
        toast.error(t("errorOpenFolders"));
      }
    };
    window.addEventListener('nexus-open-folders', handleOpenFoldersEvent);

    // Import library (sync from local files)
    const handleImportEvent = async () => {
      try {
        // This should trigger a full library scan from local files
        toast.success(t("toastImportLibraryInProgress"));
      } catch (err) {
        console.error('[DesktopApp] Error importing library:', err);
        toast.error(t("errorImportLibrary"));
      }
    };
    window.addEventListener('nexus-import-library', handleImportEvent);

    // Sync now (Firebase sync)
    const handleSyncEvent = async () => {
      try {
        toast.success(t("toastSyncInProgress"));
      } catch (err) {
        console.error('[DesktopApp] Error syncing:', err);
        toast.error(t("errorSync"));
      }
    };
    window.addEventListener('nexus-sync-now', handleSyncEvent);

    // Clear cache
    const handleClearCacheEvent = async () => {
      try {
        // Clear browser storage
        localStorage.clear();
        sessionStorage.clear();
        toast.success(t("toastCacheClearedSuccess"));
      } catch (err) {
        console.error('[DesktopApp] Error clearing cache:', err);
        toast.error(t("errorClearCache"));
      }
    };
    window.addEventListener('nexus-clear-cache', handleClearCacheEvent);

    // Check updates (Electron updater)
    const handleCheckUpdatesEvent = async () => {
      try {
        toast.info(t("toastCheckUpdates"));
      } catch (err) {
        console.error('[DesktopApp] Error checking updates:', err);
        toast.error(t("errorCheckUpdates"));
      }
    };
    window.addEventListener('nexus-check-updates', handleCheckUpdatesEvent);

    // About app
    const handleAboutEvent = () => {
      toast.info(t("aboutApp"));
    };
    window.addEventListener('nexus-about', handleAboutEvent);

    // Navigation handler
    const handleNavEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      const destination = customEvent.detail?.destination;
      const section = customEvent.detail?.section;
      
      if (destination) {
        setCurrentView(destination as any);
        setShowInlinePlayer(false);
        
        // Si une section est spécifiée et que c'est settings, passer le paramètre
        if (destination === 'settings' && section) {
          // Le paramètre section sera utilisé par SettingsView pour scroller/focus
          // Voir useViewNavigation pour les paramètres
          console.log('[DesktopApp] Navigate to settings with section:', section);
        }
      }
    };
    window.addEventListener('nexus-nav', handleNavEvent);

    // Open documentation
    const handleOpenDocumentationEvent = () => {
      try {
        window.open("https://github.com/Notho-freedom/nova-sound", "_blank");
      } catch (err) {
        console.error('[DesktopApp] Error opening documentation:', err);
        toast.error(t("errorOpenDocumentation"));
      }
    };
    window.addEventListener('nexus-open-documentation', handleOpenDocumentationEvent);

    // Cleanup
    return () => {
      window.removeEventListener('nexus-play-toggle', handlePlayToggleEvent);
      window.removeEventListener('nexus-play-prev', handlePrevEvent);
      window.removeEventListener('nexus-play-next', handleNextEvent);
      window.removeEventListener('nexus-toggle-mini-player', handleMiniPlayerEvent);
      window.removeEventListener('nexus-open-now-playing', handleNowPlayingEvent);
      window.removeEventListener('nexus-open-queue', handleQueueEvent);
      window.removeEventListener('nexus-toggle-sidebar', handleSidebarEvent);
      window.removeEventListener('nexus-new-playlist', handleNewPlaylistEvent);
      window.removeEventListener('nexus-open-files', handleOpenFilesEvent);
      window.removeEventListener('nexus-open-folders', handleOpenFoldersEvent);
      window.removeEventListener('nexus-import-library', handleImportEvent);
      window.removeEventListener('nexus-sync-now', handleSyncEvent);
      window.removeEventListener('nexus-clear-cache', handleClearCacheEvent);
      window.removeEventListener('nexus-check-updates', handleCheckUpdatesEvent);
      window.removeEventListener('nexus-about', handleAboutEvent);
      window.removeEventListener('nexus-nav', handleNavEvent);
      window.removeEventListener('nexus-open-documentation', handleOpenDocumentationEvent);
    };
  }, [handlePlayPause, handlePrevious, handleNext, currentTrack, setShowInlinePlayer, setCurrentView, setIsQueueOpen, addToQueue, setCurrentIndex, queue, t]);

  const handleOpenSettings = useCallback(() => {
    setCurrentView("settings");
    setShowInlinePlayer(false);
  }, []);

  const handleNavigateToAlbum = useCallback(() => {
    if (!currentTrack) return;
    setShowInlinePlayer(false);
    // Set the album key to open (format: "albumName-artistName")
    const albumKey = `${currentTrack.album}-${currentTrack.artist}`;
    setAlbumToOpen(albumKey);
    setCurrentView("albums");
    // Reset albumToOpen after a short delay to allow LibraryView to process it
    setTimeout(() => setAlbumToOpen(null), 100);
    toast.success(t("toastOpenAlbum", { name: currentTrack.album }));
  }, [currentTrack, t]);

  const handleNavigateToArtist = useCallback(() => {
    if (!currentTrack) return;
    setShowInlinePlayer(false);
    setSelectedArtist(currentTrack.artist);
    setCurrentView("artist-detail");
    toast.success(t("toastOpenArtist", { name: currentTrack.artist }));
  }, [currentTrack, t]);

  // Handler pour traiter les fichiers et les ajouter à la queue
  const handleProcessAndPlayFilesNow = useCallback(async () => {
    if (pendingFilesToProcess.length === 0) return;

    setIsProcessingFiles(true);
    try {
      console.log('[DesktopApp] Processing files locally...');
      
      // Still process locally (faster UI feedback) using the hook
      const newTracks = await processFiles(pendingFilesToProcess);
      
      if (newTracks.length > 0) {
        // Ajouter à la queue
        addToQueue(newTracks);
        
        // Pointer l'index sur le premier des nouveaux fichiers
        const newIndex = queue.tracks.length - newTracks.length;
        if (newIndex >= 0) {
          setCurrentIndex(newIndex);
        }
        
        // Toast de succès
        toast.success(t("toastFilesAddedToQueue", { count: newTracks.length }));
        console.log('[DesktopApp] Files processed and queued:', newTracks.length);
      }
    } catch (err) {
      console.error('[DesktopApp] Error processing files:', err);
      toast.error(t("errorProcessFiles"));
    } finally {
      setIsProcessingFiles(false);
      setPendingFilesToProcess([]);
      setIsPlayQueueDialogOpen(false);
      setCurrentOpenFilesTaskId(null);
    }
  }, [pendingFilesToProcess, processFiles, addToQueue, queue.tracks.length, setCurrentIndex, t]);

  // Handler pour ajouter les fichiers à la queue sans les jouer
  const handleAddFilesToQueue = useCallback(async () => {
    if (pendingFilesToProcess.length === 0) return;

    setIsProcessingFiles(true);
    try {
      console.log('[DesktopApp] Processing files locally for queue...');
      
      // Still process locally using the hook
      const newTracks = await processFiles(pendingFilesToProcess);
      
      if (newTracks.length > 0) {
        // Ajouter à la fin de la queue
        addToQueue(newTracks);
        
        // Toast de succès
        toast.success(t("toastFilesAddedToQueue", { count: newTracks.length }));
        console.log('[DesktopApp] Files processed and added to queue:', newTracks.length);
      }
    } catch (err) {
      console.error('[DesktopApp] Error processing files:', err);
      toast.error(t("errorProcessFiles"));
    } finally {
      setIsProcessingFiles(false);
      setPendingFilesToProcess([]);
      setIsPlayQueueDialogOpen(false);
      setCurrentOpenFilesTaskId(null);
    }
  }, [pendingFilesToProcess, processFiles, addToQueue, t]);

  // Utility function to remove duplicates from track lists
  const getUniqueTracks = useCallback((trackList: Track[]): Track[] => {
    const seen = new Set<string>();
    return trackList.filter(track => {
      if (seen.has(track.id)) {
        return false;
      }
      seen.add(track.id);
      return true;
    });
  }, []);

  // Get favorite tracks (without duplicates)
  // IMPORTANT: Ces données sont calculées à partir des favoris et ne sont JAMAIS supprimées
  // Les fonctions de lecture (handlePlayPlaylist, handlePlayTracks, etc.) ne touchent pas à ces données
  // BUGFIX: Utiliser allTracks au lieu de tracks pour éviter que les favoris soient vides
  // quand une playlist est jouée (car tracks devient queue.tracks qui ne contient que la playlist)
  const favoriteTracks = useMemo(() => {
    // Use resolver to fallback to YouTube cache when a favored track is not present in allTracks
    const resolved: (Track | null)[] = favorites.map(id => getTrackFromAllOrCache(allTracks, id));
    return getUniqueTracks(resolved.filter((t): t is Track => !!t));
  }, [allTracks, isFavorite, getUniqueTracks, favorites]);

  // Get recently played tracks from history (for QueuePanel) - without duplicates
  // Inclut les tracks de la queue (qui peuvent contenir des tracks YouTube)
  // BUGFIX: Utiliser allTracks comme source principale pour les lookups
  const historyTracks = useMemo(() => {
    const mapped = mapHistoryEntriesToTracks(history, allTracks, tracks, libraryTracks);
    return getUniqueTracks(mapped); // No limit - show all history
  }, [history, allTracks, tracks, libraryTracks, getUniqueTracks]);

  // Get recently played tracks from history (for HomeView) - without duplicates
  // IMPORTANT: Ces données sont calculées à partir de l'historique et ne sont JAMAIS supprimées
  // Les fonctions de lecture (handlePlayPlaylist, handlePlayTracks, etc.) ne touchent pas à ces données
  // BUGFIX: Utiliser allTracks au lieu de tracks pour éviter que les écoutes récentes soient vides
  // quand une playlist est jouée (car tracks devient queue.tracks qui ne contient que la playlist)
  const recentTracks = useMemo(() => {
    const mapped = mapHistoryEntriesToTracks(history, allTracks, tracks, libraryTracks);
    return getUniqueTracks(mapped); // No limit - show all recent tracks
  }, [history, allTracks, tracks, libraryTracks, getUniqueTracks]);

  // Get recently added tracks (sorted by addedAt date) - without duplicates
  const recentlyAddedTracks = useMemo(() => {
    const filtered = libraryTracks.filter(t => t.addedAt);
    const unique = getUniqueTracks(filtered);
    return unique
      .sort((a, b) => {
        const dateA = a.addedAt ? new Date(a.addedAt).getTime() : 0;
        const dateB = b.addedAt ? new Date(b.addedAt).getTime() : 0;
        return dateB - dateA; // Most recent first
      }); // No limit - show all recently added tracks
  }, [libraryTracks, getUniqueTracks]);

  // Get similar tracks (same artist or genre, random selection) - without duplicates
  // Se met à jour automatiquement quand currentTrack change
  // Note: Pour les tracks YouTube, les tracks similaires sont chargés directement dans QueuePanel
  const similarTracks = useMemo(() => {
    if (!currentTrack) return [];
    
    // Pour les tracks YouTube, retourner un tableau vide (sera géré par QueuePanel)
    if ((currentTrack.mediaSource as string) === 'youtube') {
      return [];
    }
    
    // Find tracks with same artist or genre
    const candidates = libraryTracks.filter(t => 
      t.id !== currentTrack.id && 
      (t.artist === currentTrack.artist || 
       (currentTrack.genre && t.genre === currentTrack.genre))
    );
    
    // Remove duplicates and shuffle
    const unique = getUniqueTracks(candidates);
    const shuffled = [...unique].sort(() => Math.random() - 0.5);
    return shuffled; // No limit - show all similar tracks
  }, [currentTrack?.id, currentTrack?.artist, currentTrack?.genre, currentTrack?.mediaSource, libraryTracks, getUniqueTracks]);

  // Calculer les compteurs pour la sidebar
  // CLEANUP FUNCTION: Remove orphaned references
  const cleanupOrphanedReferences = useCallback(async () => {
    console.log('🧹 [CLEANUP] Starting cleanup of orphaned references...');
    
    // Create set of valid track IDs
    const validTrackIds = new Set(allTracks.map(t => t.id));
    
    // Clean favorites
    const orphanFavorites = favorites.filter(id => !validTrackIds.has(id));
    if (orphanFavorites.length > 0) {
      const cleaned = favorites.filter(id => validTrackIds.has(id));
      console.log(`✅ Cleaned favorites: removed ${orphanFavorites.length} orphaned IDs`);
      // Use the hook's method to update (if available)
      orphanFavorites.forEach(id => {
        // This would need to call removeFavorite for each orphaned ID
        // For now, we'll just log the cleanup needed
      });
    }
    
    // Clean history
    const orphanHistory = history.filter(entry => !validTrackIds.has(entry.trackId));
    if (orphanHistory.length > 0) {
      console.log(`✅ Cleaned history: found ${orphanHistory.length} orphaned entries`);
      // History cleanup would be handled similarly
    }
    
    // Clean playlists
    for (const playlist of playlists) {
      const orphanTracks = playlist.trackIds?.filter(id => !validTrackIds.has(id)) || [];
      if (orphanTracks.length > 0) {
        console.log(`✅ Cleaned playlist "${playlist.name}": removed ${orphanTracks.length} orphaned track IDs`);
      }
    }
    
    console.log('✅ Cleanup complete');
  }, [allTracks, favorites, history, playlists]);

  const sidebarCounts = useMemo(() => {
    const availableTrackIds = new Set(allTracks.map(t => t.id));
    const validRecentTracks = recentTracks.filter(t => availableTrackIds.has(t.id));

    const albumsWithInfo = allTracks.filter(t => t.album);
    const uniqueAlbums = new Set(albumsWithInfo.map(t => `${t.album}-${t.artist}`));

    const artistsWithInfo = allTracks.filter(t => t.artist);
    const uniqueArtists = new Set(artistsWithInfo.map(t => t.artist));

    const cloudFiles = allTracks.filter(t =>
      t.mediaSource === 'cloudinary' ||
      t.mediaSource === 'nexus' ||
      t.mediaSource === 'bunny' ||
      t.mediaSource === 'planethoster'
    );

    if (DEBUG_SIDEBAR_COUNTS) {
      const orphanedFavorites = favorites.filter(id => !availableTrackIds.has(id));
      const orphanedHistory = history.filter(h => !availableTrackIds.has(h.trackId));
      const orphanedPlaylistTracks = playlists.reduce((count, playlist) => {
        const trackIds = playlist.trackIds || [];
        return count + trackIds.filter(id => !availableTrackIds.has(id)).length;
      }, 0);
      const totalPlaylistTracks = playlists.reduce((count, playlist) => count + (playlist.trackIds?.length || 0), 0);

      console.info('[SidebarCounts]', {
        totals: {
          allTracks: allTracks.length,
          recent: validRecentTracks.length,
          albums: uniqueAlbums.size,
          artists: uniqueArtists.size,
          cloud: cloudFiles.length,
          playlists: playlists.length,
        },
        orphans: {
          favorites: orphanedFavorites.length,
          history: orphanedHistory.length,
          playlists: orphanedPlaylistTracks,
          playlistTotal: totalPlaylistTracks,
        },
      });
    }

    return {
      recent: validRecentTracks.length,
      albums: uniqueAlbums.size,
      artists: uniqueArtists.size,
      videos: 0, // Sera géré par VideosView avec son propre état
      cloud: cloudFiles.length,
      playlists: playlists.length,
    };
  }, [allTracks, recentTracks, playlists, favorites, history]);

  // Render the current view without memoization to keep lifecycle stable
  const renderViewContent = () => {
    // Inline player view
    if (showInlinePlayer && currentTrack) {
      return (
        <VisionProPlayer
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          currentTime={currentTime}
          isShuffle={isShuffle}
          repeatMode={repeatMode}
          volume={volume}
          isMuted={isMuted}
          youtubeDuration={youtubeDuration}
          audioElement={audioRef.current}
          isInline={true}
          onPlayPause={handlePlayPause}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onShuffle={handleShuffle}
          onRepeat={handleRepeat}
          onSeek={handleSeek}
          onVolumeChange={handleVolumeChange}
          onMuteToggle={() => setIsMuted(!isMuted)}
          onClose={handleShowPlayer}
          isFavorite={currentTrack ? isFavorite(currentTrack.id) : false}
          onToggleFavorite={handleToggleFavorite}
        />
      );
    }

    switch (currentView) {
      case "home":
        return (
        <HomeView
          loading={libraryLoading || scanning}
          tracks={allTracks}
          currentTrackIndex={currentTrackIndex}
          isPlaying={isPlaying}
          onTrackSelect={handleTrackSelect}
          onPlayTrack={handlePlayTrack}
          onPlayNext={handlePlayNext}
          onAddToQueue={handleAddToQueue}
          onAddToPlaylist={handleAddToPlaylist}
          onPlayTrackList={handlePlayTrackList}
          recentTracks={recentTracks}
          favoriteTracks={favoriteTracks}
          history={history}
          onFilterByArtist={(artistName: string) => {
            setSelectedArtist(artistName);
            setCurrentView("artist-detail");
          }}
          onNavigateToArtist={(artistName: string) => {
            setSelectedArtist(artistName);
            setCurrentView("artist-detail");
          }}
          onNavigateToAlbum={(albumName: string, artistName: string) => {
            const albumKey = `${albumName}-${artistName}`;
            setAlbumToOpen(albumKey);
            setCurrentView("albums");
          }}
          onFilterByGenre={(genreName) => {
            setSearchQuery(genreName);
            setCurrentView("search");
          }}
        />
        );
      case "search":
        return (
          <SearchView
            tracks={tracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
            onPlayTrack={handlePlayTrack}
            onPlayNext={handlePlayNext}
            onAddToQueue={handleAddToQueue}
            onAddToPlaylist={handleAddToPlaylist}
            loading={libraryLoading}
            initialQuery={searchQuery}
          />
        );
      case "library":
        return (
          <LibraryView
            tracks={allTracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
            onPlayTrack={handlePlayTrack}
            onPlayNext={handlePlayNext}
            onAddToQueue={handleAddToQueue}
            onAddToPlaylist={handleAddToPlaylist}
            loading={libraryLoading}
          />
        );
      case "favorites":
        return (
          <LibraryView
            tracks={favoriteTracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={(index) => {
              const track = favoriteTracks[index];
              const realIndex = tracks.findIndex(t => t.id === track.id);
              if (realIndex !== -1) handleTrackSelect(realIndex);
            }}
            onPlayTrack={handlePlayTrack}
            title={t("viewFavoritesTitle")}
            emptyMessage={t("favoritesEmptyMessage")}
            onPlayNext={handlePlayNext}
            onAddToQueue={handleAddToQueue}
            onAddToPlaylist={handleAddToPlaylist}
            loading={libraryLoading}
          />
        );
      case "playlists":
        return (
          <PlaylistView
            tracks={allTracks}
            playlists={playlists}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
            onPlayTrack={handlePlayTrack}
            onPlayTracks={handlePlayTracks}
            onShuffleTracks={handleShuffleTracks}
            onCreatePlaylist={createPlaylist}
            onUpdatePlaylist={updatePlaylist}
            onDeletePlaylist={deletePlaylist}
            onAddTracksToPlaylist={addTracksToPlaylist}
            onRemoveTracksFromPlaylist={removeTracksFromPlaylist}
            loading={libraryLoading}
            initialPlaylistId={playlistToOpen}
          />
        );
      case "recent": {
        // Get cover images for recent tracks
        const recentCovers = recentTracks.filter(t => t.coverUrl).slice(0, 4);
        const addedCovers = recentlyAddedTracks.filter(t => t.coverUrl).slice(0, 4);
        const normalizedRecentQuery = recentSearchQuery.trim().toLowerCase();
        const matchesRecentQuery = (track: Track) => {
          if (!normalizedRecentQuery) return true;
          return (
            track.title?.toLowerCase().includes(normalizedRecentQuery) ||
            track.artist?.toLowerCase().includes(normalizedRecentQuery) ||
            track.album?.toLowerCase().includes(normalizedRecentQuery)
          );
        };
        const visibleRecentTracks = recentTracks.filter(matchesRecentQuery);
        const visibleRecentlyAddedTracks = recentlyAddedTracks.filter(matchesRecentQuery);
        
        return (
          <div className="min-h-full pb-8 relative">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <motion.div
                animate={{ 
                  x: [0, 60, 0], 
                  y: [0, -40, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-20 -right-20 w-[500px] h-[500px] bg-blue-500/15 rounded-full blur-3xl"
              />
              <motion.div
                animate={{ 
                  x: [0, -50, 0], 
                  y: [0, 30, 0],
                  scale: [1, 0.9, 1]
                }}
                transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-60 -left-40 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-3xl"
              />
              <motion.div
                animate={{ 
                  x: [0, 40, 0], 
                  y: [0, -30, 0]
                }}
                transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
                className="absolute bottom-20 right-1/4 w-[300px] h-[300px] bg-violet-500/10 rounded-full blur-3xl"
              />
            </div>

            {/* Hero Section */}
            <div className="relative px-6 pt-8 pb-6">
              {/* Bento Grid Layout */}
              <div className="grid grid-cols-12 gap-4 mb-8">
                {/* Main Title Card */}
                <motion.div
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 100 }}
                  className="col-span-12 lg:col-span-8 relative rounded-3xl overflow-hidden border border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-background to-cyan-500/5 backdrop-blur-xl group min-h-[240px]"
                >
                  {/* Floating Album Covers */}
                  <div className="absolute inset-0 overflow-hidden">
                    {recentCovers.slice(0, 3).map((track, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ 
                          opacity: 0.15,
                          scale: 1,
                          x: [0, 10, 0],
                          y: [0, -10, 0]
                        }}
                        transition={{ 
                          delay: i * 0.2,
                          x: { duration: 10 + i * 2, repeat: Infinity, ease: "easeInOut" },
                          y: { duration: 8 + i * 2, repeat: Infinity, ease: "easeInOut" }
                        }}
                        className="absolute w-32 h-32 rounded-2xl overflow-hidden shadow-2xl"
                        style={{
                          top: `${20 + i * 25}%`,
                          right: `${10 + i * 15}%`,
                          transform: `rotate(${-10 + i * 8}deg)`
                        }}
                      >
                        <img src={track.coverUrl} alt="" className="w-full h-full object-cover" />
                      </motion.div>
                    ))}
                  </div>
                  
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-transparent" />
                  
                  {/* Content */}
                  <div className="relative p-8 h-full flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-4">
                      <motion.div
                        animate={{ rotate: [0, 360] }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center shadow-2xl shadow-blue-500/40"
                      >
                        <Clock className="w-8 h-8 text-white" />
                      </motion.div>
                      <div>
                        <div className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 inline-block">
                          <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">Historique</span>
                        </div>
                      </div>
                    </div>
                    
                    <h1 className="font-display text-5xl md:text-6xl font-bold mb-2 bg-gradient-to-r from-foreground via-foreground to-blue-300 bg-clip-text text-transparent">
                      Récemment
                    </h1>
                    <p className="text-muted-foreground text-lg mb-6">
                      Votre activité musicale récente
                    </p>
                    
                    {/* Action Button */}
                    {visibleRecentTracks.length > 0 && (
                      <Button 
                        onClick={() => {
                          const track = visibleRecentTracks[0];
                          const realIndex = tracks.findIndex(t => t.id === track.id);
                          if (realIndex !== -1) handleTrackSelect(realIndex);
                        }} 
                        size="lg" 
                        className="gap-3 px-8 h-14 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 shadow-xl shadow-blue-500/30 transition-all hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/40 w-fit"
                      >
                        <Play className="w-6 h-6 fill-current" />
                        <span className="font-semibold">Reprendre l'écoute</span>
                      </Button>
                    )}
                  </div>
                </motion.div>

                {/* Stats Cards */}
                <div className="col-span-12 lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-4">
                  <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    whileHover={{ scale: 1.03, x: -4 }}
                    className="p-6 rounded-3xl bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-transparent border border-blue-500/20 backdrop-blur-xl relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <Clock className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-3xl font-bold">{recentTracks.length}</p>
                        <p className="text-sm text-muted-foreground">{t("recentPlaysLabel")}</p>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    whileHover={{ scale: 1.03, x: -4 }}
                    className="p-6 rounded-3xl bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-transparent border border-emerald-500/20 backdrop-blur-xl relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                        <Music className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-3xl font-bold">{recentlyAddedTracks.length}</p>
                        <p className="text-sm text-muted-foreground">{t("recentAddsLabel")}</p>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="px-6">
              <div className="flex flex-wrap items-center gap-4 p-4 rounded-2xl bg-card/40 backdrop-blur-2xl border border-border/30 shadow-xl">
                <div className="flex-1 min-w-[250px] relative group">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 opacity-0 group-focus-within:opacity-100 blur transition-opacity" />
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-emerald-400 transition-colors" />
                    <Input
                      value={recentSearchQuery}
                      onChange={(e) => setRecentSearchQuery(e.target.value)}
                      placeholder={t("searchRecentPlaceholder")}
                      className="pl-12 h-12 bg-background/50 border-border/50 rounded-xl focus:border-emerald-500/50 focus:ring-emerald-500/20 transition-all"
                    />
                    {recentSearchQuery && (
                      <button
                        onClick={() => setRecentSearchQuery("")}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted/50 transition-colors"
                        title={t("clearSearch")}
                        aria-label={t("clearSearch")}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Content Sections */}
            <div className="px-6 space-y-8">
              {/* Recently Played Section */}
              {visibleRecentTracks.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-xl">{t("recentlyPlayedTitle")}</h2>
                      <p className="text-sm text-muted-foreground">{t("tracksCount", { count: visibleRecentTracks.length })}</p>
                    </div>
                  </div>
                  <div className="rounded-3xl bg-card/30 backdrop-blur-xl border border-border/30 overflow-hidden shadow-2xl">
                    <LibraryView
                      tracks={visibleRecentTracks}
                      currentTrackIndex={currentTrackIndex}
                      isPlaying={isPlaying}
                      onTrackSelect={(index) => {
                        // Play directly from recentTracks list
                        handlePlayTrackList(visibleRecentTracks, index);
                      }}
                      title=""
                      showFilters={false}
                      showHistory={true}
                      emptyMessage={t("emptyHistoryMessage")}
                      onPlayNext={handlePlayNext}
                      onAddToQueue={handleAddToQueue}
                      onAddToPlaylist={handleAddToPlaylist}
                      loading={libraryLoading}
                    />
                  </div>
                </motion.section>
              )}

              {/* Recently Added Section */}
              {visibleRecentlyAddedTracks.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 flex items-center justify-center">
                      <Music className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-xl">{t("recentlyAddedTitle")}</h2>
                      <p className="text-sm text-muted-foreground">{t("newTracksCount", { count: visibleRecentlyAddedTracks.length })}</p>
                    </div>
                  </div>
                  <div className="rounded-3xl bg-card/30 backdrop-blur-xl border border-border/30 overflow-hidden shadow-2xl">
                    <LibraryView
                      tracks={visibleRecentlyAddedTracks}
                      currentTrackIndex={currentTrackIndex}
                      isPlaying={isPlaying}
                      onTrackSelect={(index) => {
                        // Play directly from recentlyAddedTracks list
                        handlePlayTrackList(visibleRecentlyAddedTracks, index);
                      }}
                      title=""
                      showFilters={false}
                      emptyMessage={t("emptyRecentAddedMessage")}
                      onPlayNext={handlePlayNext}
                      onAddToQueue={handleAddToQueue}
                      onAddToPlaylist={handleAddToPlaylist}
                      loading={libraryLoading}
                    />
                  </div>
                </motion.section>
              )}

              {/* Empty state */}
              {visibleRecentTracks.length === 0 && visibleRecentlyAddedTracks.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-24 text-center"
                >
                  <div className="relative mb-6">
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 flex items-center justify-center">
                      <Clock className="w-12 h-12 text-blue-400/50" />
                    </div>
                    <motion.div
                      animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 rounded-3xl bg-blue-500/20 blur-xl"
                    />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{t("emptyHistoryTitle")}</h3>
                  <p className="text-muted-foreground max-w-sm">
                    {t("emptyHistoryDescription")}
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        );
      }
      case "albums":
        return (
          <LibraryView
            tracks={allTracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
            onPlayTrack={handlePlayTrack}
            title={t("viewAlbumsTitle")}
            viewMode="albums"
            initialSelectedAlbum={albumToOpen}
            onPlayNext={handlePlayNext}
            onAddToQueue={handleAddToQueue}
            onAddToPlaylist={handleAddToPlaylist}
            loading={libraryLoading}
          />
        );
      case "artists":
        return (
          <LibraryView
            tracks={allTracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
            onPlayTrack={handlePlayTrack}
            title={t("viewArtistsTitle")}
            viewMode="artists"
            onPlayNext={handlePlayNext}
            onAddToQueue={handleAddToQueue}
            onAddToPlaylist={handleAddToPlaylist}
            loading={libraryLoading}
            onNavigateToArtist={(artistName) => {
              setSelectedArtist(artistName);
              setCurrentView("artist-detail");
            }}
          />
        );
      case "artist-detail":
        return selectedArtist ? (
          <ArtistView
            artistName={selectedArtist}
            tracks={allTracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
            onPlayTrack={handlePlayTrack}
            onPlayNext={handlePlayNext}
            onAddToQueue={handleAddToQueue}
            onPlayTrackList={handlePlayTrackList}
            onAddToPlaylist={handleAddToPlaylist}
            onBack={() => {
              setSelectedArtist(null);
              setCurrentView("artists");
            }}
            onAlbumClick={(albumName, artistName) => {
              const albumKey = `${albumName}-${artistName}`;
              setAlbumToOpen(albumKey);
              setCurrentView("albums");
              setTimeout(() => setAlbumToOpen(null), 100);
            }}
            onArtistClick={(artistName) => {
              setSelectedArtist(artistName);
            }}
            onOpenPlaylist={handleOpenPlaylist}
          />
        ) : (
          <LibraryView
            tracks={allTracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
            onPlayTrack={handlePlayTrack}
            title="Artistes"
            viewMode="artists"
            onPlayNext={handlePlayNext}
            onAddToQueue={handleAddToQueue}
            onAddToPlaylist={handleAddToPlaylist}
            loading={libraryLoading}
            onNavigateToArtist={(artistName) => {
              setSelectedArtist(artistName);
              setCurrentView("artist-detail");
            }}
          />
        );
      case "videos":
        return <VideosView />;
      case "cloud":
        return (
          <Suspense fallback={<div className="px-6 py-4"><FileTableSkeleton count={5} /></div>}>
            <CloudView />
          </Suspense>
        );
      case "audio-senses":
        return (
          <Suspense fallback={
            <div className="p-6 space-y-6">
              <Skeleton className="h-8 w-48" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 rounded-xl" />
                ))}
              </div>
              <Skeleton className="h-64 rounded-xl" />
            </div>
          }>
            {audioRef.current && <AudioSensesView audioElement={audioRef.current} />}
          </Suspense>
        );
      case "settings":
        return (
          <Suspense fallback={<SettingsViewSkeleton />}>
            <SettingsView />
          </Suspense>
        );
      case "notifications":
        return (
          <Suspense fallback={
            <div className="px-6 py-4 space-y-4">
              <Skeleton className="h-8 w-48 mb-4" />
              <NotificationListSkeleton count={6} />
            </div>
          }>
            <NotificationsView />
          </Suspense>
        );
      default:
        return (
          <div className="p-6">
            <h1 className="font-display text-3xl font-bold text-foreground">
              {currentView.charAt(0).toUpperCase() + currentView.slice(1)}
            </h1>
            <p className="text-muted-foreground mt-2">
              Cette section sera bientôt disponible.
            </p>
          </div>
        );
    }
  };

  // Show loading screen
  if (isLoading) {
    return <LoadingScreen onLoadComplete={handleLoadComplete} />;
  }

  const viewKey = showInlinePlayer ? `player:${currentTrack?.id ?? "none"}` : currentView;
  const viewContent = renderViewContent();

  return (
    <CoachmarkProvider autoStart={true}>
      <TooltipProvider delayDuration={0}>
      <UpdateNotification />
      <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
        {/* Fullscreen Player - Vision Pro Style */}
        {isFullscreen && currentTrack && (
          <VisionProPlayer
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            isShuffle={isShuffle}
            repeatMode={repeatMode}
            volume={volume}
            isMuted={isMuted}
            audioElement={audioRef.current}
            youtubeDuration={youtubeDuration}
            showVideoMode={showVideoMode && Boolean(currentTrack.youtubeVideoId)}
            onPlayPause={handlePlayPause}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onShuffle={handleShuffle}
            onRepeat={handleRepeat}
            onSeek={handleSeek}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={() => setIsMuted(!isMuted)}
            onClose={() => {
              setIsFullscreen(false);
              setShowVideoMode(false); // Reset video mode when closing
            }}
            isFavorite={isFavorite(currentTrack.id)}
            onToggleFavorite={handleToggleFavorite}
            onToggleVideoMode={() => setShowVideoMode(!showVideoMode)}
          />
        )}

        {/* Title Bar */}
          <TitleBar 
            onOpenSettings={handleOpenSettings} 
            uploadProgress={isUploading ? overallProgress : undefined}
            hasNotifications={notifications.length > 0}
            onToggleNotifications={() => {
              setIsNotificationsOpen(!isNotificationsOpen);
              if (!isNotificationsOpen) {
                setIsLyricsOpen(false);
                setIsQueueOpen(false);
              }
            }}
            onSearch={(query) => {
              setSearchQuery(query);
            }}
            searchQuery={searchQuery}
            onQuickPlayTrack={handlePlayTrack}
            onOpenSearchPage={(q) => {
              setSearchQuery(q || "");
              setCurrentView("search");
            }}
            onOpenArtistView={(artistName) => {
              if (!artistName) return;
              setSelectedArtist(artistName);
              setCurrentView("artist-detail");
            }}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            onGoBack={goBack}
            onGoForward={goForward}
            onOpenAssistant={() => setIsAssistantOpen(true)}
          />

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden relative">
          <BackgroundEffects />

          {/* Sidebar */}
          <Sidebar 
            tracks={allTracks}
            playlists={playlists}
            currentView={currentView} 
            onViewChange={(view) => {
              // Use startTransition for non-urgent navigation updates
              startTransition(() => {
                setShowInlinePlayer(false);
                setCurrentView(view);
                // Clear album selection when changing views
                if (view !== "albums") setAlbumToOpen(null);
              });
            }}
            favoritesCount={favoriteTracks.length}
            notificationsCount={notifications.length}
            recentCount={sidebarCounts.recent}
            albumsCount={sidebarCounts.albums}
            artistsCount={sidebarCounts.artists}
            videosCount={sidebarCounts.videos}
            cloudCount={sidebarCounts.cloud}
            playlistsCount={sidebarCounts.playlists}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
            onPlayPlaylist={handlePlayPlaylist}
            onShufflePlaylist={handleShufflePlaylist}

          />

          {/* Content Area */}
          <div className="flex-1 flex overflow-hidden relative z-10">
            
            <div className={cn(
              "flex-1 min-h-0 min-w-0 transition-all duration-300 relative",
                    (isQueueOpen || isLyricsOpen || isNotificationsOpen || isArtistInfoOpen) && "mr-80", // isKaraokeOpen retiré
              showInlinePlayer && "flex items-center justify-center",
              currentView === "videos" && "overflow-hidden"
            )}>
              <Suspense fallback={null}>
                {showInlinePlayer ? (
                  <div key={viewKey} className="h-full w-full flex items-center justify-center animate-in fade-in duration-200">
                    {viewContent}
                  </div>
                ) : currentView === "videos" ? (
                  <div key={viewKey} className="h-full w-full relative">
                    {viewContent}
                  </div>
                ) : (
                  <ScrollArea className="h-full w-full min-h-0">
                    <div key={viewKey} className="animate-in fade-in duration-200 min-h-0 w-full">
                      {viewContent}
                    </div>
                  </ScrollArea>
                )}
              </Suspense>
            </div>

            {/* Queue Panel */}
            {isQueueOpen && (
              <div className="absolute right-0 top-0 bottom-0 z-20 animate-in slide-in-from-right duration-300">
                <QueuePanel
                  tracks={tracks}
                  currentTrackIndex={currentTrackIndex}
                  isPlaying={isPlaying}
                  onTrackSelect={handleTrackSelect}
                  onClose={() => setIsQueueOpen(false)}
                  similarTracks={similarTracks}
                  historyTracks={historyTracks}
                  onPlayTrack={handlePlayTrack}
                  currentTrack={currentTrack}
                  onRemoveFromQueue={handleRemoveFromQueue}
                  onClearQueue={handleClearQueue}
                />
              </div>
            )}

            {/* Lyrics Panel */}
            {isLyricsOpen && currentTrack && (
              <div className="absolute right-0 top-0 bottom-0 z-20 w-80 animate-in slide-in-from-right duration-300">
                <LyricsDisplay
                  currentTrack={currentTrack}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  className="h-full"
                />
              </div>
            )}

            {/* Notifications Panel */}
            {isNotificationsOpen && (
              <div className="absolute right-0 top-0 bottom-0 z-20 w-80 animate-in slide-in-from-right duration-300">
                <NotificationsPanel
                  className="h-full"
                  onClose={() => setIsNotificationsOpen(false)}
                />
              </div>
            )}

            {/* Artist Info Panel */}
            {isArtistInfoOpen && currentTrack && (
              <div className="absolute right-0 top-0 bottom-0 z-20 w-96 animate-in slide-in-from-right duration-300">
                <ArtistInfoPanel
                  isOpen={isArtistInfoOpen}
                  onClose={() => setIsArtistInfoOpen(false)}
                  currentTrack={currentTrack}
                  onNavigateToArtist={() => {
                    // Navigate to artist view in library
                    setCurrentView("library");
                    // Could set selected artist if needed
                  }}
                  onPlayTrack={handlePlayTrack}
                  onPlayTracks={handlePlayTracks}
                  onShuffleTracks={handleShuffleTracks}
                  onAddToQueue={(tracks) => addToQueue(tracks)}
                  onAddToPlaylist={(playlistId, track) => addTracksToPlaylist(playlistId, [track.id])}
                  playlists={playlists.map(p => ({ id: p.id, name: p.name }))}
                  onCreatePlaylist={(name, trackIds) => createPlaylist(name, trackIds)}
                />
              </div>
            )}

            {/* Karaoké Panel - DÉSACTIVÉ */}
            {/* {isKaraokeOpen && (
              <div className="absolute right-0 top-0 bottom-0 z-20 w-80 animate-in slide-in-from-right duration-300">
                <KaraokePanel
                  isOpen={isKaraokeOpen}
                  onClose={() => setIsKaraokeOpen(false)}
                  currentTrack={currentTrack}
                  audioElement={audioRef.current}
                />
              </div>
            )} */}

            {/* AI Assistant Panel */}
            {isAssistantOpen && (
              <div className="absolute right-0 top-0 bottom-0 z-20 animate-in slide-in-from-right duration-300">
                <AssistantPanel
                  onClose={() => setIsAssistantOpen(false)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Now Playing Bar */}
        {currentTrack && !isVideoPlaying && currentView !== "videos" && (
          <NowPlayingBar
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            isShuffle={isShuffle}
            repeatMode={repeatMode}
            volume={volume}
            isMuted={isMuted}
            isFavorite={isFavorite(currentTrack.id)}
            onPlayPause={handlePlayPause}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onShuffle={handleShuffle}
            onRepeat={handleRepeat}
            onSeek={handleSeek}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={() => setIsMuted(!isMuted)}
            youtubeDuration={(currentTrack?.mediaSource as string) === 'youtube' ? youtubeDuration : undefined}
            onToggleQueue={() => {
              setIsQueueOpen(!isQueueOpen);
              if (!isQueueOpen) {
                setIsLyricsOpen(false);
                setIsNotificationsOpen(false);
              }
            }}
            onFullscreen={() => setIsFullscreen(true)}
            onToggleFavorite={handleToggleFavorite}
            onShowPlayer={handleShowPlayer}
            onShowLyrics={() => {
              setIsLyricsOpen(!isLyricsOpen);
              if (!isLyricsOpen) {
                setIsQueueOpen(false);
                setIsNotificationsOpen(false);
                setIsArtistInfoOpen(false);
              }
            }}
            onShowArtistInfo={() => {
              setIsArtistInfoOpen(!isArtistInfoOpen);
              if (!isArtistInfoOpen) {
                setIsQueueOpen(false);
                setIsLyricsOpen(false);
                setIsNotificationsOpen(false);
                // setIsKaraokeOpen(false); // DÉSACTIVÉ
              }
            }}
            onNavigateToAlbum={handleNavigateToAlbum}
            onNavigateToArtist={handleNavigateToArtist}
            isQueueOpen={isQueueOpen}
            audioAnalysis={audioAnalysis}
            onStartAIAnalysis={startAIAnalysis}
            isAudioAIPro={isAudioAIPro}
            // onShowKaraoke - DÉSACTIVÉ - Système karaoke désactivé
            // onShowKaraoke={() => {
            //   setIsKaraokeOpen(!isKaraokeOpen);
            //   if (!isKaraokeOpen) {
            //     setIsQueueOpen(false);
            //     setIsLyricsOpen(false);
            //     setIsNotificationsOpen(false);
            //     setIsArtistInfoOpen(false);
            //   }
            // }}
          />
        )}

        {/* Scan progress indicator */}
        {scanning && scanProgress && (
          <div className="fixed bottom-20 right-4 glass rounded-lg p-4 z-[10000] max-w-xs animate-in slide-in-from-right duration-300">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <div>
                <p className="text-sm font-medium">Scan en cours...</p>
                <p className="text-xs text-muted-foreground">
                  {scanProgress.current}/{scanProgress.total} fichiers
                </p>
              </div>
            </div>
          </div>
        )}

        {/* YouTube Player persistant en arrière-plan (pour tracks YouTube) */}
        {/* En mode fullscreen + vidéo, on le rend visible pour afficher la vidéo avec audio synchronisé */}
        {currentTrack && (currentTrack.mediaSource as string) === 'youtube' && currentTrack.youtubeVideoId && (
          <div 
            className={cn(
              "fixed inset-0",
              // Show video only when fullscreen AND video mode is enabled
              isFullscreen && showVideoMode
                ? "z-[9998] pointer-events-auto opacity-100 w-full h-full"
                : "pointer-events-none z-[-1] opacity-0 w-px h-px overflow-hidden"
            )}
          >
            <YouTubePlayer
              key={currentTrack?.id || 'yt-player'}
              ref={youtubePlayerRef}
              videoId={currentTrack?.youtubeVideoId || ''}
              autoPlay={isPlaying}
              audioOnly={!(isFullscreen && showVideoMode)} // Video visible only in fullscreen + video mode
              onEnded={() => {
                console.log('[DesktopApp] YouTube video ended, moving to next track');
                // Record playback before moving to next
                if (currentTrack && playbackStartTrackIdRef.current === currentTrack.id) {
                  const elapsedTime = accumulatedPlaybackTimeRef.current;
                  const completedPercentage = currentTrack.duration > 0
                    ? Math.min(100, (elapsedTime / currentTrack.duration) * 100)
                    : 100;
                  recordPlaybackRef.current(currentTrack.id, elapsedTime, completedPercentage, currentTrack.youtubeVideoId);
                  playbackStartTimeRef.current = null;
                  playbackStartTrackIdRef.current = null;
                  accumulatedPlaybackTimeRef.current = 0;
                }
                // Move to next track
                handleNext();
              }}
              onStateChange={(playing) => {
                if (playing !== isPlaying) {
                  setIsPlaying(playing);
                }
                
                // Quand la vidéo YouTube commence à jouer, s'assurer qu'elle est dans l'historique
                if (playing && currentTrack && (currentTrack.mediaSource as string) === 'youtube' && currentTrack.id) {
                  // Toujours ajouter à l'historique (addToHistory gère les doublons)
                  addToHistory(currentTrack.id, currentTrack.youtubeVideoId);
                  
                  // Émettre l'événement pour VideosView
                  window.dispatchEvent(new CustomEvent('youtube-video-played', { 
                    detail: { 
                      videoId: currentTrack.youtubeVideoId || '',
                      trackId: currentTrack.id,
                      title: currentTrack.title,
                    } 
                  }));
                }
              }}
              onTimeUpdate={(time) => {
                // Mettre à jour currentTime directement pour une progression fluide
                // L'arrondi sera fait dans NowPlayingBar pour l'affichage seulement
                setCurrentTime(time);
                // Mettre à jour aussi la durée si elle est disponible
                if (youtubePlayerRef.current && youtubePlayerRef.current.duration > 0) {
                  setYoutubeDuration(youtubePlayerRef.current.duration);
                }
                
                // Suivre le temps d'écoute pour YouTube (comme pour les tracks locaux)
                if (isPlaying && currentTrack && (currentTrack.mediaSource as string) === 'youtube' && 
                    playbackStartTrackIdRef.current === currentTrack.id && 
                    playbackStartTimeRef.current !== null) {
                  const realTimeNow = Date.now();
                  const delta = (realTimeNow - lastTimeUpdateRef.current) / 1000; // en secondes
                  accumulatedPlaybackTimeRef.current += delta;
                  lastTimeUpdateRef.current = realTimeNow;
                }
              }}
              onReady={() => {
                if (youtubePlayerRef.current) {
                  const player = youtubePlayerRef.current;
                  // Initialiser currentTime avec la valeur actuelle du player (si disponible)
                  // Sinon, onTimeUpdate le mettra à jour automatiquement
                  if (player.currentTime > 0) {
                    setCurrentTime(player.currentTime);
                  }
                  // Initialiser la durée du player YouTube
                  if (player.duration > 0) {
                    setYoutubeDuration(player.duration);
                  } else {
                    // Essayer de récupérer la durée après un court délai (elle peut ne pas être disponible immédiatement)
                    setTimeout(() => {
                      if (youtubePlayerRef.current && youtubePlayerRef.current.duration > 0) {
                        setYoutubeDuration(youtubePlayerRef.current.duration);
                      }
                    }, 1000);
                  }
                  // Synchroniser le volume
                  if (Math.abs(player.volume - volume) > 1) {
                    player.setVolume(volume);
                  }
                  if (player.isMuted !== isMuted) {
                    if (isMuted && !player.isMuted) {
                      player.toggleMute();
                    } else if (!isMuted && player.isMuted) {
                      player.toggleMute();
                    }
                  }
                  // Démarrer si nécessaire
                  if (isPlaying && !player.isPlaying) {
                    setTimeout(() => {
                      if (youtubePlayerRef.current && typeof youtubePlayerRef.current.play === 'function') {
                        try {
                          youtubePlayerRef.current.play();
                        } catch (err) {
                          console.error('[DesktopApp] Erreur play YouTube:', err);
                        }
                      }
                    }, 300);
                  }
                }
              }}
            />
          </div>
        )}

        {/* Play/Queue Choice Dialog for File Selection */}
        <PlayQueueChoiceDialog
          open={isPlayQueueDialogOpen}
          onOpenChange={setIsPlayQueueDialogOpen}
          onPlayNow={handleProcessAndPlayFilesNow}
          onAddToQueue={handleAddFilesToQueue}
          fileCount={pendingFilesToProcess.length}
          isProcessing={isProcessingFiles}
        />
      </div>
    </TooltipProvider>
    </CoachmarkProvider>
  );
};

