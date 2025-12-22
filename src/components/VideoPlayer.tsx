import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  Minimize,
  Settings,
  PictureInPicture,
  X,
  ChevronLeft,
  Monitor,
  Film,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { Video } from "@/types/music";
import { useVideoPlayer } from "@/hooks/useVideoPlayer";
import { YouTubePlayer, type YouTubePlayerRef } from "./YouTubePlayer";
import { detectMediaSource, extractYouTubeVideoId } from "@/lib/youtube";
import { fetchYouTubeVideoMetadata } from "@/lib/youtube-metadata";
import { useAudioAI } from "@/hooks/useAudioAI";
import { AIAnalysisPanel } from "./AIAnalysisPanel";
import { Brain } from "lucide-react";

interface VideoPlayerProps {
  video: Video;
  videos?: Video[];
  onClose?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  className?: string;
  showControls?: boolean;
  autoPlay?: boolean;
  onFullApp?: () => void;
  onCinemaMode?: () => void;
  isFullApp?: boolean;
  audioOnly?: boolean; // Mode audio-only pour YouTube
  onProgressUpdate?: (videoId: string, currentTime: number, duration: number) => void; // Callback pour sauvegarder la progression
}

const formatTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const VideoPlayer = ({
  video,
  videos = [],
  onClose,
  onNext,
  onPrevious,
  className,
  showControls = true,
  autoPlay = false,
  onFullApp,
  onCinemaMode,
  isFullApp = false,
  audioOnly = false,
  onProgressUpdate,
}: VideoPlayerProps) => {
  const [showControlsOverlay, setShowControlsOverlay] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Détecter si c'est une vidéo YouTube
  const mediaSource = video.mediaSource || detectMediaSource(video.filePath);
  const isYouTube = mediaSource === 'youtube';
  const youtubeVideoId = video.youtubeVideoId || (isYouTube ? extractYouTubeVideoId(video.filePath) : null);
  
  // État pour YouTube Player
  const [youtubeState, setYoutubeState] = useState({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 70,
    isMuted: false,
    isLoading: false,
  });
  
  const youtubePlayerRef = useRef<YouTubePlayerRef | null>(null);

  // Hook d'analyse audio IA - utiliser un état pour l'élément média
  const [mediaElementForAI, setMediaElementForAI] = useState<HTMLVideoElement | null>(null);
  
  useEffect(() => {
    if (!isYouTube && videoRef.current) {
      setMediaElementForAI(videoRef.current);
    } else {
      setMediaElementForAI(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isYouTube]); // videoRef est une ref stable, pas besoin de la mettre dans les dépendances

  const audioUrlForAI = video.filePath && !isYouTube ? video.filePath : undefined;
  
  const {
    analysis: aiAnalysis,
    startBrowserAnalysis,
    startAIAnalysis,
    isPro: isAIPro,
  } = useAudioAI({
    mediaElement: mediaElementForAI,
    audioUrl: audioUrlForAI,
    autoStart: true,
    enableAI: false, // Sera activé manuellement via startAIAnalysis si Pro
  });

  // Activer l'IA automatiquement si Pro et panneau ouvert (uniquement pour les vidéos non-YouTube avec URL)
  useEffect(() => {
    if (isAIPro && showAIPanel && !isYouTube && audioUrlForAI && !aiAnalysis.transcription && !aiAnalysis.isLoading) {
      // Délai pour s'assurer que le panneau est bien affiché
      const timer = setTimeout(() => {
        startAIAnalysis();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAIPro, showAIPanel, isYouTube, audioUrlForAI, aiAnalysis.transcription, aiAnalysis.isLoading, startAIAnalysis]);

  // Player pour vidéos locales/cloud
  const {
    isPlaying: localIsPlaying,
    currentTime: localCurrentTime,
    duration: localDuration,
    volume: localVolume,
    isMuted: localIsMuted,
    isFullscreen,
    isLoading: localIsLoading,
    playbackRate,
    playVideo,
    togglePlayPause: localTogglePlayPause,
    seek: localSeek,
    setVolume: localSetVolume,
    toggleMute: localToggleMute,
    toggleFullscreen,
    setPlaybackRate,
    nextVideo,
    previousVideo,
    videoRef,
  } = useVideoPlayer(videos);

  // Utiliser l'état YouTube ou local selon la source
  const isPlaying = isYouTube ? youtubeState.isPlaying : localIsPlaying;
  const currentTime = isYouTube ? youtubeState.currentTime : localCurrentTime;
  const duration = isYouTube ? youtubeState.duration : localDuration;
  const volume = isYouTube ? youtubeState.volume : localVolume;
  const isMuted = isYouTube ? youtubeState.isMuted : localIsMuted;
  const isLoading = isYouTube ? youtubeState.isLoading : localIsLoading;

  // Contrôles unifiés (mémorisés pour éviter les re-renders)
  const togglePlayPause = useCallback(() => {
    if (isYouTube && youtubePlayerRef.current) {
      youtubePlayerRef.current.togglePlayPause();
    } else {
      localTogglePlayPause();
    }
  }, [isYouTube, localTogglePlayPause]);

  const seek = useCallback((time: number) => {
    if (isYouTube && youtubePlayerRef.current) {
      youtubePlayerRef.current.seek(time);
    } else {
      localSeek(time);
    }
  }, [isYouTube, localSeek]);

  const setVolume = useCallback((vol: number) => {
    if (isYouTube && youtubePlayerRef.current) {
      youtubePlayerRef.current.setVolume(vol);
    } else {
      localSetVolume(vol);
    }
  }, [isYouTube, localSetVolume]);

  const toggleMute = useCallback(() => {
    if (isYouTube && youtubePlayerRef.current) {
      youtubePlayerRef.current.toggleMute();
    } else {
      localToggleMute();
    }
  }, [isYouTube, localToggleMute]);

  // Callbacks mémorisés pour YouTube Player (évite les boucles infinies)
  const handleYouTubeStateChange = useCallback((playing: boolean) => {
    setYoutubeState(prev => {
      // Éviter les mises à jour inutiles
      if (prev.isPlaying === playing) return prev;
      return { ...prev, isPlaying: playing };
    });
  }, []);

  // Refs pour stocker les valeurs et éviter les problèmes de closure
  const lastSavedTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);
  const videoIdRef = useRef<string>(video.id);
  
  // Mettre à jour les refs quand les valeurs changent
  useEffect(() => {
    durationRef.current = duration;
    videoIdRef.current = video.id;
  }, [duration, video.id]);
  
  const handleYouTubeTimeUpdate = useCallback((time: number) => {
    setYoutubeState(prev => {
      // Éviter les mises à jour inutiles (seulement si changement significatif)
      if (Math.abs(prev.currentTime - time) < 0.5) return prev;
      return { ...prev, currentTime: time };
    });
    
    // Sauvegarder la progression de manière asynchrone (après le rendu)
    // Toutes les 5 secondes pour éviter trop d'appels
    if (onProgressUpdate && durationRef.current > 0) {
      const currentTimeSeconds = Math.floor(time);
      const lastSavedSeconds = Math.floor(lastSavedTimeRef.current);
      
      if (currentTimeSeconds % 5 === 0 && currentTimeSeconds !== lastSavedSeconds) {
        lastSavedTimeRef.current = time;
        // Utiliser setTimeout pour décaler l'appel après le rendu
        setTimeout(() => {
          onProgressUpdate(videoIdRef.current, time, durationRef.current);
        }, 0);
      }
    }
  }, [onProgressUpdate]);

  const handleYouTubeReady = useCallback(() => {
    // Le player est prêt - synchroniser l'état
    if (youtubePlayerRef.current) {
      // Utiliser setTimeout pour s'assurer que le player est complètement initialisé
      setTimeout(() => {
        if (youtubePlayerRef.current) {
          const duration = youtubePlayerRef.current.duration;
          setYoutubeState(prev => ({
            ...prev,
            volume: youtubePlayerRef.current!.volume,
            isMuted: youtubePlayerRef.current!.isMuted,
            duration: duration,
            isLoading: false,
          }));
          
          // Sauvegarder la progression initiale si callback fourni (de manière asynchrone)
          if (onProgressUpdate && duration > 0) {
            const currentTime = youtubePlayerRef.current.currentTime || 0;
            setTimeout(() => {
              onProgressUpdate(video.id, currentTime, duration);
            }, 0);
          }
        }
      }, 100);
    }
  }, [onProgressUpdate, video.id]);

  const handleYouTubeError = useCallback((error: string) => {
    console.error('Erreur YouTube Player:', error);
    setYoutubeState(prev => {
      if (prev.isLoading === false) return prev;
      return { ...prev, isLoading: false };
    });
  }, []);

  // Set the current video and auto-play if requested
  useEffect(() => {
    if (video && !isYouTube) {
      playVideo(video);
    }
  }, [video, playVideo, isYouTube]);

  // Récupérer les métadonnées YouTube quand une vidéo YouTube est chargée
  useEffect(() => {
    if (isYouTube && youtubeVideoId) {
      // Récupérer les métadonnées YouTube (résolutions, titre, description, etc.)
      fetchYouTubeVideoMetadata(youtubeVideoId)
        .then((result) => {
          if (result.success && result.metadata) {
            // Les métadonnées sont disponibles, on peut les utiliser pour enrichir l'UI
            // Note: Les résolutions disponibles ne sont pas directement fournies par l'API Data v3
            // mais sont gérées dynamiquement par le player IFrame
            console.log('Métadonnées YouTube récupérées:', {
              title: result.metadata.title,
              duration: result.metadata.duration,
              viewCount: result.metadata.viewCount,
            });
            
            // Synchroniser la durée avec l'état YouTube si disponible
            if (result.metadata?.duration && result.metadata.duration > 0) {
              setYoutubeState(prev => ({
                ...prev,
                duration: result.metadata!.duration || prev.duration,
              }));
            }
          }
        })
        .catch((err) => {
          console.warn('Erreur lors de la récupération des métadonnées YouTube:', err);
        });
    }
  }, [isYouTube, youtubeVideoId]);
  
  // Sauvegarder la progression périodiquement pour YouTube (toutes les 10 secondes)
  useEffect(() => {
    if (!isYouTube || !onProgressUpdate || !isPlaying || duration === 0) return;
    
    const interval = setInterval(() => {
      if (youtubePlayerRef.current && duration > 0) {
        const currentTime = youtubePlayerRef.current.currentTime || 0;
        onProgressUpdate(video.id, currentTime, duration);
      }
    }, 10000); // Toutes les 10 secondes
    
    return () => clearInterval(interval);
  }, [isYouTube, onProgressUpdate, isPlaying, duration, video.id]);
  
  // Sauvegarder la progression lors de la pause ou de la fermeture
  useEffect(() => {
    if (!isYouTube || !onProgressUpdate || duration === 0) return;
    
    // Copier la ref dans une variable locale pour le cleanup
    const playerRef = youtubePlayerRef.current;
    const videoId = video.id;
    const finalDuration = duration;
    
    return () => {
      // Cleanup: sauvegarder la progression finale
      if (playerRef && finalDuration > 0) {
        const currentTime = playerRef.currentTime || 0;
        onProgressUpdate(videoId, currentTime, finalDuration);
      }
    };
  }, [isYouTube, onProgressUpdate, duration, video.id]);

  // Show/hide controls on mouse movement
  useEffect(() => {
    if (!showControls) return;

    const handleMouseMove = () => {
      setShowControlsOverlay(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) {
          setShowControlsOverlay(false);
        }
      }, 3000);
    };

    const handleMouseLeave = () => {
      if (isPlaying) {
        setShowControlsOverlay(false);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [showControls, isPlaying]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlayPause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seek(Math.max(0, currentTime - 10));
          break;
        case "ArrowRight":
          e.preventDefault();
          seek(Math.min(duration, currentTime + 10));
          break;
        case "ArrowUp":
          e.preventDefault();
          setVolume(Math.min(100, volume + 5));
          break;
        case "ArrowDown":
          e.preventDefault();
          setVolume(Math.max(0, volume - 5));
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
        case "M":
          e.preventDefault();
          toggleMute();
          break;
        case "Escape":
          if (isFullscreen) {
            toggleFullscreen();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlayPause, seek, currentTime, duration, setVolume, volume, toggleMute, toggleFullscreen, isFullscreen]);

  const handleSeek = (value: number[]) => {
    const newTime = value[0];
    if (isYouTube && youtubePlayerRef.current) {
      // Pour YouTube, utiliser seek directement
      youtubePlayerRef.current.seek(newTime);
    } else {
      seek(newTime);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
  };

  const handlePictureInPicture = async () => {
    if (videoRef.current && document.pictureInPictureEnabled) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await videoRef.current.requestPictureInPicture();
        }
      } catch (error) {
        console.error("Picture-in-Picture error:", error);
      }
    }
  };

  const getVideoSource = (video: Video): string => {
    if (!video.filePath) return "";
    // Check if running in Electron - use reliable detection
    const isElectron = typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';
    if (isElectron) {
      return `local-video://${encodeURIComponent(video.filePath)}`;
    }
    return "";
  };

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  return (
    <div
      className={cn(
        "relative bg-black group w-full h-full",
        isFullApp ? "fixed inset-0 z-[9998]" : "",
        className
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* YouTube Player ou Video Element */}
      {isYouTube && youtubeVideoId ? (
        <div className="absolute inset-0 w-full h-full">
          <YouTubePlayer
            ref={youtubePlayerRef}
            videoId={youtubeVideoId}
            autoPlay={autoPlay}
            startTime={video.watchProgress?.currentTime}
            className="w-full h-full"
            audioOnly={audioOnly}
            onStateChange={handleYouTubeStateChange}
            onTimeUpdate={handleYouTubeTimeUpdate}
            onReady={handleYouTubeReady}
            onError={handleYouTubeError}
          />
        </div>
      ) : (
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          preload="metadata"
          onClick={togglePlayPause}
        />
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Controls Overlay - Superposé sur YouTube avec z-index élevé */}
      {showControls && (showControlsOverlay || isHovering || !isPlaying) && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-between p-4 transition-opacity z-30 pointer-events-none">
          {/* Top Controls */}
          <div className="flex items-center justify-between pointer-events-auto">
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-white hover:bg-white/20"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowAIPanel(!showAIPanel)}
                className={cn(
                  "text-white hover:bg-white/20 backdrop-blur-sm transition-all duration-200 ease-out active:scale-95",
                  showAIPanel && "bg-primary/20 text-primary",
                  isAIPro && "ring-2 ring-primary/50"
                )}
                title={isAIPro ? "Analyse IA Pro" : "Analyse audio native (Gratuit)"}
              >
                <Brain className="w-5 h-5" />
                {isAIPro && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
                )}
              </Button>
              {onCinemaMode && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onCinemaMode}
                  className="text-white hover:bg-white/20 backdrop-blur-sm transition-all duration-200 ease-out active:scale-95"
                  title="Mode Ciné"
                >
                  <Film className="w-5 h-5" />
                </Button>
              )}
              {onFullApp && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onFullApp}
                  className="text-white hover:bg-white/20 backdrop-blur-sm transition-all duration-200 ease-out active:scale-95"
                  title="Plein écran dans l'app"
                >
                  <Monitor className="w-5 h-5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePictureInPicture}
                className="text-white hover:bg-white/20 backdrop-blur-sm transition-all duration-200 ease-out active:scale-95"
                disabled={!document.pictureInPictureEnabled}
                title="Image dans l'image"
              >
                <PictureInPicture className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="text-white hover:bg-white/20 backdrop-blur-sm transition-all duration-200 ease-out active:scale-95"
                title="Plein écran"
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </Button>
            </div>
          </div>

          {/* Center Play Button */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }}
              className="w-20 h-20 rounded-full bg-white/20 hover:bg-white/30 text-white pointer-events-auto backdrop-blur-sm"
            >
              {isPlaying ? (
                <Pause className="w-10 h-10 fill-current" />
              ) : (
                <Play className="w-10 h-10 fill-current ml-1" />
              )}
            </Button>
          </div>

          {/* Bottom Controls */}
          <div className="space-y-3 pointer-events-auto">
            {/* Progress Bar */}
            <div className="flex items-center gap-3">
              <span className="text-white text-sm font-mono min-w-[60px] text-right">
                {formatTime(currentTime)}
              </span>
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={1}
                onValueChange={handleSeek}
                className="flex-1"
              />
              <span className="text-white text-sm font-mono min-w-[60px]">
                {formatTime(duration)}
              </span>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {onPrevious && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onPrevious}
                    className="text-white hover:bg-white/20"
                    disabled={!videos.length}
                  >
                    <SkipBack className="w-5 h-5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={togglePlayPause}
                  className="text-white hover:bg-white/20"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current" />
                  )}
                </Button>
                {onNext && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onNext}
                    className="text-white hover:bg-white/20"
                    disabled={!videos.length}
                  >
                    <SkipForward className="w-5 h-5" />
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* Volume Control */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleMute}
                    className="text-white hover:bg-white/20"
                  >
                    <VolumeIcon className="w-5 h-5" />
                  </Button>
                  <Slider
                    value={[volume]}
                    max={100}
                    step={1}
                    onValueChange={handleVolumeChange}
                    className="w-24"
                  />
                </div>

                {/* Subtitles (if available) */}
                {video.subtitles && video.subtitles.length > 0 && (
                  <div className="flex items-center gap-2">
                    <select
                      className="bg-white/20 text-white text-sm rounded px-2 py-1 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                      aria-label="Sous-titres"
                    >
                      <option value="">Sous-titres désactivés</option>
                      {video.subtitles.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Audio Tracks (if available) */}
                {video.audioTracks && video.audioTracks.length > 1 && (
                  <div className="flex items-center gap-2">
                    <select
                      className="bg-white/20 text-white text-sm rounded px-2 py-1 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                      aria-label="Piste audio"
                    >
                      {video.audioTracks.map((track) => (
                        <option key={track.id} value={track.id}>
                          {track.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Quality (if available) */}
                {video.quality && (
                  <div className="px-2 py-1 bg-white/20 rounded text-xs text-white font-medium">
                    {video.quality}
                  </div>
                )}

                {/* Playback Rate */}
                <div className="flex items-center gap-2">
                  <select
                    value={playbackRate}
                    onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                    className="bg-white/20 text-white text-sm rounded px-2 py-1 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                    aria-label="Vitesse de lecture"
                  >
                    <option value="0.25">0.25x</option>
                    <option value="0.5">0.5x</option>
                    <option value="0.75">0.75x</option>
                    <option value="1">1x</option>
                    <option value="1.25">1.25x</option>
                    <option value="1.5">1.5x</option>
                    <option value="2">2x</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Video Info */}
            <div className="text-white">
              <h3 className="font-medium text-sm truncate">{video.title}</h3>
              <div className="flex items-center gap-2 text-xs text-white/70">
              {video.width && video.height && (
                  <span>{video.width} × {video.height}</span>
                )}
                {video.format && (
                  <span>• {video.format.toUpperCase()}</span>
                )}
                {video.codec && (
                  <span>• {video.codec}</span>
                )}
                {video.duration > 0 && (
                  <span>• {formatTime(video.duration)}</span>
              )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Analysis Panel */}
      {showAIPanel && (
        <div className="absolute bottom-20 right-4 w-96 z-40 pointer-events-auto">
          <AIAnalysisPanel
            analysis={aiAnalysis}
            onStartAI={startAIAnalysis}
          />
        </div>
      )}
    </div>
  );
};

