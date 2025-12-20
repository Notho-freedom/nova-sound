"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";
import { extractYouTubeVideoId } from "@/lib/youtube";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface YouTubePlayerProps {
  videoId: string;
  className?: string;
  autoPlay?: boolean;
  startTime?: number;
  onReady?: () => void;
  onStateChange?: (isPlaying: boolean) => void;
  onTimeUpdate?: (currentTime: number) => void;
  onError?: (error: string) => void;
  audioOnly?: boolean; // Mode audio-only (masque la vidéo)
}

export interface YouTubePlayerRef {
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
}

/**
 * Composant YouTube Player utilisant l'API officielle IFrame
 * 100% conforme aux conditions d'utilisation YouTube
 */
export const YouTubePlayer = forwardRef<YouTubePlayerRef, YouTubePlayerProps>(({
  videoId,
  className,
  autoPlay = false,
  startTime,
  onReady,
  onStateChange,
  onTimeUpdate,
  onError,
  audioOnly = false,
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
    play,
    pause,
    togglePlayPause,
    seek,
    setVolume,
    toggleMute,
    loadVideo,
    playerRef,
  } = useYouTubePlayer(extractedVideoId);

  // Exposer les méthodes via ref
  useImperativeHandle(ref, () => ({
    play,
    pause,
    togglePlayPause,
    seek,
    setVolume,
    toggleMute,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
  }), [play, pause, togglePlayPause, seek, setVolume, toggleMute, isPlaying, currentTime, duration, volume, isMuted]);

  // Charger la vidéo avec startTime si fourni
  useEffect(() => {
    if (isReady && extractedVideoId) {
      loadVideo(extractedVideoId, startTime);
    }
  }, [isReady, extractedVideoId, startTime, loadVideo]);

  // Auto-play si demandé
  useEffect(() => {
    if (isReady && autoPlay && !isPlaying) {
      play();
    }
  }, [isReady, autoPlay, isPlaying, play]);

  // Callbacks
  useEffect(() => {
    if (isReady && onReady) {
      onReady();
    }
  }, [isReady, onReady]);

  useEffect(() => {
    if (onStateChange) {
      onStateChange(isPlaying);
    }
  }, [isPlaying, onStateChange]);

  useEffect(() => {
    if (onTimeUpdate) {
      onTimeUpdate(currentTime);
    }
  }, [currentTime, onTimeUpdate]);

  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);


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
          audioOnly && "absolute inset-0 opacity-0 pointer-events-none"
        )}
        style={audioOnly ? { transform: 'scale(0.1)', transformOrigin: 'top left' } : undefined}
      />
      
      {/* Overlay audio-only (visualizer, etc.) */}
      {audioOnly && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-background via-background/90 to-background/80">
          {isLoading && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Chargement...</p>
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
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Chargement...</p>
          </div>
        </div>
      )}
      
      {/* Error overlay */}
      {!audioOnly && error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="text-center p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
});

YouTubePlayer.displayName = "YouTubePlayer";
