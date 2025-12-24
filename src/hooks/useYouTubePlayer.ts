import { useState, useEffect, useCallback, useRef } from "react";

// Types pour l'API YouTube IFrame
declare namespace YT {
  interface PlayerOptions {
    height?: string | number;
    width?: string | number;
    videoId?: string;
    playerVars?: PlayerVars;
    events?: Events;
  }

  interface PlayerVars {
    autoplay?: 0 | 1;
    controls?: 0 | 1 | 2;
    modestbranding?: 0 | 1;
    rel?: 0 | 1;
    playsinline?: 0 | 1;
    enablejsapi?: 0 | 1;
    origin?: string;
    iv_load_policy?: 1 | 3;
    fs?: 0 | 1;
    disablekb?: 0 | 1;
    cc_load_policy?: 0 | 1;
  }

  interface Events {
    onReady?: (event: PlayerEvent) => void;
    onStateChange?: (event: OnStateChangeEvent) => void;
    onError?: (event: OnErrorEvent) => void;
  }

  interface PlayerEvent {
    target: Player;
  }

  interface OnStateChangeEvent {
    target: Player;
    data: number;
  }

  interface OnErrorEvent {
    target: Player;
    data: number;
  }

  interface Player {
    playVideo(): void;
    pauseVideo(): void;
    stopVideo(): void;
    seekTo(seconds: number, allowSeekAhead?: boolean): void;
    loadVideoById(videoId: string, startSeconds?: number): void;
    cueVideoById(videoId: string, startSeconds?: number): void;
    getCurrentTime(): number;
    getDuration(): number;
    getVolume(): number;
    setVolume(volume: number): void;
    isMuted(): boolean;
    mute(): void;
    unMute(): void;
    setPlaybackRate(rate: number): void;
    getPlaybackRate(): number;
    getAvailablePlaybackRates(): number[];
    getPlayerState(): number;
    getPlaybackQuality(): string;
    setPlaybackQuality(quality: string): void;
    getAvailableQualityLevels(): string[];
    destroy(): void;
  }
}

