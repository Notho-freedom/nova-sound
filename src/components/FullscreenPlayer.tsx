import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { 
  X, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Repeat1,
  Volume2, 
  VolumeX,
  Volume1,
  Heart,
  ChevronDown,
  Music2,
  Disc3,
  Clock,
  ListMusic,
  Share2,
  MoreHorizontal
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { AlbumArt } from "./AlbumArt";
import { LegacyAudioVisualizer } from "./LegacyAudioVisualizer";
import { BackgroundEffects } from "./BackgroundEffects";
import { useAudioVibes } from "@/hooks/useAudioVibes";
import { Track } from "@/types/music";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import { YouTubePlayer, type YouTubePlayerRef } from "./YouTubePlayer";
import { extractYouTubeVideoId } from "@/lib/youtube";

interface FullscreenPlayerProps {
  currentTrack: Track;
  isPlaying: boolean;
  currentTime: number;
  isShuffle: boolean;
  repeatMode: "off" | "all" | "one";
  volume: number;
  isMuted: boolean;
  isFavorite?: boolean;
  isInline?: boolean;
  audioElement?: HTMLAudioElement | null;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onShuffle: () => void;
  onRepeat: () => void;
  onSeek: (value: number[]) => void;
  onVolumeChange: (value: number[]) => void;
  onMuteToggle: () => void;
  onClose: () => void;
  onToggleFavorite?: () => void;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  }
  return `${mins}m ${secs}s`;
};

