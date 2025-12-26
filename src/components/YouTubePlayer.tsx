"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { useYouTubePlayer, type YouTubeQuality } from "@/hooks/useYouTubePlayer";
import { extractYouTubeVideoId } from "@/lib/youtube";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface YouTubePlayerProps {
  videoId: string;
  className?: string;
  autoPlay?: boolean;
  startTime?: number;
  onReady?: () => void;
  onStateChange?: (isPlaying: boolean) => void;
  onTimeUpdate?: (currentTime: number) => void;
  onError?: (error: string) => void;
  onEnded?: () => void; // Called when video ends
  audioOnly?: boolean; // Mode audio-only (masque la vidéo)
}

export interface YouTubePlayerRef {
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setQuality: (quality: YouTubeQuality) => void;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  quality: string;
  availableQualities: string[];
}

/**
 * Composant YouTube Player utilisant l'API officielle IFrame
 * 100% conforme aux conditions d'utilisation YouTube
 */
export const YouTubePlayer = forwardRef<YouTubePlayerRef | null, YouTubePlayerProps>(({
  videoId,
  className,
  autoPlay = false,
  startTime,
  onReady,
  onStateChange,
  onTimeUpdate,
  onError,  onEnded,  audioOnly = false,
}, ref) => {
  const extractedVideoId = extractYouTubeVideoId(videoId) || videoId;
  
  const {
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
    setQuality,
    loadVideo,
    playerRef,
  } = useYouTubePlayer(extractedVideoId, {
    onEnded: () => {
      if (onEndedRef.current) {
        onEndedRef.current();
      }
    },
  });

  // Exposer les méthodes via ref
  useImperativeHandle(ref, () => ({
    play,
    pause,
    togglePlayPause,
    seek,
    setVolume,
    toggleMute,
    setQuality,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    quality,
    availableQualities,
  }), [play, pause, togglePlayPause, seek, setVolume, toggleMute, setQuality, isPlaying, currentTime, duration, volume, isMuted, quality, availableQualities]);

  // Charger la vidéo avec startTime si fourni
  useEffect(() => {
    if (isReady && extractedVideoId) {
      // Utiliser setTimeout pour s'assurer que le player est complètement initialisé
      const timer = setTimeout(() => {
        loadVideo(extractedVideoId, startTime);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isReady, extractedVideoId, startTime, loadVideo]);

  // Auto-play si demandé
  useEffect(() => {
    if (isReady && autoPlay && !isPlaying) {
      play();
    }
  }, [isReady, autoPlay, isPlaying, play]);

  // Callbacks - utiliser useRef pour éviter les boucles infinies
  const onReadyRef = useRef(onReady);
  const onStateChangeRef = useRef(onStateChange);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onErrorRef = useRef(onError);
  const onEndedRef = useRef(onEnded);

  // Mettre à jour les refs quand les callbacks changent
  useEffect(() => {
    onReadyRef.current = onReady;
    onStateChangeRef.current = onStateChange;
    onTimeUpdateRef.current = onTimeUpdate;
    onErrorRef.current = onError;
    onEndedRef.current = onEnded;
  }, [onReady, onStateChange, onTimeUpdate, onError, onEnded]);

  // Réagir aux changements de audioOnly pour forcer la visibilité de la vidéo
  useEffect(() => {
    if (!playerRef.current) return;
    
    const container = playerRef.current;
    if (!audioOnly) {
      // En mode vidéo, s'assurer que l'iframe est visible et correctement dimensionnée
      container.style.opacity = '1';
      container.style.pointerEvents = 'auto';
      container.style.transform = 'none';
      container.style.width = '100%';
      container.style.height = '100%';
    } else {
      // En mode audio-only, masquer l'iframe
      container.style.opacity = '0';
      container.style.pointerEvents = 'none';
      container.style.transform = 'scale(0.1)';
    }
  }, [audioOnly]);

  // Appeler les callbacks sans créer de dépendances
  useEffect(() => {
    if (isReady && onReadyRef.current) {
      onReadyRef.current();
    }
  }, [isReady]);

  useEffect(() => {
    if (onStateChangeRef.current) {
      onStateChangeRef.current(isPlaying);
    }
  }, [isPlaying]);

  // Ref pour stocker currentTime et éviter les closures stales
  const currentTimeRef = useRef(currentTime);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // Appeler onTimeUpdate via un intervalle pour garantir une mise à jour continue
  useEffect(() => {
    if (!isReady) return;
    
    // Appel immédiat avec la valeur actuelle
    if (onTimeUpdateRef.current && currentTimeRef.current >= 0) {
      onTimeUpdateRef.current(currentTimeRef.current);
    }
    
    // Intervalle pour mise à jour continue
    const interval = setInterval(() => {
      if (onTimeUpdateRef.current && currentTimeRef.current >= 0) {
        onTimeUpdateRef.current(currentTimeRef.current);
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [isReady, isPlaying]); // Redémarrer quand isReady ou isPlaying change

  useEffect(() => {
    if (error && onErrorRef.current) {
      onErrorRef.current(error);
    }
  }, [error]);


  return (
    <div
      className={cn(
        "relative w-full h-full bg-black",
        audioOnly && "overflow-hidden",
        className
      )}
    >
      {/* Container YouTube IFrame */}
      <div
        ref={playerRef}
        className={cn(
          "w-full h-full",
          audioOnly && "absolute inset-0"
        )}
        style={audioOnly ? { 
          opacity: 0, 
          pointerEvents: 'none',
          transform: 'scale(0.1)', 
          transformOrigin: 'top left' 
        } : {
          opacity: 1,
          pointerEvents: 'auto',
          transform: 'none',
          width: '100%',
          height: '100%'
        }}
      />
      
      {/* Overlay transparent pour domination totale - permet le clic droit pour le menu contextuel */}
      {/* En mode vidéo, on laisse l'iframe visible mais on intercepte les clics pour nos contrôles */}
      {!audioOnly && (
        <div
          className="absolute inset-0"
          style={{
            zIndex: 10,
            pointerEvents: 'auto',
            // Overlay transparent qui capture tous les événements sauf le clic droit
            // z-10 pour être au-dessus de l'iframe mais en dessous des contrôles (z-30)
          }}
          onContextMenu={(e) => {
            // Permettre le menu contextuel YouTube
            // Ne pas empêcher le comportement par défaut pour que le menu contextuel s'affiche
            // L'événement passera à l'iframe en dessous grâce à pointer-events
            e.stopPropagation();
          }}
          onClick={(e) => {
            // Intercepter les clics gauche pour notre contrôle
            // Mais seulement si on ne clique pas sur un élément interactif
            const target = e.target as HTMLElement;
            if (!target.closest('button, a, input, select, textarea, [role="button"]')) {
              e.preventDefault();
              e.stopPropagation();
              togglePlayPause();
            }
          }}
          onDoubleClick={(e) => {
            // Empêcher le double-clic de passer à YouTube
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            // Intercepter les clics sauf le clic droit (button 2)
            // Et sauf si on clique sur un élément interactif
            if (e.button !== 2) {
              const target = e.target as HTMLElement;
              if (!target.closest('button, a, input, select, textarea, [role="button"]')) {
                e.preventDefault();
                e.stopPropagation();
              }
            }
          }}
          onMouseUp={(e) => {
            // Intercepter les relâchements sauf le clic droit
            if (e.button !== 2) {
              const target = e.target as HTMLElement;
              if (!target.closest('button, a, input, select, textarea, [role="button"]')) {
                e.preventDefault();
                e.stopPropagation();
              }
            }
          }}
          onWheel={(e) => {
            // Empêcher le scroll de passer à YouTube
            e.preventDefault();
            e.stopPropagation();
          }}
          // Intercepter tous les autres événements
          onMouseMove={(e) => e.stopPropagation()}
          onMouseEnter={(e) => e.stopPropagation()}
          onMouseLeave={(e) => e.stopPropagation()}
        />
      )}
      
      {/* Overlay audio-only (visualizer, etc.) */}
      {audioOnly && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-background via-background/90 to-background/80">
          {isLoading && (
            <div className="w-full h-full flex items-center justify-center">
              <Skeleton className="w-32 h-32 rounded-lg" />
            </div>
          )}
          {error && (
            <div className="text-center p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>
      )}
      
      {/* Loading overlay */}
      {!audioOnly && isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30 pointer-events-none">
          <Skeleton className="w-full h-full rounded-none" />
        </div>
      )}
      
      {/* Error overlay */}
      {!audioOnly && error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30 pointer-events-none">
          <div className="text-center p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
});

YouTubePlayer.displayName = "YouTubePlayer";
