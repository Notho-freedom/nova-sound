import { useState, useEffect, useRef } from "react";
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
  X,
  Film,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Video } from "@/types/music";
import { useVideoPlayer } from "@/hooks/useVideoPlayer";

interface CinemaModeProps {
  video: Video;
  videos?: Video[];
  onClose?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  className?: string;
  autoPlay?: boolean;
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

export const CinemaMode = ({
  video,
  videos = [],
  onClose,
  onNext,
  onPrevious,
  className,
  autoPlay = false,
}: CinemaModeProps) => {
  const [showControls, setShowControls] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isLoading,
    playbackRate,
    playVideo,
    togglePlayPause,
    seek,
    setVolume,
    toggleMute,
    setPlaybackRate,
    videoRef,
  } = useVideoPlayer(videos);

  // Set the current video and auto-play if requested
  useEffect(() => {
    if (video) {
      playVideo(video);
    }
  }, [video, playVideo]);

  // Show/hide controls on mouse movement
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) {
          setShowControls(false);
        }
      }, 4000);
    };

    const handleMouseLeave = () => {
      if (isPlaying) {
        setShowControls(false);
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
  }, [isPlaying]);

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
        case "m":
        case "M":
          e.preventDefault();
          toggleMute();
          break;
        case "Escape":
          if (onClose) {
            onClose();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlayPause, seek, currentTime, duration, setVolume, volume, toggleMute, onClose]);

  const handleSeek = (value: number[]) => {
    seek(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
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
      ref={containerRef}
      className={cn(
        "fixed inset-0 z-[9999]",
        "bg-background",
        "animate-in fade-in duration-500",
        className
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Ambient Background Effect - Theme aware */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background opacity-90" />
        <div 
          className="absolute inset-0 opacity-40"
          style={{
            background: 'radial-gradient(circle at center, hsl(var(--primary) / 0.15) 0%, transparent 60%)'
          }}
        />
        <div 
          className="absolute inset-0 opacity-20 animate-spin-slow"
          style={{
            background: 'conic-gradient(from 0deg at 50% 50%, transparent 0deg, hsl(var(--primary) / 0.1) 60deg, transparent 120deg)'
          }}
        />
      </div>

      {/* Video Element - Full screen */}
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          style={{
            filter: "brightness(1.02) contrast(1.05) saturate(1.05)",
          }}
          playsInline
          preload="metadata"
          onClick={togglePlayPause}
        />
        
        {/* Subtle film grain overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.02] mix-blend-overlay">
          <div className="w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZmlsdGVyIGlkPSJub2lzZSI+PGZlVHVyYnVsZW5jZSBiYXNlRnJlcXVlbmN5PSIwLjkiIG51bU9jdGF2ZXM9IjQiLz48ZmVDb2xvck1hdHJpeCB0eXBlPSJzYXR1cmF0ZSIgdmFsdWVzPSIwIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbHRlcj0idXJsKCNub2lzZSkiIG9wYWNpdHk9IjAuNSIvPjwvc3ZnPg==')] bg-repeat" />
        </div>
      </div>

      {/* Loading Indicator - Vision Pro style */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-xl z-50">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <div className="absolute inset-0 w-20 h-20 border-4 border-transparent border-b-accent/50 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          </div>
        </div>
      )}

      {/* Controls Overlay - Vision Pro glassmorphism */}
      {(showControls || isHovering || !isPlaying) && (
        <div className="absolute inset-0 flex flex-col justify-between transition-opacity duration-300 z-40">
          {/* Top gradient overlay */}
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none" />
          
          {/* Bottom gradient overlay */}
          <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
          
          {/* Top Controls */}
          <div className="relative flex items-center justify-between p-6 pointer-events-auto">
            <div className="flex items-center gap-3">
              {onClose && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className={cn(
                    "w-11 h-11 rounded-xl",
                    "bg-white/10 hover:bg-white/20 backdrop-blur-xl",
                    "border border-white/20 hover:border-white/30",
                    "text-white transition-all duration-200",
                    "shadow-lg shadow-black/20"
                  )}
                >
                  <X className="w-5 h-5" />
                </Button>
              )}
              <div className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl",
                "bg-white/10 backdrop-blur-xl",
                "border border-white/20"
              )}>
                <Film className="w-4 h-4 text-primary" />
                <span className="text-sm text-white font-medium">Mode Ciné</span>
              </div>
            </div>
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl",
              "bg-white/10 backdrop-blur-xl",
              "border border-white/20"
            )}>
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-xs text-white/80">Immersif</span>
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
              className={cn(
                "w-24 h-24 rounded-full pointer-events-auto",
                "bg-white/10 hover:bg-white/20 backdrop-blur-xl",
                "border border-white/30 hover:border-white/50",
                "text-white transition-all duration-300",
                "shadow-2xl shadow-black/40",
                "hover:scale-110 active:scale-95"
              )}
            >
              {isPlaying ? (
                <Pause className="w-12 h-12 fill-current" />
              ) : (
                <Play className="w-12 h-12 fill-current ml-1" />
              )}
            </Button>
          </div>

          {/* Bottom Controls */}
          <div className="relative space-y-4 p-6 pointer-events-auto">
            {/* Progress Bar */}
            <div className="flex items-center gap-4">
              <span className="text-white/90 text-sm font-mono min-w-[70px] text-right tabular-nums">
                {formatTime(currentTime)}
              </span>
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={1}
                onValueChange={handleSeek}
                className="flex-1"
              />
              <span className="text-white/90 text-sm font-mono min-w-[70px] tabular-nums">
                {formatTime(duration)}
              </span>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {onPrevious && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onPrevious}
                    className={cn(
                      "w-12 h-12 rounded-xl",
                      "bg-white/10 hover:bg-white/20 backdrop-blur-xl",
                      "border border-white/20",
                      "text-white transition-all duration-200"
                    )}
                    disabled={!videos.length}
                  >
                    <SkipBack className="w-6 h-6" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={togglePlayPause}
                  className={cn(
                    "w-14 h-14 rounded-xl",
                    "bg-white/10 hover:bg-white/20 backdrop-blur-xl",
                    "border border-white/20",
                    "text-white transition-all duration-200"
                  )}
                >
                  {isPlaying ? (
                    <Pause className="w-7 h-7 fill-current" />
                  ) : (
                    <Play className="w-7 h-7 fill-current" />
                  )}
                </Button>
                {onNext && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onNext}
                    className={cn(
                      "w-12 h-12 rounded-xl",
                      "bg-white/10 hover:bg-white/20 backdrop-blur-xl",
                      "border border-white/20",
                      "text-white transition-all duration-200"
                    )}
                    disabled={!videos.length}
                  >
                    <SkipForward className="w-6 h-6" />
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-4">
                {/* Volume Control */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleMute}
                    className={cn(
                      "w-10 h-10 rounded-xl",
                      "bg-white/10 hover:bg-white/20 backdrop-blur-xl",
                      "border border-white/20",
                      "text-white transition-all duration-200"
                    )}
                  >
                    <VolumeIcon className="w-5 h-5" />
                  </Button>
                  <Slider
                    value={[volume]}
                    max={100}
                    step={1}
                    onValueChange={handleVolumeChange}
                    className="w-32"
                  />
                </div>

                {/* Playback Rate */}
                <select
                  value={playbackRate}
                  onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                  className={cn(
                    "h-10 px-4 text-sm rounded-xl",
                    "bg-white/10 hover:bg-white/20 backdrop-blur-xl",
                    "text-white border border-white/20",
                    "focus:outline-none focus:ring-2 focus:ring-primary/50",
                    "transition-all duration-200"
                  )}
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

            {/* Video Info - Glass panel */}
            <div className={cn(
              "mt-2 p-4 rounded-2xl",
              "bg-white/5 backdrop-blur-xl",
              "border border-white/10"
            )}>
              <h3 className="font-semibold text-base text-white truncate">{video.title}</h3>
              {video.width && video.height && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 text-xs text-white/70">
                    {video.width} × {video.height}
                  </span>
                  {video.format && (
                    <span className="px-2.5 py-1 rounded-lg bg-white/10 text-xs text-white/70">
                      {video.format.toUpperCase()}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

