import { useState, useEffect, useMemo, useRef } from "react";
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
  
  // Use FFT data for visualization
  const vibesData = useAudioVibes(audioElement, {
    fftSize: 1024, // Reduced from 2048 for better performance
    enableBassFilter: false,
  });
  
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
      <div className="h-full w-full flex items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex flex-col items-center justify-center w-full">
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
              isPlaying={isPlaying}
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
        {/* Album cover background - blurred and faded */}
        <div 
          className="absolute inset-0 opacity-20 blur-3xl scale-150 transition-opacity duration-500"
          style={{
            backgroundImage: `url(${getCoverUrl(currentTrack.coverUrl)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        
        {/* FFT Visualizer - Full width, reduced height and opacity */}
        <canvas
          ref={canvasRef}
          className="absolute bottom-0 left-0 right-0 w-full opacity-20"
          style={{ 
            height: '20%',
            imageRendering: 'pixelated' 
          }}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between p-6">
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
      <div className="absolute right-0 top-0 bottom-0 z-10 w-96 backdrop-blur-xl bg-background/20 border-l border-border/30 p-6 flex flex-col">
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
                {formatTime(currentTime)}
              </span>
              <Slider
                value={[currentTime]}
                max={currentTrack.duration}
                step={1}
                onValueChange={onSeek}
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
              {isPlaying ? (
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
