import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { TitleBar } from "./TitleBar";
import { Sidebar, ViewType } from "./Sidebar";
import { NowPlayingBar } from "./NowPlayingBar";
import { QueuePanel } from "./QueuePanel";
import { FullscreenPlayer } from "./FullscreenPlayer";
import { LoadingScreen } from "./LoadingScreen";
import { LyricsDisplay } from "./LyricsDisplay";
import { NotificationsPanel } from "./NotificationsPanel";
import { ArtistInfoPanel } from "./ArtistInfoPanel";
import { UpdateNotification } from "./UpdateNotification";
import { lazy, Suspense } from "react";
import { HomeView } from "./views/HomeView";
import { SearchView } from "./views/SearchView";
import { LibraryView } from "./views/LibraryView";
import { PlaylistView } from "./views/PlaylistView";
import { SettingsView } from "./views/SettingsView";
import { NotificationsView } from "./views/NotificationsView";
import { ArtistView } from "./views/ArtistView";

// Lazy load heavy components
const VideosView = lazy(() => import("./views/VideosView").then(m => ({ default: m.VideosView })));
const DownloadsView = lazy(() => import("./views/DownloadsView").then(m => ({ default: m.DownloadsView })));
const CloudView = lazy(() => import("./views/CloudView").then(m => ({ default: m.CloudView })));
const AudioSensesView = lazy(() => import("./views/AudioSensesView").then(m => ({ default: m.AudioSensesView })));
import { BackgroundEffects } from "./BackgroundEffects";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Clock, Music, Play } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useLibrary } from "@/hooks/useLibrary";
import { useFavorites } from "@/hooks/useFavorites";
import { usePlayHistory } from "@/hooks/usePlayHistory";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useQueue } from "@/hooks/useQueue";
import { useCloudSync } from "@/hooks/useCloudSync";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";
import { useNotifications } from "@/hooks/useNotifications";
import { useTheme } from "@/hooks/useTheme";
import { getAudioSrc } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Track } from "@/types/music";
import { VibrantUI, BassPulse } from "@/components/VibrantUI";
import { useAudioVibes } from "@/hooks/useAudioVibes";
import { YouTubePlayer, type YouTubePlayerRef } from "@/components/YouTubePlayer";
import { extractYouTubeVideoId } from "@/lib/youtube";

