import { useState } from "react";
import { 
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
  ListMusic,
  Maximize2,
  Mic2
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Track } from "@/types/music";

interface NowPlayingBarProps {
  currentTrack: Track;
  isPlaying: boolean;
  currentTime: number;
  isShuffle: boolean;
  repeatMode: "off" | "all" | "one";
  volume: number;
  isMuted: boolean;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onShuffle: () => void;
  onRepeat: () => void;
  onSeek: (value: number[]) => void;
  onVolumeChange: (value: number[]) => void;
  onMuteToggle: () => void;
  onToggleQueue: () => void;
  onFullscreen: () => void;
  isQueueOpen: boolean;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const NowPlayingBar = ({
  currentTrack,
  isPlaying,
  currentTime,
  isShuffle,
  repeatMode,
  volume,
  isMuted,
  onPlayPause,
  onPrevious,
  onNext,
  onShuffle,
  onRepeat,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onToggleQueue,
  onFullscreen,
  isQueueOpen,
}: NowPlayingBarProps) => {
  const [isLiked, setIsLiked] = useState(false);

  const VolumeIcon = isMuted || volume === 0 
    ? VolumeX 
    : volume < 50 
      ? Volume1 
      : Volume2;

  return (
    <div className="h-20 bg-card border-t border-border flex items-center px-4 gap-4">
      {/* Track Info */}
      <div className="w-72 flex items-center gap-3">
        <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0 relative group">
          <img 
            src={currentTrack.coverUrl || "/placeholder.svg"} 
            alt={currentTrack.album}
            className="w-full h-full object-cover"
          />
          <button
            onClick={onFullscreen}
            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Maximize2 className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate text-foreground">
            {currentTrack.title}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {currentTrack.artist}
          </p>
        </div>
        <button
          onClick={() => setIsLiked(!isLiked)}
          className={cn(
            "p-2 rounded-full transition-all duration-200",
            isLiked 
              ? "text-secondary glow-magenta" 
              : "text-muted-foreground hover:text-secondary"
          )}
        >
          <Heart className={cn("w-4 h-4", isLiked && "fill-current")} />
        </button>
      </div>

      {/* Player Controls */}
      <div className="flex-1 flex flex-col items-center gap-2 max-w-2xl">
        <div className="flex items-center gap-4">
          <button
            onClick={onShuffle}
            className={cn(
              "p-2 rounded-full transition-all duration-200",
              isShuffle 
                ? "text-primary glow-cyan" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Shuffle className="w-4 h-4" />
          </button>
          
          <button
            onClick={onPrevious}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>
          
          <button
            onClick={onPlayPause}
            className="w-10 h-10 rounded-full bg-primary/20 text-primary border border-primary/50 flex items-center justify-center hover:bg-primary/30 hover:glow-cyan transition-all duration-200"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>
          
          <button
            onClick={onNext}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
          
          <button
            onClick={onRepeat}
            className={cn(
              "p-2 rounded-full transition-all duration-200",
              repeatMode !== "off" 
                ? "text-primary glow-cyan" 
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

        {/* Progress Bar */}
        <div className="w-full flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-10 text-right font-display">
            {formatTime(currentTime)}
          </span>
          <Slider
            value={[currentTime]}
            max={currentTrack.duration}
            step={1}
            onValueChange={onSeek}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground w-10 font-display">
            {formatTime(currentTrack.duration)}
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="w-72 flex items-center justify-end gap-2">
        <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
          <Mic2 className="w-4 h-4" />
        </button>
        
        <button
          onClick={onToggleQueue}
          className={cn(
            "p-2 rounded-full transition-all duration-200",
            isQueueOpen 
              ? "text-primary glow-cyan" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ListMusic className="w-4 h-4" />
        </button>
        
        <div className="flex items-center gap-2 w-32">
          <button
            onClick={onMuteToggle}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
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

        <button
          onClick={onFullscreen}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
