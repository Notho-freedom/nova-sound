import { useState } from "react";
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
  ChevronDown
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { AlbumArt } from "./AlbumArt";
import { AudioVisualizer } from "./AudioVisualizer";
import { BackgroundEffects } from "./BackgroundEffects";
import { Track } from "@/types/music";
import { cn } from "@/lib/utils";

interface FullscreenPlayerProps {
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
  onClose: () => void;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const FullscreenPlayer = ({
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
  onClose,
}: FullscreenPlayerProps) => {
  const [isLiked, setIsLiked] = useState(false);

  const VolumeIcon = isMuted || volume === 0 
    ? VolumeX 
    : volume < 50 
      ? Volume1 
      : Volume2;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
      <BackgroundEffects />
      
      {/* Background blur from album art */}
      <div 
        className="absolute inset-0 opacity-30 blur-3xl scale-150"
        style={{
          backgroundImage: `url(${currentTrack.coverUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between p-6">
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
        <div className="text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            En Lecture
          </p>
          <p className="text-sm text-foreground">{currentTrack.album}</p>
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
          <Heart className={cn("w-6 h-6", isLiked && "fill-current")} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-8">
        {/* Album Art */}
        <AlbumArt
          src={currentTrack.coverUrl || "/placeholder.svg"}
          alt={currentTrack.album}
          isPlaying={isPlaying}
          className="w-72 h-72 md:w-80 md:h-80 lg:w-96 lg:h-96 mb-8"
        />

        {/* Track Info */}
        <div className="text-center mb-6">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2 text-foreground neon-text-cyan">
            {currentTrack.title}
          </h1>
          <p className="text-xl text-muted-foreground">
            {currentTrack.artist}
          </p>
        </div>

        {/* Visualizer */}
        <div className="w-full max-w-2xl mb-8">
          <AudioVisualizer isPlaying={isPlaying} barCount={60} />
        </div>
      </div>

      {/* Controls */}
      <div className="relative z-10 p-8 glass-strong">
        {/* Progress Bar */}
        <div className="max-w-2xl mx-auto mb-6">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-12 text-right font-display">
              {formatTime(currentTime)}
            </span>
            <Slider
              value={[currentTime]}
              max={currentTrack.duration}
              step={1}
              onValueChange={onSeek}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground w-12 font-display">
              {formatTime(currentTrack.duration)}
            </span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-6 mb-6">
          <button
            onClick={onShuffle}
            className={cn(
              "p-3 rounded-full transition-all duration-200",
              isShuffle 
                ? "text-primary glow-cyan" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Shuffle className="w-5 h-5" />
          </button>
          
          <button
            onClick={onPrevious}
            className="p-3 text-foreground hover:text-primary transition-colors"
          >
            <SkipBack className="w-8 h-8 fill-current" />
          </button>
          
          <button
            onClick={onPlayPause}
            className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 glow-cyan transition-all duration-200"
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 fill-current" />
            ) : (
              <Play className="w-8 h-8 fill-current ml-1" />
            )}
          </button>
          
          <button
            onClick={onNext}
            className="p-3 text-foreground hover:text-primary transition-colors"
          >
            <SkipForward className="w-8 h-8 fill-current" />
          </button>
          
          <button
            onClick={onRepeat}
            className={cn(
              "p-3 rounded-full transition-all duration-200",
              repeatMode !== "off" 
                ? "text-primary glow-cyan" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {repeatMode === "one" ? (
              <Repeat1 className="w-5 h-5" />
            ) : (
              <Repeat className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onMuteToggle}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <VolumeIcon className="w-5 h-5" />
          </button>
          <Slider
            value={[isMuted ? 0 : volume]}
            max={100}
            step={1}
            onValueChange={onVolumeChange}
            className="w-32"
          />
        </div>
      </div>
    </div>
  );
};
