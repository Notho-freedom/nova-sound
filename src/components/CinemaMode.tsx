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
    const isElectron = !!window.electronAPI;
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
        "fixed inset-0 z-[9999] bg-black",
        "animate-in fade-in duration-500",
        className
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Ambient Background Effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/95 to-black opacity-80" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-50" />
        <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,_transparent_0deg,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-30 animate-spin-slow" />
      </div>

      {/* Video Element - Centered and scaled */}
      <div className="absolute inset-0 flex items-center justify-center p-8">
        <div className="relative w-full h-full max-w-[95vw] max-h-[95vh] flex items-center justify-center">
          <video
            ref={videoRef}
            className="w-full h-full object-contain rounded-lg shadow-2xl"
            style={{
              filter: "brightness(1.05) contrast(1.1) saturate(1.1)",
            }}
            playsInline
            preload="metadata"
            onClick={togglePlayPause}
          />
          
          {/* Film grain overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-overlay">
            <div className="w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZmlsdGVyIGlkPSJub2lzZSI+PGZlVHVyYnVsZW5jZSBiYXNlRnJlcXVlbmN5PSIwLjkiIG51bU9jdGF2ZXM9IjQiLz48ZmVDb2xvck1hdHJpeCB0eXBlPSJzYXR1cmF0ZSIgdmFsdWVzPSIwIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbHRlcj0idXJsKCNub2lzZSkiIG9wYWNpdHk9IjAuNSIvPjwvc3ZnPg==')] bg-repeat" />
          </div>
        </div>
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-white/80 text-sm">Chargement...</p>
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      {(showControls || isHovering || !isPlaying) && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-between p-6 transition-opacity duration-300 z-40">
          {/* Top Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onClose && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-white hover:bg-white/20 backdrop-blur-sm transition-all duration-200 ease-out active:scale-95"
                >
                  <X className="w-5 h-5" />
                </Button>
              )}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 backdrop-blur-md border border-white/10">
                <Film className="w-4 h-4 text-primary" />
                <span className="text-sm text-white font-medium">Mode Ciné</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 backdrop-blur-md border border-white/10">
                <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                <span className="text-xs text-white/80">Immersif</span>
              </div>
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
              className="w-24 h-24 rounded-full bg-white/10 hover:bg-white/20 text-white pointer-events-auto backdrop-blur-md border border-white/20 transition-all duration-200 ease-out hover:scale-110 active:scale-95"
            >
              {isPlaying ? (
                <Pause className="w-12 h-12 fill-current" />
              ) : (
                <Play className="w-12 h-12 fill-current ml-1" />
              )}
            </Button>
          </div>

          {/* Bottom Controls */}
          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="flex items-center gap-4">
              <span className="text-white text-sm font-mono min-w-[70px] text-right">
                {formatTime(currentTime)}
              </span>
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={1}
                onValueChange={handleSeek}
                className="flex-1"
              />
              <span className="text-white text-sm font-mono min-w-[70px]">
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
                    className="text-white hover:bg-white/20 backdrop-blur-sm transition-all duration-200 ease-out active:scale-95"
                    disabled={!videos.length}
                  >
                    <SkipBack className="w-6 h-6" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={togglePlayPause}
                  className="text-white hover:bg-white/20 backdrop-blur-sm transition-all duration-200 ease-out active:scale-95 w-12 h-12"
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 fill-current" />
                  ) : (
                    <Play className="w-6 h-6 fill-current" />
                  )}
                </Button>
                {onNext && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onNext}
                    className="text-white hover:bg-white/20 backdrop-blur-sm transition-all duration-200 ease-out active:scale-95"
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
                    className="text-white hover:bg-white/20 backdrop-blur-sm transition-all duration-200 ease-out active:scale-95"
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
                  className="bg-white/10 backdrop-blur-md text-white text-sm rounded-lg px-3 py-1.5 border border-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200"
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

            {/* Video Info */}
            <div className="text-white">
              <h3 className="font-semibold text-base truncate">{video.title}</h3>
              {video.width && video.height && (
                <p className="text-xs text-white/70 mt-1">
                  {video.width} × {video.height} • {video.format?.toUpperCase()}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

