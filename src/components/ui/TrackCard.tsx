"use client";

import { Play, Pause, MoreHorizontal, Cloud, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { Track } from "@/types/music";

interface TrackCardProps {
  track: Track;
  isPlaying?: boolean;
  isCurrent?: boolean;
  variant?: "compact" | "default" | "large";
  showUploadStatus?: boolean;
  uploadProvider?: "cloudinary" | "nexus" | "bunny" | "planethoster" | null;
  onPlay: () => void;
  onContextMenu?: () => void;
  className?: string;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const TrackCard = ({
  track,
  isPlaying = false,
  isCurrent = false,
  variant = "default",
  showUploadStatus = false,
  uploadProvider,
  onPlay,
  onContextMenu,
  className,
}: TrackCardProps) => {
  const sizeClasses = {
    compact: {
      container: "p-2",
      image: "w-10 h-10",
      title: "text-xs",
      subtitle: "text-[10px]",
    },
    default: {
      container: "p-4",
      image: "w-12 h-12",
      title: "text-sm",
      subtitle: "text-xs",
    },
    large: {
      container: "p-5",
      image: "w-16 h-16",
      title: "text-base",
      subtitle: "text-sm",
    },
  };

  const sizes = sizeClasses[variant];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onPlay}
          onContextMenu={(e) => {
            e.preventDefault();
            onContextMenu?.();
          }}
          className={cn(
            "group relative overflow-hidden rounded-xl bg-card/50 backdrop-blur-sm text-left transition-all duration-200 ease-out w-full",
            "hover:bg-card hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98]",
            isCurrent && isPlaying && "ring-2 ring-primary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
            sizes.container,
            className
          )}
        >
          <div className="flex items-center gap-3">
            {/* Album art */}
            <div className={cn("rounded-lg overflow-hidden flex-shrink-0 relative", sizes.image)}>
              <img
                src={getCoverUrl(track.coverUrl)}
                alt={track.album || track.title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-200 ease-out group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out">
                {isCurrent && isPlaying ? (
                  <Pause className="w-5 h-5 text-white fill-current" />
                ) : (
                  <Play className="w-5 h-5 text-white fill-current" />
                )}
              </div>
              
              {/* Now playing indicator */}
              {isCurrent && isPlaying && (
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5">
                  <div className="w-0.5 h-2 bg-primary rounded-full animate-wave" />
                  <div className="w-0.5 h-2 bg-primary rounded-full animate-wave" style={{ animationDelay: "0.1s" }} />
                  <div className="w-0.5 h-2 bg-primary rounded-full animate-wave" style={{ animationDelay: "0.2s" }} />
                </div>
              )}
            </div>

            {/* Track info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={cn(
                  "font-medium truncate",
                  sizes.title,
                  isCurrent ? "text-primary" : "text-foreground"
                )}>
                  {track.title}
                </p>
                {showUploadStatus && uploadProvider && (
                  <div className="flex-shrink-0">
                    <Cloud className="w-3 h-3 text-green-500" />
                  </div>
                )}
              </div>
              <p className={cn("text-muted-foreground truncate", sizes.subtitle)}>
                {track.artist}
              </p>
              {variant === "large" && track.album && (
                <p className={cn("text-muted-foreground/70 truncate mt-0.5", sizes.subtitle)}>
                  {track.album}
                </p>
              )}
            </div>

            {/* Duration */}
            {variant !== "compact" && (
              <div className="flex-shrink-0 text-muted-foreground">
                <span className={cn("font-mono", sizes.subtitle)}>
                  {formatTime(track.duration)}
                </span>
              </div>
            )}
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-sm font-medium">{track.title}</div>
        <div className="text-xs text-muted-foreground">{track.artist}</div>
        {track.album && <div className="text-xs text-muted-foreground mt-1">{track.album}</div>}
        <div className="text-xs text-muted-foreground mt-1">{formatTime(track.duration)}</div>
      </TooltipContent>
    </Tooltip>
  );
};