export const FullscreenPlayer = ({
  currentTrack,
  isPlaying,
  currentTime,
  isShuffle,
  repeatMode,
  volume,
  isMuted,
  isFavorite = false,
  isInline = false,
  audioElement,
  onPlayPause,
  onPrevious,
  onNext,
  onShuffle,
  onRepeat,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onClose,
  onToggleFavorite,
}: FullscreenPlayerProps) => {
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState<string | null>(null);
  
  // Détecter si c'est un track YouTube
  const isYouTube = currentTrack.mediaSource === 'youtube';
  const youtubeVideoId = currentTrack.youtubeVideoId || (isYouTube && currentTrack.filePath ? extractYouTubeVideoId(currentTrack.filePath) : null);
  const youtubePlayerRef = useRef<YouTubePlayerRef | null>(null);
  
  // État pour le player YouTube
  const [youtubeState, setYoutubeState] = useState({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 70,
    isMuted: false,
  });

  // Use FFT data for visualization (seulement pour les tracks non-YouTube)
  const vibesData = useAudioVibes(isYouTube ? null : (audioElement ?? null), {
    fftSize: 1024, // Reduced from 2048 for better performance
    enableBassFilter: false,
  });

  // Callbacks pour le player YouTube
  const handleYouTubeStateChange = useCallback((playing: boolean) => {
    setYoutubeState(prev => ({ ...prev, isPlaying: playing }));
    // Ne pas appeler onPlayPause ici pour éviter les boucles infinies
    // L'état sera synchronisé via les useEffect
  }, []);

  const handleYouTubeTimeUpdate = useCallback((time: number) => {
    setYoutubeState(prev => {
      // Mettre à jour l'état local
      const newState = { ...prev, currentTime: time };
      
      // Mettre à jour le currentTime dans DesktopApp via onSeek
      // Mais seulement si la différence est significative pour éviter trop d'appels
      const timeDiff = Math.abs(time - (prev.currentTime || 0));
      if (timeDiff > 0.5) {
        // Utiliser requestAnimationFrame pour éviter les conflits
        requestAnimationFrame(() => {
          onSeek([time]);
        });
      }
      
      return newState;
    });
  }, [onSeek]);

  const handleYouTubeReady = useCallback(() => {
    if (youtubePlayerRef.current) {
      const player = youtubePlayerRef.current;
      
      // Mettre à jour l'état avec les valeurs du player
      setYoutubeState(prev => ({
        ...prev,
        volume: player.volume,
        isMuted: player.isMuted,
        duration: player.duration || currentTrack.duration,
      }));
      
      // Synchroniser le volume et mute avec les valeurs actuelles
      const currentVol = isMuted ? 0 : volume;
      if (Math.abs(player.volume - currentVol) > 1) {
        player.setVolume(currentVol);
      }
      if (player.isMuted !== isMuted) {
        if (isMuted && !player.isMuted) {
          player.toggleMute();
        } else if (!isMuted && player.isMuted) {
          player.toggleMute();
        }
      }
      
      // Démarrer la lecture si isPlaying est true
      if (isPlaying && !player.isPlaying) {
        // Attendre un peu pour s'assurer que tout est initialisé
        setTimeout(() => {
          if (player && typeof player.play === 'function' && !player.isPlaying) {
            player.play().catch((err) => {
              console.error('[FullscreenPlayer] Erreur lors du play automatique:', err);
            });
          }
        }, 300);
      }
    }
  }, [isPlaying, currentTrack.duration, volume, isMuted]);

  // Synchroniser les contrôles avec le player YouTube et ajouter à l'historique vidéo
  useEffect(() => {
    if (isYouTube && youtubePlayerRef.current && youtubeVideoId) {
      const player = youtubePlayerRef.current;
      
      // Vérifier si le player est prêt (a une durée > 0)
      if (player.duration > 0) {
        // Synchroniser play/pause
        if (isPlaying && !player.isPlaying) {
          // Utiliser requestAnimationFrame pour s'assurer que le DOM est prêt
          requestAnimationFrame(() => {
            if (player && typeof player.play === 'function' && !player.isPlaying) {
              player.play().catch((err) => {
                console.error('[FullscreenPlayer] Erreur lors du play YouTube:', err);
              });
              
              // Ajouter la vidéo YouTube à l'historique vidéo quand elle commence à jouer
              // Émettre un événement pour que DesktopApp puisse l'ajouter à l'historique
              window.dispatchEvent(new CustomEvent('youtube-video-played', { 
                detail: { 
                  videoId: youtubeVideoId,
                  trackId: currentTrack.id,
                  title: currentTrack.title,
                } 
              }));
            }
          });
        } else if (!isPlaying && player.isPlaying) {
          player.pause();
        }
      }
    }
  }, [isPlaying, isYouTube, youtubeVideoId, currentTrack.id, currentTrack.title]);

  useEffect(() => {
    if (isYouTube && youtubePlayerRef.current) {
      // Synchroniser le volume
      const currentVol = isMuted ? 0 : volume;
      const youtubeVol = youtubePlayerRef.current.volume;
      if (Math.abs(youtubeVol - currentVol) > 1) {
        youtubePlayerRef.current.setVolume(currentVol);
      }
      
      // Synchroniser le mute
      const youtubeMuted = youtubePlayerRef.current.isMuted;
      if (youtubeMuted !== isMuted) {
        if (isMuted) {
          youtubePlayerRef.current.toggleMute();
        } else {
          youtubePlayerRef.current.toggleMute();
        }
      }
    }
  }, [volume, isMuted, isYouTube]);

  // Gérer le seek pour YouTube
  const handleSeekYouTube = useCallback((value: number[]) => {
    if (isYouTube && youtubePlayerRef.current) {
      youtubePlayerRef.current.seek(value[0]);
    } else {
      onSeek(value);
    }
  }, [isYouTube, onSeek]);
  
// Inside your component
const canvasRef = useRef<HTMLCanvasElement>(null);
const barCount = 32; // plus léger et rapide
const bars = useMemo(() => Array.from({ length: barCount }, (_, i) => i), []);

// Render FFT optimized
useEffect(() => {
  if (!audioElement) return;
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const renderFFT = () => {
    const freqData = vibesData?.frequency;
    if (!freqData) return;

    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = canvas.offsetHeight;

    ctx.clearRect(0, 0, width, height);

    const barWidth = width / barCount;

    for (let i of bars) {
      const index = Math.floor((i / barCount) * freqData.length);
      const value = freqData[index] || 0;
      const barHeight = (value / 255) * height;

      ctx.fillStyle = `rgba(59, 130, 246, ${0.2 + (value / 255) * 0.3})`;
      ctx.fillRect(i * barWidth, height - barHeight, barWidth * 0.8, barHeight);
    }
  };

  let rafId: number;
  let lastTime = 0;
  const fps = 30;
  const interval = 1000 / fps;

  const loop = (time: number) => {
    if (time - lastTime > interval) {
      lastTime = time;
      renderFFT();
    }
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);

  return () => cancelAnimationFrame(rafId);
}, [vibesData?.frequency, bars]);

  const VolumeIcon = isMuted || volume === 0 
    ? VolumeX 
    : volume < 50 
      ? Volume1 
      : Volume2;

  // Load lyrics
  useEffect(() => {
    const loadLyrics = async () => {
      if (window.electronAPI) {
        try {
          const lyricsData = await window.electronAPI.getLyrics(
            currentTrack.artist,
            currentTrack.title
          );
          setLyrics(lyricsData?.plainLyrics || null);
        } catch {
          setLyrics(null);
        }
      }
    };
    loadLyrics();
  }, [currentTrack.id, currentTrack.artist, currentTrack.title]);

  const progress = currentTrack.duration > 0 
    ? (currentTime / currentTrack.duration) * 100 
    : 0;

  // Inline mode - embedded in main content area
  if (isInline) {
    return (
      <div className="h-full w-full flex items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-300 relative">
        {/* Player YouTube en arrière-plan (masqué visuellement) pour les tracks YouTube en mode inline */}
        {isYouTube && youtubeVideoId && (
          <div 
            className="absolute inset-0 pointer-events-none" 
            style={{ 
              zIndex: 1,
              opacity: 0,
              width: '1px',
              height: '1px',
              overflow: 'hidden',
            }}
          >
            <YouTubePlayer
              ref={youtubePlayerRef}
              videoId={youtubeVideoId}
              autoPlay={isPlaying}
              audioOnly={true}
              onStateChange={handleYouTubeStateChange}
              onTimeUpdate={handleYouTubeTimeUpdate}
              onReady={handleYouTubeReady}
              className="w-full h-full"
            />
          </div>
        )}
        
        <div className="flex flex-col items-center justify-center w-full relative z-10">
          {/* Album Art with glow effect */}
          <div className="relative mb-6 flex items-center justify-center">
            <div 
              className="absolute inset-0 blur-3xl opacity-30 scale-150"
              style={{
                backgroundImage: `url(${getCoverUrl(currentTrack.coverUrl)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
            <AlbumArt
              src={getCoverUrl(currentTrack.coverUrl)}
              alt={currentTrack.album}
              isPlaying={isYouTube ? youtubeState.isPlaying : isPlaying}
              className="w-64 h-64 relative z-10"
            />
          </div>

          {/* Track Info */}
          <div className="text-center w-full px-4">
            <h1 className="font-display text-2xl font-bold mb-1 text-foreground truncate max-w-md mx-auto">
              {currentTrack.title}
            </h1>
            <p className="text-lg text-muted-foreground truncate max-w-md mx-auto">
              {currentTrack.artist}
            </p>
            <p className="text-sm text-muted-foreground/70 truncate max-w-md mx-auto">
              {currentTrack.album}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Fullscreen mode
  return (
    <div className="fixed inset-0 z-[10000] bg-background flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
      <BackgroundEffects />
      
      {/* Main Panel - Background with album cover and FFT */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Player YouTube - visible pour les vidéos, masqué pour l'audio */}
        {isYouTube && youtubeVideoId && (
          <div 
            className="absolute inset-0" 
            style={{ 
              zIndex: 1,
            }}
          >
            <YouTubePlayer
              ref={youtubePlayerRef}
              videoId={youtubeVideoId}
              autoPlay={isPlaying}
              audioOnly={false} // Mode vidéo visible pour fullscreen
              onStateChange={handleYouTubeStateChange}
              onTimeUpdate={handleYouTubeTimeUpdate}
              onReady={handleYouTubeReady}
              className="w-full h-full"
            />
          </div>
        )}
        
        {/* Album cover background - blurred and faded (seulement pour non-YouTube) */}
        {!isYouTube && (
          <div 
            className="absolute inset-0 opacity-20 blur-3xl scale-150 transition-opacity duration-500"
            style={{
              backgroundImage: `url(${getCoverUrl(currentTrack.coverUrl)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              zIndex: 2,
            }}
          />
        )}
        
        {/* FFT Visualizer - Full width, reduced height and opacity (seulement pour non-YouTube) */}
        {!isYouTube && (
          <canvas
            ref={canvasRef}
            className="absolute bottom-0 left-0 right-0 w-full opacity-20"
            style={{ 
              height: '20%',
              imageRendering: 'pixelated',
              zIndex: 2,
            }}
          />
        )}
      </div>

      {/* Overlay avec contrôles Nexus superposés sur YouTube */}
      {/* L'iframe YouTube est en z-1, les contrôles Nexus sont en z-30+ */}
      {/* Le YouTubePlayer gère déjà l'overlay pour permettre le clic droit */}

      {/* Header */}
      <div className="relative z-30 flex items-center justify-between p-6">
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground backdrop-blur-sm bg-background/30"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
        <div className="text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            En Lecture
          </p>
        </div>
        <button
          onClick={onToggleFavorite}
          className={cn(
            "p-2 rounded-full transition-all duration-200 backdrop-blur-sm bg-background/30",
            isFavorite 
              ? "text-red-500" 
              : "text-muted-foreground hover:text-red-500"
          )}
        >
          <Heart className={cn("w-6 h-6", isFavorite && "fill-current")} />
        </button>
      </div>

      {/* Panneau latéral avec tous les éléments */}
      <div className="absolute right-0 top-0 bottom-0 z-30 w-96 backdrop-blur-xl bg-background/20 border-l border-border/30 p-6 flex flex-col">
        {/* Album Art */}
        <div className="flex items-center justify-center mb-6">
          <AlbumArt
            src={getCoverUrl(currentTrack.coverUrl)}
            alt={currentTrack.album}
            isPlaying={isPlaying}
            className="w-64 h-64"
          />
        </div>

        {/* Track Info */}
        <div className="text-center mb-6">
          <h1 className="font-display text-2xl font-bold mb-2 text-foreground">
            {currentTrack.title}
          </h1>
          <p className="text-lg text-muted-foreground mb-1">
            {currentTrack.artist}
          </p>
          <p className="text-sm text-muted-foreground/70">
            {currentTrack.album}
          </p>
        </div>


        {/* Controls - Déplacés dans le panneau latéral */}
        <div className="mt-auto flex flex-col gap-4">
          {/* Progress Bar */}
          <div className="w-full mb-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-muted-foreground w-10 text-right font-mono">
                {formatTime(isYouTube ? youtubeState.currentTime : currentTime)}
              </span>
              <Slider
                value={[isYouTube ? youtubeState.currentTime : currentTime]}
                max={isYouTube ? youtubeState.duration || currentTrack.duration : currentTrack.duration}
                step={1}
                onValueChange={handleSeekYouTube}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-10 font-mono">
                {formatTime(currentTrack.duration)}
              </span>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-3 w-full">
            <button
              onClick={onShuffle}
              className={cn(
                "p-2 rounded-full transition-all duration-200 backdrop-blur-sm bg-background/30",
                isShuffle 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Shuffle className="w-4 h-4" />
            </button>
            
            <button
              onClick={onPrevious}
              className="p-2 text-foreground hover:text-primary transition-colors backdrop-blur-sm bg-background/30 rounded-full"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>
            
            <button
              onClick={onPlayPause}
              className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 shadow-lg transition-all duration-200 backdrop-blur-sm"
            >
              {(isYouTube ? (youtubeState.isPlaying || false) : isPlaying) ? (
                <Pause className="w-6 h-6 fill-current" />
              ) : (
                <Play className="w-6 h-6 fill-current ml-0.5" />
              )}
            </button>
            
            <button
              onClick={onNext}
              className="p-2 text-foreground hover:text-primary transition-colors backdrop-blur-sm bg-background/30 rounded-full"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
            
            <button
              onClick={onRepeat}
              className={cn(
                "p-2 rounded-full transition-all duration-200 backdrop-blur-sm bg-background/30",
                repeatMode !== "off" 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {repeatMode === "one" ? (
                <Repeat1 className="w-4 h-4" />
              ) : (
                <Repeat className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center justify-center gap-2 w-full">
            <button
              onClick={onMuteToggle}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors backdrop-blur-sm bg-background/30 rounded-full"
            >
              <VolumeIcon className="w-4 h-4" />
            </button>
            <Slider
              value={[isMuted ? 0 : volume]}
              max={100}
              step={1}
              onValueChange={onVolumeChange}
              className="flex-1"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