declare global {
  interface Window {
    YT: {
      Player: new (elementId: string, config: YT.PlayerOptions) => YT.Player;
      PlayerState: {
        UNSTARTED: -1;
        ENDED: 0;
        PLAYING: 1;
        PAUSED: 2;
        BUFFERING: 3;
        CUED: 5;
      };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

// Qualités vidéo disponibles (de la plus basse à la plus haute)
export type YouTubeQuality = 'auto' | 'tiny' | 'small' | 'medium' | 'large' | 'hd720' | 'hd1080' | 'hd1440' | 'hd2160' | 'highres';

interface UseYouTubePlayerReturn {
  isReady: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
  error: string | null;
  quality: string;
  availableQualities: string[];
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  setQuality: (quality: YouTubeQuality) => void;
  loadVideo: (videoId: string, startSeconds?: number) => void;
  playerRef: React.RefObject<HTMLDivElement>;
}

/**
 * Hook pour gérer le player YouTube via l'API officielle IFrame
 */
export function useYouTubePlayer(videoId?: string, options?: UseYouTubePlayerOptions): UseYouTubePlayerReturn {
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(70);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quality, setQualityState] = useState<string>('auto');
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  
  const playerRef = useRef<HTMLDivElement>(null);
  const playerInstanceRef = useRef<YT.Player | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const elementIdRef = useRef(`youtube-player-${Date.now()}-${Math.random()}`);

  // Charger l'API YouTube IFrame
  useEffect(() => {
    // Vérifier si l'API est déjà chargée
    if (window.YT && window.YT.Player) {
      setIsReady(true);
      return;
    }

    // Vérifier si le script est déjà en cours de chargement
    const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (existingScript) {
      // Attendre que l'API soit prête
      const checkReady = setInterval(() => {
        if (window.YT && window.YT.Player) {
          setIsReady(true);
          clearInterval(checkReady);
        }
      }, 100);
      
      return () => clearInterval(checkReady);
    }

    // Définir le callback global AVANT de charger le script
    // (l'API YouTube l'appelle immédiatement après chargement)
    const originalCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      setIsReady(true);
      // Appeler le callback original s'il existe (pour compatibilité multi-instances)
      if (originalCallback && typeof originalCallback === 'function') {
        originalCallback();
      }
    };

    // Charger le script
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.body.appendChild(script);
    
    return () => {
      // Ne pas supprimer le callback si d'autres instances l'utilisent
      // (géré par le système de multi-instances)
    };
  }, []);

  // Supprimer les erreurs CORS et postMessage de la console (normales dans Electron)
  useEffect(() => {
    const originalError = console.error;
    const originalWarn = console.warn;
    
    // Filtrer les erreurs YouTube/Google Ads qui sont normales dans Electron
    const errorFilter = (...args: any[]) => {
      const message = args.join(' ');
      // Ignorer les erreurs connues qui sont normales dans Electron
      if (
        message.includes('web-share') ||
        (message.includes('postMessage') && message.includes('target origin')) ||
        (message.includes('CORS policy') && message.includes('doubleclick.net')) ||
        (message.includes('Access to fetch') && message.includes('doubleclick.net')) ||
        (message.includes('Failed to execute \'postMessage\'') && message.includes('target origin'))
      ) {
        return; // Supprimer silencieusement
      }
      originalError.apply(console, args);
    };
    
    const warnFilter = (...args: any[]) => {
      const message = args.join(' ');
      // Ignorer les avertissements connus
      if (
        message.includes('web-share') ||
        (message.includes('postMessage') && message.includes('target origin')) ||
        (message.includes('Unrecognized feature'))
      ) {
        return; // Supprimer silencieusement
      }
      originalWarn.apply(console, args);
    };
    
    console.error = errorFilter;
    console.warn = warnFilter;
    
    // Gérer les erreurs postMessage non capturées
    const handleError = (event: ErrorEvent) => {
      const message = event.message || '';
      if (
        message.includes('postMessage') ||
        message.includes('target origin') ||
        message.includes('web-share') ||
        (message.includes('CORS') && message.includes('doubleclick'))
      ) {
        event.preventDefault(); // Empêcher l'affichage dans la console
        return false;
      }
    };
    
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message = String(event.reason || '');
      if (
        message.includes('postMessage') ||
        message.includes('target origin') ||
        message.includes('web-share') ||
        (message.includes('CORS') && message.includes('doubleclick'))
      ) {
        event.preventDefault(); // Empêcher l'affichage dans la console
      }
    };
    
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      console.error = originalError;
      console.warn = originalWarn;
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Initialiser le player YouTube
  useEffect(() => {
    if (!isReady || !playerRef.current) return;
    
    // S'assurer que l'élément a un ID unique
    const elementId = elementIdRef.current;
    if (!playerRef.current.id) {
      playerRef.current.id = elementId;
    }
    
    try {
      const player = new window.YT.Player(elementId, {
        height: '100%',
        width: '100%',
        playerVars: {
          autoplay: 0,
          controls: 0, // Masquer les contrôles natifs YouTube
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          // Paramètres supplémentaires pour Electron
          enablejsapi: 1,
          origin: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
          // Désactiver certaines fonctionnalités qui causent des erreurs dans Electron
          iv_load_policy: 3, // Masquer les annotations
          fs: 0, // Désactiver le plein écran natif (on utilise notre propre implémentation)
          disablekb: 1, // Désactiver les raccourcis clavier YouTube (on utilise les nôtres)
          cc_load_policy: 0, // Ne pas charger les sous-titres par défaut
        },
        events: {
          onReady: (event: YT.PlayerEvent) => {
            const player = event.target;
            playerInstanceRef.current = player;
            setIsLoading(false);
            setError(null);
            
            // Synchroniser le volume et le mute depuis le player
            try {
              const playerVolume = player.getVolume();
              const playerMuted = player.isMuted();
              if (playerVolume !== undefined && !isNaN(playerVolume)) {
                setVolumeState(playerVolume);
              }
              setIsMuted(playerMuted);
            } catch (err) {
              // Ignorer les erreurs silencieuses
            }
            
            // Charger la vidéo si un videoId est fourni
            if (videoId) {
              player.loadVideoById(videoId);
            }
          },
          onStateChange: (event: YT.OnStateChangeEvent) => {
            const state = event.data;
            
            if (state === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              setIsLoading(false);
              // Récupérer les qualités disponibles quand la vidéo commence
              try {
                const player = event.target;
                const qualities = player.getAvailableQualityLevels();
                if (qualities && qualities.length > 0) {
                  setAvailableQualities(['auto', ...qualities]);
                }
                const currentQuality = player.getPlaybackQuality();
                if (currentQuality) {
                  setQualityState(currentQuality);
                }
              } catch (err) {
                // Ignorer silencieusement
              }
            } else if (state === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
            } else if (state === window.YT.PlayerState.BUFFERING) {
              setIsLoading(true);
            } else if (state === window.YT.PlayerState.ENDED) {
              setIsPlaying(false);
              setCurrentTime(0);
              // Call onEnded callback to advance to next track
              if (options?.onEnded) {
                options.onEnded();
              }
            }
          },
          onError: (event: YT.OnErrorEvent) => {
            setIsLoading(false);
            const errorMessages: Record<number, string> = {
              2: 'URL invalide',
              5: 'Erreur HTML5',
              100: 'Vidéo introuvable',
              101: 'Lecture non autorisée',
              150: 'Lecture non autorisée',
            };
            setError(errorMessages[event.data] || 'Erreur de lecture');
          },
        },
      });
    } catch (err) {
      console.error('Erreur lors de l\'initialisation du player YouTube:', err);
      setError('Impossible d\'initialiser le player YouTube');
      setIsLoading(false);
    }
  }, [isReady, videoId]);

  // Mettre à jour le temps, la durée, le volume et le mute
  useEffect(() => {
    // Attendre que le player soit vraiment initialisé
    if (!isReady) return;

    const updateProgress = () => {
      try {
        const player = playerInstanceRef.current;
        if (!player) return;

        // Vérifier que le player a les méthodes nécessaires
        if (typeof player.getCurrentTime !== 'function') return;

        // Mettre à jour le temps actuel
        const current = player.getCurrentTime();
        if (current !== undefined && !isNaN(current) && current >= 0) {
          setCurrentTime(current);
        }
        
        // Mettre à jour la durée
        const total = player.getDuration();
        if (total !== undefined && !isNaN(total) && total > 0) {
          setDuration(total);
        }
        
        // Synchroniser le volume depuis le player (au cas où il change ailleurs)
        try {
          const playerVolume = player.getVolume();
          const playerMuted = player.isMuted();
          if (playerVolume !== undefined && !isNaN(playerVolume)) {
            setVolumeState(prev => {
              // Ne mettre à jour que si la différence est significative (évite les boucles)
              if (Math.abs(prev - playerVolume) > 1) {
                return playerVolume;
              }
              return prev;
            });
          }
          setIsMuted(playerMuted);
        } catch (err) {
          // Ignorer les erreurs silencieuses
        }
      } catch (err) {
        // Ignorer les erreurs silencieuses
      }
    };

    // Mettre à jour toutes les 100ms pour une progression très fluide
    updateProgress(); // Appel immédiat
    updateIntervalRef.current = setInterval(updateProgress, 100);
    
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [isReady, isPlaying]); // Ajouter isPlaying pour redémarrer l'intervalle quand la lecture change

  // Charger une nouvelle vidéo
  const loadVideo = useCallback((newVideoId: string, startSeconds?: number) => {
    if (!playerInstanceRef.current) {
      setIsLoading(true);
      // Le player sera initialisé avec cette vidéo
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      if (startSeconds !== undefined) {
        playerInstanceRef.current.loadVideoById(newVideoId, startSeconds);
      } else {
        playerInstanceRef.current.loadVideoById(newVideoId);
      }
    } catch (err) {
      console.error('Erreur lors du chargement de la vidéo:', err);
      setError('Impossible de charger la vidéo');
      setIsLoading(false);
    }
  }, []);

  // Contrôles de lecture
  const play = useCallback(() => {
    if (!playerInstanceRef.current) return;
    try {
      playerInstanceRef.current.playVideo();
    } catch (err) {
      console.error('Erreur lors de la lecture:', err);
    }
  }, []);

  const pause = useCallback(() => {
    if (!playerInstanceRef.current) return;
    try {
      playerInstanceRef.current.pauseVideo();
    } catch (err) {
      console.error('Erreur lors de la pause:', err);
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seek = useCallback((time: number) => {
    if (!playerInstanceRef.current) return;
    try {
      playerInstanceRef.current.seekTo(time, true);
      setCurrentTime(time);
    } catch (err) {
      console.error('Erreur lors du seek:', err);
    }
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clampedVol = Math.max(0, Math.min(100, vol));
    if (playerInstanceRef.current) {
      try {
        playerInstanceRef.current.setVolume(clampedVol);
        setVolumeState(clampedVol);
      } catch (err) {
        console.error('Erreur lors du changement de volume:', err);
      }
    } else {
      // Si le player n'est pas encore prêt, sauvegarder la valeur
      setVolumeState(clampedVol);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!playerInstanceRef.current) return;
    try {
      const newMutedState = !isMuted;
      if (newMutedState) {
        playerInstanceRef.current.mute();
      } else {
        playerInstanceRef.current.unMute();
      }
      setIsMuted(newMutedState);
    } catch (err) {
      console.error('Erreur lors du mute/unmute:', err);
    }
  }, [isMuted]);

  const setPlaybackRate = useCallback((rate: number) => {
    if (!playerInstanceRef.current) return;
    try {
      const clampedRate = Math.max(0.25, Math.min(2, rate));
      playerInstanceRef.current.setPlaybackRate(clampedRate);
    } catch (err) {
      console.error('Erreur lors du changement de vitesse:', err);
    }
  }, []);

  // Définir la qualité vidéo
  // 'auto' = YouTube gère automatiquement (recommandé pour les perfs)
  // 'tiny' = 144p, 'small' = 240p, 'medium' = 360p, 'large' = 480p
  // 'hd720' = 720p, 'hd1080' = 1080p, 'hd1440' = 1440p, 'hd2160' = 4K
  const setQuality = useCallback((newQuality: YouTubeQuality) => {
    if (!playerInstanceRef.current) {
      setQualityState(newQuality);
      return;
    }
    try {
      if (newQuality === 'auto') {
        // Pour 'auto', on laisse YouTube décider en mettant 'default'
        // ou en ne changeant pas la qualité
        setQualityState('auto');
      } else {
        playerInstanceRef.current.setPlaybackQuality(newQuality);
        setQualityState(newQuality);
      }
    } catch (err) {
      console.error('Erreur lors du changement de qualité:', err);
    }
  }, []);

  // Nettoyer lors du démontage
  useEffect(() => {
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      if (playerInstanceRef.current) {
        try {
          playerInstanceRef.current.destroy();
        } catch (err) {
          // Ignorer les erreurs de destruction
        }
      }
    };
  }, []);

  return {
    isReady,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isLoading,
    error,
    quality,
    availableQualities,
    play,
    pause,
    togglePlayPause,
    seek,
    setVolume,
    toggleMute,
    setPlaybackRate,
    setQuality,
    loadVideo,
    playerRef,
  };
}