export const DesktopApp = () => {
  // Initialize theme hook to ensure theme is loaded and applied on mount
  useTheme();
  const { tracks: libraryTracks, loading: libraryLoading, scanning, scanProgress } = useLibrary();
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
  const [currentView, setCurrentView] = useState<ViewType>("home");
  const [previousView, setPreviousView] = useState<ViewType>("home");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isShuffle, setIsShuffle] = useState(queueIsShuffled);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  // Load volume from localStorage on mount
  const [volume, setVolume] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('nexus-volume');
      return saved ? parseInt(saved, 10) : 70;
    }
    return 70;
  });
  const [isMuted, setIsMuted] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isArtistInfoOpen, setIsArtistInfoOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInlinePlayer, setShowInlinePlayer] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [albumToOpen, setAlbumToOpen] = useState<string | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Audio element ref for real playback
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // YouTube Player ref pour lecture persistante en arrière-plan
  const youtubePlayerRef = useRef<YouTubePlayerRef | null>(null);
  
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
        recordPlaybackRef.current(previousTrackId, elapsedTime, completedPercentage);
      }
      
      // Réinitialiser pour la nouvelle piste
      playbackStartTimeRef.current = null;
      playbackStartTrackIdRef.current = null;
      accumulatedPlaybackTimeRef.current = 0;
    }

    // Démarrer le suivi pour la nouvelle piste
    if (currentTrack) {
      // Si c'est une nouvelle piste (différente de la précédente)
      if (playbackStartTrackIdRef.current !== currentTrack.id) {
        addToHistoryRef.current(currentTrack.id);
        playbackStartTrackIdRef.current = currentTrack.id;
        // Réinitialiser le temps accumulé seulement pour une nouvelle piste
        accumulatedPlaybackTimeRef.current = 0;
        lastTimeUpdateRef.current = Date.now();
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
          recordPlaybackRef.current(currentTrack.id, elapsedTime, completedPercentage);
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
      
      console.log('[DesktopApp] handlePlayPause YouTube:', {
        playerIsPlaying: player.isPlaying,
        stateIsPlaying: isPlaying,
        hasPlayer: !!player,
        hasPause: typeof player.pause === 'function',
        hasPlay: typeof player.play === 'function',
      });
      
      // Utiliser l'état local comme source de vérité (plus fiable que player.isPlaying)
      // Le callback onStateChange synchronisera l'état après l'action
      if (isPlaying) {
        try {
          console.log('[DesktopApp] Appel de pause() sur le player YouTube');
          player.pause();
          // Mettre à jour l'état immédiatement (optimistic update)
          // Le callback onStateChange confirmera la mise à jour
          setIsPlaying(false);
        } catch (err) {
          console.error('[DesktopApp] Erreur lors de la pause YouTube:', err);
        }
      } else {
        try {
          console.log('[DesktopApp] Appel de play() sur le player YouTube');
          player.play();
          // Mettre à jour l'état immédiatement (optimistic update)
          setIsPlaying(true);
        } catch (err) {
          console.error('[DesktopApp] Erreur lors de la lecture YouTube:', err);
        }
      }
    } else {
      // Pour les tracks locaux, basculer l'état
      setIsPlaying(prev => !prev);
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
        recordPlaybackRef.current(playbackStartTrackIdRef.current, elapsedTime, completedPercentage);
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
        recordPlaybackRef.current(playbackStartTrackIdRef.current, elapsedTime, completedPercentage);
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
        
        recordPlaybackRef.current(currentTrack.id, elapsedTime, completedPercentage);
        
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
    setVolume(value[0]);
    setIsMuted(prev => prev && value[0] > 0 ? false : prev);
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
  const handlePlayPlaylist = useCallback((playlistId: string) => {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) {
      const errorMsg = 'Playlist introuvable';
      toast.error(errorMsg);
      notifyError(errorMsg);
      return;
    }

    // Get tracks from playlist trackIds
    const playlistTracks = playlist.trackIds
      .map(id => libraryTracks.find(t => t.id === id))
      .filter((t): t is Track => t !== undefined);

    if (playlistTracks.length === 0) {
      const errorMsg = 'La playlist est vide';
      toast.error(errorMsg);
      notifyError(errorMsg);
      return;
    }

    // Set queue and start playing
    setQueue(playlistTracks);
    setCurrentIndex(0);
    setIsPlaying(true);
    const message = `Lecture de "${playlist.name}"`;
    toast.success(message);
    notifySuccess(message);
  }, [playlists, libraryTracks, setQueue, setCurrentIndex, notifySuccess, notifyError]);

  const handleShufflePlaylist = useCallback((playlistId: string) => {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) {
      const errorMsg = 'Playlist introuvable';
      toast.error(errorMsg);
      notifyError(errorMsg);
      return;
    }

    // Get tracks from playlist trackIds
    const playlistTracks = playlist.trackIds
      .map(id => libraryTracks.find(t => t.id === id))
      .filter((t): t is Track => t !== undefined);

    if (playlistTracks.length === 0) {
      const errorMsg = 'La playlist est vide';
      toast.error(errorMsg);
      notifyError(errorMsg);
      return;
    }

    // Shuffle tracks
    const shuffled = [...playlistTracks].sort(() => Math.random() - 0.5);

    // Set queue and start playing
    setQueue(shuffled);
    setCurrentIndex(0);
    setIsPlaying(true);
    setIsShuffle(true);
    const message = `Lecture aléatoire de "${playlist.name}"`;
    toast.success(message);
    notifySuccess(message);
  }, [playlists, libraryTracks, setQueue, setCurrentIndex, setIsShuffle, notifySuccess, notifyError]);

  // Handler pour supprimer un track de la file par son ID
  const handleRemoveFromQueue = useCallback((trackId: string) => {
    const index = tracks.findIndex(t => t.id === trackId);
    if (index !== -1 && index > currentTrackIndex) {
      removeFromQueue(index);
      toast.success('Retiré de la file d\'attente');
    }
  }, [tracks, currentTrackIndex, removeFromQueue]);

  // Handlers for PlaylistView - play/shuffle tracks by IDs
  const handlePlayTracks = useCallback((trackIds: string[]) => {
    const tracksToPlay = trackIds
      .map(id => libraryTracks.find(t => t.id === id))
      .filter((t): t is Track => t !== undefined);

    if (tracksToPlay.length === 0) {
      const errorMsg = 'Aucun titre trouvé';
      toast.error(errorMsg);
      notifyError(errorMsg);
      return;
    }

    // Remplacer la file sans passer par un clear intermédiaire
    setQueue(tracksToPlay);
    setCurrentIndex(0);
    setIsPlaying(true);
    const message = `Lecture de ${tracksToPlay.length} titre${tracksToPlay.length > 1 ? 's' : ''}`;
    toast.success(message);
    notifySuccess(message);
  }, [libraryTracks, clearQueue, setQueue, setCurrentIndex, setIsPlaying, notifySuccess, notifyError]);

  // Lecture d'une liste de tracks (remplace entièrement la file)
  const handlePlayTrackList = useCallback((trackList: Track[], startIndex: number = 0) => {
    const validTracks = trackList.filter(Boolean);
    if (validTracks.length === 0) {
      toast.error('Aucun titre trouvé');
      notifyError('Aucun titre trouvé');
      return;
    }

    const clampedIndex = Math.max(0, Math.min(startIndex, validTracks.length - 1));
    // Remplacer la file sans effacer d'autres caches
    setQueue(validTracks);
    setCurrentIndex(clampedIndex);
    setIsPlaying(true);
    setIsShuffle(false);
    const message = `Lecture de ${validTracks.length} titre${validTracks.length > 1 ? 's' : ''}`;
    toast.success(message);
    notifySuccess(message);
  }, [setQueue, setCurrentIndex, setIsPlaying, setIsShuffle, notifyError, notifySuccess]);

  // Action manuelle pour vider la file
  const handleClearQueue = useCallback(() => {
    clearQueue();
    toast.success('File vidée');
  }, [clearQueue]);

  const handleShuffleTracks = useCallback((trackIds: string[]) => {
    const tracksToPlay = trackIds
      .map(id => libraryTracks.find(t => t.id === id))
      .filter((t): t is Track => t !== undefined);

    if (tracksToPlay.length === 0) {
      const errorMsg = 'Aucun titre trouvé';
      toast.error(errorMsg);
      notifyError(errorMsg);
      return;
    }

    // Shuffle tracks
    const shuffled = [...tracksToPlay].sort(() => Math.random() - 0.5);

    setQueue(shuffled);
    setCurrentIndex(0);
    setIsPlaying(true);
    setIsShuffle(true);
    const message = `Lecture aléatoire de ${shuffled.length} titre${shuffled.length > 1 ? 's' : ''}`;
    toast.success(message);
    notifySuccess(message);
  }, [libraryTracks, setQueue, setCurrentIndex, setIsPlaying, setIsShuffle, notifySuccess, notifyError]);

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
      setCurrentView(previousView);
    } else {
      setPreviousView(currentView);
      setShowInlinePlayer(true);
      setCurrentView("player");
    }
  }, [showInlinePlayer, currentView, previousView]);

  // Écouter les événements pour jouer des vidéos YouTube comme audio
  useEffect(() => {
    const handleYouTubeAudioPlay = async (event: CustomEvent<Track>) => {
      const track = event.detail;
      
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
        setPreviousView(currentView);
        setShowInlinePlayer(true);
        setCurrentView("player");
      }
      
      toast.success(`Lecture de "${track.title}" en mode audio`);
    };

    window.addEventListener('youtube-audio-play', handleYouTubeAudioPlay as unknown as EventListener);
    
    return () => {
      window.removeEventListener('youtube-audio-play', handleYouTubeAudioPlay as unknown as EventListener);
    };
  }, [tracks, queue.tracks.length, addToQueueNext, setCurrentIndex, handleTrackSelect, showInlinePlayer, currentView, previousView]);

  // Écouter les événements pour ajouter les vidéos YouTube à l'historique audio
  useEffect(() => {
    const handleYouTubeVideoPlayed = (event: CustomEvent<{ videoId: string; trackId: string; title: string }>) => {
      const { trackId } = event.detail;
      
      // Ajouter à l'historique audio si le track est dans la queue
      const track = tracks.find(t => t.id === trackId);
      if (track) {
        console.log('[DesktopApp] Ajout de la vidéo YouTube à l\'historique audio:', track.title);
        addToHistory(trackId);
      } else {
        // Si le track n'est pas encore dans la queue, l'ajouter à l'historique quand même
        // Il sera synchronisé quand le track sera ajouté à la queue
        console.log('[DesktopApp] Track YouTube non trouvé dans la queue, ajout direct à l\'historique:', trackId);
        addToHistory(trackId);
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
    toast.success(`Ouverture de l'album "${currentTrack.album}"`);
  }, [currentTrack]);

  const handleNavigateToArtist = useCallback(() => {
    if (!currentTrack) return;
    setShowInlinePlayer(false);
    setSelectedArtist(currentTrack.artist);
    setCurrentView("artist-detail");
    toast.success(`Ouverture de la page artiste "${currentTrack.artist}"`);
  }, [currentTrack]);

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
  const favoriteTracks = useMemo(() => {
    return getUniqueTracks(tracks.filter(track => isFavorite(track.id)));
  }, [tracks, isFavorite, getUniqueTracks]);

  // Get recently played tracks from history (for QueuePanel) - without duplicates
  // Inclut les tracks de la queue (qui peuvent contenir des tracks YouTube)
  const historyTracks = useMemo(() => {
    const mapped = history
      .map(h => {
        // Chercher d'abord dans la queue (qui contient tous les tracks actifs, y compris YouTube)
        const trackInQueue = tracks.find(t => t.id === h.trackId);
        if (trackInQueue) return trackInQueue;
        
        // Sinon chercher dans la bibliothèque locale
        return libraryTracks.find(t => t.id === h.trackId);
      })
      .filter((t): t is Track => t !== undefined);
    return getUniqueTracks(mapped).slice(0, 50);
  }, [history, tracks, libraryTracks, getUniqueTracks]);

  // Get recently played tracks from history (for HomeView) - without duplicates
  const recentTracks = useMemo(() => {
    const mapped = history
      .map(h => tracks.find(t => t.id === h.trackId))
      .filter((t): t is Track => t !== undefined);
    return getUniqueTracks(mapped).slice(0, 20);
  }, [history, tracks, getUniqueTracks]);

  // Get recently added tracks (sorted by addedAt date) - without duplicates
  const recentlyAddedTracks = useMemo(() => {
    const filtered = libraryTracks.filter(t => t.addedAt);
    const unique = getUniqueTracks(filtered);
    return unique
      .sort((a, b) => {
        const dateA = a.addedAt ? new Date(a.addedAt).getTime() : 0;
        const dateB = b.addedAt ? new Date(b.addedAt).getTime() : 0;
        return dateB - dateA; // Most recent first
      })
      .slice(0, 50);
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
    return shuffled.slice(0, 20);
  }, [currentTrack?.id, currentTrack?.artist, currentTrack?.genre, currentTrack?.mediaSource, libraryTracks, getUniqueTracks]);

  // Calculer la vue actuelle avec useMemo pour éviter les problèmes de hooks
  const currentViewContent = useMemo(() => {
    // Inline player view
    if (showInlinePlayer && currentTrack) {
      return (
        <FullscreenPlayer
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          currentTime={currentTime}
          isShuffle={isShuffle}
          repeatMode={repeatMode}
          volume={volume}
          isMuted={isMuted}
          youtubeDuration={youtubeDuration}
          onPlayPause={handlePlayPause}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onShuffle={handleShuffle}
          onRepeat={handleRepeat}
          onSeek={handleSeek}
          onVolumeChange={handleVolumeChange}
          onMuteToggle={() => setIsMuted(!isMuted)}
          onClose={handleShowPlayer}
          isInline={true}
          isFavorite={currentTrack ? isFavorite(currentTrack.id) : false}
          onToggleFavorite={handleToggleFavorite}
        />
      );
    }

    switch (currentView) {
      case "home":
        return (
        <HomeView
          loading={libraryLoading}
          tracks={tracks}
          currentTrackIndex={currentTrackIndex}
          isPlaying={isPlaying}
          onTrackSelect={handleTrackSelect}
          onPlayNext={handlePlayNext}
          onAddToQueue={handleAddToQueue}
          onAddToPlaylist={handleAddToPlaylist}
          onPlayTrackList={handlePlayTrackList}
          recentTracks={recentTracks}
          favoriteTracks={favoriteTracks}
          history={history}
          onFilterByArtist={(artistName) => {
            setSelectedArtist(artistName);
            setCurrentView("artist-detail");
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
          />
        );
      case "library":
        return (
          <LibraryView
            tracks={tracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
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
            title="Favoris"
            emptyMessage="Aucun favori. Cliquez sur ❤️ pour ajouter des titres."
            onPlayNext={handlePlayNext}
            onAddToQueue={handleAddToQueue}
            onAddToPlaylist={handleAddToPlaylist}
            loading={libraryLoading}
          />
        );
      case "playlists":
        return (
          <PlaylistView
            tracks={libraryTracks}
            playlists={playlists}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
            onPlayTracks={handlePlayTracks}
            onShuffleTracks={handleShuffleTracks}
            onCreatePlaylist={createPlaylist}
            onUpdatePlaylist={updatePlaylist}
            onDeletePlaylist={deletePlaylist}
            onAddTracksToPlaylist={addTracksToPlaylist}
            onRemoveTracksFromPlaylist={removeTracksFromPlaylist}
            loading={libraryLoading}
          />
        );
      case "recent":
        // Get cover images for recent tracks
        const recentCovers = recentTracks.filter(t => t.coverUrl).slice(0, 4);
        const addedCovers = recentlyAddedTracks.filter(t => t.coverUrl).slice(0, 4);
        
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
                    {recentTracks.length > 0 && (
                      <Button 
                        onClick={() => {
                          const track = recentTracks[0];
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
                        <p className="text-sm text-muted-foreground">Écoutes récentes</p>
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
                        <p className="text-sm text-muted-foreground">Ajouts récents</p>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Content Sections */}
            <div className="px-6 space-y-8">
              {/* Recently Played Section */}
              {recentTracks.length > 0 && (
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
                      <h2 className="font-semibold text-xl">Écouté récemment</h2>
                      <p className="text-sm text-muted-foreground">{recentTracks.length} pistes</p>
                    </div>
                  </div>
                  <div className="rounded-3xl bg-card/30 backdrop-blur-xl border border-border/30 overflow-hidden shadow-2xl">
                    <LibraryView
                      tracks={recentTracks}
                      currentTrackIndex={currentTrackIndex}
                      isPlaying={isPlaying}
                      onTrackSelect={(index) => {
                        const track = recentTracks[index];
                        const realIndex = tracks.findIndex(t => t.id === track.id);
                        if (realIndex !== -1) handleTrackSelect(realIndex);
                      }}
                      title=""
                      showFilters={false}
                      showHistory={true}
                      emptyMessage="Aucun historique d'écoute."
                      onPlayNext={handlePlayNext}
                      onAddToQueue={handleAddToQueue}
                      onAddToPlaylist={handleAddToPlaylist}
                      loading={libraryLoading}
                    />
                  </div>
                </motion.section>
              )}

              {/* Recently Added Section */}
              {recentlyAddedTracks.length > 0 && (
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
                      <h2 className="font-semibold text-xl">Récemment ajoutées</h2>
                      <p className="text-sm text-muted-foreground">{recentlyAddedTracks.length} nouvelles pistes</p>
                    </div>
                  </div>
                  <div className="rounded-3xl bg-card/30 backdrop-blur-xl border border-border/30 overflow-hidden shadow-2xl">
                    <LibraryView
                      tracks={recentlyAddedTracks}
                      currentTrackIndex={currentTrackIndex}
                      isPlaying={isPlaying}
                      onTrackSelect={(index) => {
                        const track = recentlyAddedTracks[index];
                        const realIndex = tracks.findIndex(t => t.id === track.id);
                        if (realIndex !== -1) handleTrackSelect(realIndex);
                      }}
                      title=""
                      showFilters={false}
                      emptyMessage="Aucune musique récemment ajoutée."
                      onPlayNext={handlePlayNext}
                      onAddToQueue={handleAddToQueue}
                      onAddToPlaylist={handleAddToPlaylist}
                      loading={libraryLoading}
                    />
                  </div>
                </motion.section>
              )}

              {/* Empty state */}
              {recentTracks.length === 0 && recentlyAddedTracks.length === 0 && (
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
                  <h3 className="text-xl font-semibold mb-2">Aucun historique</h3>
                  <p className="text-muted-foreground max-w-sm">
                    Vos pistes récemment écoutées et ajoutées apparaîtront ici
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        );
      case "albums":
        return (
          <LibraryView
            tracks={tracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
            title="Albums"
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
            tracks={tracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
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
      case "artist-detail":
        return selectedArtist ? (
          <ArtistView
            artistName={selectedArtist}
            tracks={tracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
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
          />
        ) : (
          <LibraryView
            tracks={tracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
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
      case "local":
        return (
          <LibraryView
            tracks={tracks.filter(t => t.filePath)}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={(index) => {
              const localTracks = tracks.filter(t => t.filePath);
              const track = localTracks[index];
              const realIndex = tracks.findIndex(t => t.id === track.id);
              if (realIndex !== -1) handleTrackSelect(realIndex);
            }}
            title="Fichiers Locaux"
            viewMode="folders"
            onPlayNext={handlePlayNext}
            onAddToQueue={handleAddToQueue}
            onAddToPlaylist={handleAddToPlaylist}
          />
        );
      case "downloads":
        return (
          <Suspense fallback={<div className="p-6">Chargement des téléchargements...</div>}>
            <DownloadsView />
          </Suspense>
        );
      case "cloud":
        return (
          <Suspense fallback={<div className="p-6">Chargement du cloud...</div>}>
            <CloudView />
          </Suspense>
        );
      case "audio-senses":
        return (
          <Suspense fallback={<div className="p-6">Chargement des sens audio...</div>}>
            {audioRef.current && <AudioSensesView audioElement={audioRef.current} />}
          </Suspense>
        );
      case "settings":
        return <SettingsView />;
      case "notifications":
        return <NotificationsView />;
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
  }, [
    showInlinePlayer,
    currentTrack,
    isPlaying,
    currentTime,
    isShuffle,
    repeatMode,
    volume,
    isMuted,
    youtubeDuration,
    currentView,
    tracks,
    currentTrackIndex,
    libraryLoading,
    recentTracks,
    favoriteTracks,
    history,
    playlists,
    recentlyAddedTracks,
    albumToOpen,
    selectedArtist,
    audioRef.current,
    isFavorite,
    handleToggleFavorite,
    handlePlayPause,
    handlePrevious,
    handleNext,
    handleShuffle,
    handleRepeat,
    handleSeek,
    handleVolumeChange,
    handleShowPlayer,
    handleTrackSelect,
    handlePlayNext,
    handleAddToQueue,
    handleAddToPlaylist,
    handlePlayTrackList,
    handlePlayTracks,
    handleShuffleTracks,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    addTracksToPlaylist,
    removeTracksFromPlaylist,
    handlePlayTrack,
    setSelectedArtist,
    setCurrentView,
    setAlbumToOpen,
  ]);

  // Show loading screen
  if (isLoading) {
    return <LoadingScreen onLoadComplete={handleLoadComplete} />;
  }

  // Show message if no tracks
  const noTracksMessage = tracks.length === 0 && !libraryLoading && !showInlinePlayer && currentView !== "settings" && (
    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
      <div className="glass rounded-xl p-8 text-center max-w-md pointer-events-auto animate-in fade-in zoom-in duration-300">
        <h2 className="font-display text-xl mb-3">Bibliothèque vide</h2>
        <p className="text-muted-foreground mb-4">
          Ajoutez des dossiers de musique dans les Paramètres pour commencer à écouter.
        </p>
        <button 
          onClick={handleOpenSettings}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          Ouvrir les Paramètres
        </button>
      </div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={0}>
      <UpdateNotification />
      <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
        {/* Fullscreen Player */}
        {isFullscreen && currentTrack && (
          <FullscreenPlayer
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            isShuffle={isShuffle}
            repeatMode={repeatMode}
            volume={volume}
            isMuted={isMuted}
            audioElement={audioRef.current}
            youtubeDuration={youtubeDuration}
            onPlayPause={handlePlayPause}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onShuffle={handleShuffle}
            onRepeat={handleRepeat}
            onSeek={handleSeek}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={() => setIsMuted(!isMuted)}
            onClose={() => setIsFullscreen(false)}
            isFavorite={isFavorite(currentTrack.id)}
            onToggleFavorite={handleToggleFavorite}
            youtubePlayerRef={youtubePlayerRef}
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
          />

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden relative">
          <BackgroundEffects />

          {/* Sidebar */}
          <Sidebar 
            tracks={libraryTracks}
            playlists={playlists}
            currentView={currentView} 
            onViewChange={(view) => {
              setShowInlinePlayer(false);
              setCurrentView(view);
              // Clear album selection when changing views
              if (view !== "albums") setAlbumToOpen(null);
            }}
            favoritesCount={favoriteTracks.length}
            notificationsCount={notifications.length}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
            onPlayPlaylist={handlePlayPlaylist}
            onShufflePlaylist={handleShufflePlaylist}
          />

          {/* Content Area */}
          <div className="flex-1 flex overflow-hidden relative z-10">
            {noTracksMessage}
            
            <div className={cn(
              "flex-1 transition-all duration-300 relative",
              (isQueueOpen || isLyricsOpen || isNotificationsOpen || isArtistInfoOpen) && "mr-80",
              showInlinePlayer && "flex items-center justify-center",
              currentView === "videos" && "overflow-hidden"
            )}>
              {showInlinePlayer ? (
                <div className="h-full w-full flex items-center justify-center animate-in fade-in duration-200">
                  {currentViewContent}
                </div>
              ) : currentView === "videos" ? (
                <div className="h-full w-full relative">
                  {currentViewContent}
                </div>
              ) : (
                <ScrollArea className="h-full w-full">
                  <div className="animate-in fade-in duration-200">
                    {currentViewContent}
                  </div>
                </ScrollArea>
              )}
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
              }
            }}
            onNavigateToAlbum={handleNavigateToAlbum}
            onNavigateToArtist={handleNavigateToArtist}
            isQueueOpen={isQueueOpen}
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
        {/* En mode fullscreen, on le rend visible pour afficher la vidéo */}
        {currentTrack && (currentTrack.mediaSource as string) === 'youtube' && currentTrack.youtubeVideoId && (
          <div 
            className={cn(
              "fixed inset-0",
              isFullscreen ? "z-[9998] pointer-events-auto" : "pointer-events-none"
            )}
            style={isFullscreen ? {
              zIndex: 9998,
              opacity: 1,
              width: '100%',
              height: '100%',
            } : {
              zIndex: -1,
              opacity: 0,
              width: '1px',
              height: '1px',
              overflow: 'hidden',
            }}
          >
            <YouTubePlayer
              ref={youtubePlayerRef}
              videoId={currentTrack?.youtubeVideoId || ''}
              autoPlay={isPlaying}
              audioOnly={!isFullscreen} // Audio-only en background, vidéo visible en fullscreen
              onEnded={() => {
                console.log('[DesktopApp] YouTube video ended, moving to next track');
                // Record playback before moving to next
                if (currentTrack && playbackStartTrackIdRef.current === currentTrack.id) {
                  const elapsedTime = accumulatedPlaybackTimeRef.current;
                  const completedPercentage = currentTrack.duration > 0
                    ? Math.min(100, (elapsedTime / currentTrack.duration) * 100)
                    : 100;
                  recordPlaybackRef.current(currentTrack.id, elapsedTime, completedPercentage);
                  playbackStartTimeRef.current = null;
                  playbackStartTrackIdRef.current = null;
                  accumulatedPlaybackTimeRef.current = 0;
                }
                // Move to next track
                handleNext();
              }}
              onStateChange={(playing) => {
                console.log('[DesktopApp] YouTube onStateChange:', { playing, currentIsPlaying: isPlaying });
                if (playing !== isPlaying) {
                  setIsPlaying(playing);
                }
                
                // Quand la vidéo YouTube commence à jouer, s'assurer qu'elle est dans l'historique
                if (playing && currentTrack && (currentTrack.mediaSource as string) === 'youtube' && currentTrack.id) {
                  // Toujours ajouter à l'historique (addToHistory gère les doublons)
                  console.log('[DesktopApp] Ajout de la vidéo YouTube à l\'historique audio:', currentTrack.title);
                  addToHistory(currentTrack.id);
                  
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
      </div>
    </TooltipProvider>
  );
};
