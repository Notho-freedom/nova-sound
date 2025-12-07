import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";

interface PlayerControlsProps {
  isPlaying: boolean;
  isShuffle: boolean;
  repeatMode: "off" | "all" | "one";
  volume: number;
  isMuted: boolean;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onShuffle: () => void;
  onRepeat: () => void;
  onVolumeChange: (value: number[]) => void;
  onMuteToggle: () => void;
}

export const PlayerControls = ({
  isPlaying,
  isShuffle,
  repeatMode,
  volume,
  isMuted,
  onPlayPause,
  onPrevious,
  onNext,
  onShuffle,
  onRepeat,
  onVolumeChange,
  onMuteToggle,
}: PlayerControlsProps) => {
  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Main controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={onShuffle}
          className={cn(
            "control-button",
            isShuffle && "text-primary glow-cyan"
          )}
        >
          <Shuffle className="w-5 h-5" />
        </button>
        
        <button onClick={onPrevious} className="control-button">
          <SkipBack className="w-6 h-6" fill="currentColor" />
        </button>
        
        <button
          onClick={onPlayPause}
          className={cn(
            "control-button-main",
            isPlaying && "animate-pulse-neon"
          )}
        >
          {isPlaying ? (
            <Pause className="w-8 h-8" fill="currentColor" />
          ) : (
            <Play className="w-8 h-8 ml-1" fill="currentColor" />
          )}
        </button>
        
        <button onClick={onNext} className="control-button">
          <SkipForward className="w-6 h-6" fill="currentColor" />
        </button>
        
        <button
          onClick={onRepeat}
          className={cn(
            "control-button relative",
            repeatMode !== "off" && "text-primary glow-cyan"
          )}
        >
          <Repeat className="w-5 h-5" />
          {repeatMode === "one" && (
            <span className="absolute -top-1 -right-1 text-[10px] font-display text-primary">1</span>
          )}
        </button>
      </div>
      
      {/* Volume control */}
      <div className="flex items-center gap-3 w-full max-w-xs mx-auto">
        <button onClick={onMuteToggle} className="control-button p-2">
          {isMuted || volume === 0 ? (
            <VolumeX className="w-5 h-5" />
          ) : (
            <Volume2 className="w-5 h-5" />
          )}
        </button>
        
        <Slider
          value={[isMuted ? 0 : volume]}
          onValueChange={onVolumeChange}
          max={100}
          step={1}
          className="flex-1"
        />
        
        <span className="text-xs font-display text-muted-foreground w-8 text-right">
          {isMuted ? 0 : volume}
        </span>
      </div>
    </div>
  );
};
