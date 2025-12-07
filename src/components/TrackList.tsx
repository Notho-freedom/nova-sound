import { Music, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { Track } from "@/types/music";

interface TrackListProps {
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onTrackSelect: (index: number) => void;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const TrackList = ({ 
  tracks, 
  currentTrackIndex, 
  isPlaying, 
  onTrackSelect 
}: TrackListProps) => {
  return (
    <div className="h-full overflow-y-auto space-y-1 pr-2">
      {tracks.map((track, index) => (
        <div
          key={track.id}
          onClick={() => onTrackSelect(index)}
          className={cn(
            "track-item group flex items-center gap-4",
            index === currentTrackIndex && "active"
          )}
        >
          {/* Track number / Play indicator */}
          <div className="w-8 h-8 flex items-center justify-center relative">
            {index === currentTrackIndex && isPlaying ? (
              <div className="flex gap-[2px] items-end h-4">
                {[1, 2, 3].map((bar) => (
                  <div
                    key={bar}
                    className="w-[3px] bg-primary rounded-full animate-wave"
                    style={{ 
                      height: "100%",
                      animationDelay: `${bar * 0.15}s` 
                    }}
                  />
                ))}
              </div>
            ) : (
              <>
                <span className="text-sm text-muted-foreground group-hover:hidden font-display">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Play 
                  className="w-4 h-4 hidden group-hover:block text-primary" 
                  fill="currentColor"
                />
              </>
            )}
          </div>
          
          {/* Track info */}
          <div className="flex-1 min-w-0">
            <p className={cn(
              "font-medium truncate transition-colors",
              index === currentTrackIndex ? "text-primary neon-text-cyan" : "text-foreground"
            )}>
              {track.title}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {track.artist}
            </p>
          </div>
          
          {/* Duration */}
          <span className="text-sm text-muted-foreground font-display">
            {formatDuration(track.duration)}
          </span>
        </div>
      ))}
    </div>
  );
};
