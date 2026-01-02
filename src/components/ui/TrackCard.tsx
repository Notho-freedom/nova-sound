"use client";

import { memo, useState, useCallback } from "react";
import { Play, Pause, Cloud } from "lucide-react";
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
  onNavigateToArtist?: (artist: string) => void;
  onNavigateToAlbum?: (album: string, artist: string) => void;
  className?: string;
  index?: number;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const sizeClasses = {
  compact: {
    container: "p-2",
    image: "w-10 h-10",
    title: "text-xs",
    subtitle: "text-[10px]",
    playButton: "w-8 h-8",
    playIcon: "w-3 h-3",
  },
  default: {
    container: "p-0",
    image: "w-full aspect-square",
    title: "text-sm",
    subtitle: "text-xs",
    playButton: "w-12 h-12",
    playIcon: "w-5 h-5",
  },
  large: {
    container: "p-0",
    image: "w-full aspect-square",
    title: "text-base",
    subtitle: "text-sm",
    playButton: "w-14 h-14",
    playIcon: "w-6 h-6",
  },
} as const;

// Wave bars component - memoized
const WaveBars = memo(({ className }: { className?: string }) => (
  <div className={cn("flex items-center gap-0.5", className)}>
    <div className="w-0.5 h-2 bg-primary rounded-full animate-wave" />
    <div className="w-0.5 h-2 bg-primary rounded-full animate-wave" style={{ animationDelay: "0.1s" }} />
    <div className="w-0.5 h-2 bg-primary rounded-full animate-wave" style={{ animationDelay: "0.2s" }} />
  </div>
));
WaveBars.displayName = "WaveBars";

// Compact variant component
const CompactTrackCard = memo(
  ({
    track,
    isPlaying,
    isCurrent,
    showUploadStatus,
    uploadProvider,
    onPlay,
    onContextMenu,
    onNavigateToArtist,
    onNavigateToAlbum,
    className,
  }: Omit<TrackCardProps, "variant" | "index">) => {
    const sizes = sizeClasses.compact;

    const handleContextMenu = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.();
      },
      [onContextMenu],
    );

    return (
      <Tooltip>
        <TooltipTrigger asChild>
        <button
          onClick={onPlay}
          onContextMenu={handleContextMenu}
          className={cn(
            "group relative overflow-hidden rounded-xl bg-card/50 backdrop-blur-sm text-left transition-all duration-200 ease-out w-full",
            "hover:bg-card hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98]",
            isCurrent && isPlaying && "ring-2 ring-primary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
            sizes.container,
            className,
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn("rounded-lg overflow-hidden flex-shrink-0 relative", sizes.image)}>
              <img
                src={getCoverUrl(track.coverUrl)}
                alt={track.album || track.title}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-200 ease-out group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out">
                {isCurrent && isPlaying ? (
                  <Pause className="w-5 h-5 text-white fill-current" />
                ) : (
                  <Play className="w-5 h-5 text-white fill-current" />
                )}
              </div>
              {isCurrent && isPlaying && <WaveBars className="absolute bottom-1 left-1/2 -translate-x-1/2" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p
                  className={cn("font-medium truncate", sizes.title, isCurrent ? "text-primary" : "text-foreground")}
                >
                  {track.title}
                </p>
                {showUploadStatus && uploadProvider && (
                  <Cloud className="w-3 h-3 text-green-500 flex-shrink-0" aria-label="Uploaded to cloud" />
                )}
              </div>
              <p className={cn("text-muted-foreground truncate", sizes.subtitle)}>{track.artist}</p>
            </div>
          </div>
        </button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm font-medium">{track.title}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {onNavigateToArtist ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToArtist(track.artist);
                }}
                className="underline hover:text-primary hover:bg-primary/10 rounded px-1 transition-colors focus:outline-none"
              >
                {track.artist}
              </button>
            ) : (
              track.artist
            )}
          </div>
          {track.album && (
            <div className="text-xs text-muted-foreground/70 mt-1">
              {onNavigateToAlbum ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateToAlbum(track.album!, track.artist);
                  }}
                  className="underline hover:text-primary hover:bg-primary/10 rounded px-1 transition-colors focus:outline-none"
                >
                  {track.album}
                </button>
              ) : (
                track.album
              )}
            </div>
          )}
          <div className="text-xs text-muted-foreground/70 mt-1">{formatTime(track.duration)}</div>
        </TooltipContent>
      </Tooltip>
    );
  },
);
CompactTrackCard.displayName = "CompactTrackCard";

// Default/Large variant component
const DefaultTrackCard = memo(
  ({
    track,
    isPlaying,
    isCurrent,
    variant,
    showUploadStatus,
    uploadProvider,
    onPlay,
    onContextMenu,
    onNavigateToArtist,
    onNavigateToAlbum,
    className,
    index,
  }: TrackCardProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const sizes = sizeClasses[variant || "default"];

    const handleContextMenu = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.();
      },
      [onContextMenu],
    );

    return (
      <Tooltip>
        <TooltipTrigger asChild>
        <button
          onClick={onPlay}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onContextMenu={handleContextMenu}
          className={cn(
            "group relative flex flex-col rounded-xl overflow-hidden text-left w-full",
            "bg-white/5 hover:bg-white/10",
            "transition-all duration-300 ease-out",
            "hover:scale-[1.03] hover:shadow-xl hover:shadow-primary/10",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            isCurrent && "ring-2 ring-primary bg-primary/10",
            sizes.container,
            className,
          )}
          style={index !== undefined ? { animationDelay: `${index * 50}ms` } : undefined}
        >
          {/* Cover */}
          <div
            className={cn(
              "relative overflow-hidden",
              variant === "default" || variant === "large" ? "rounded-t-xl" : "rounded-lg",
              sizes.image,
            )}
          >
            <img
              src={getCoverUrl(track.coverUrl) || "/placeholder.svg"}
              alt={track.album || track.title}
              loading="lazy"
              decoding="async"
              className={cn(
                "w-full h-full object-cover transition-all duration-500",
                isHovered && "scale-110 brightness-75",
              )}
            />

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* Play button overlay */}
            <div
              className={cn(
                "absolute inset-0 flex items-center justify-center",
                "transition-all duration-300",
                isHovered || isCurrent ? "opacity-100" : "opacity-0",
              )}
            >
              <div
                className={cn(
                  "rounded-full flex items-center justify-center",
                  "bg-primary shadow-xl shadow-primary/30",
                  "transition-all duration-300",
                  isHovered ? "scale-100" : "scale-75",
                  sizes.playButton,
                )}
              >
                {isCurrent && isPlaying ? (
                  <Pause className={cn("text-primary-foreground fill-current", sizes.playIcon)} />
                ) : (
                  <Play className={cn("text-primary-foreground fill-current ml-0.5", sizes.playIcon)} />
                )}
              </div>
            </div>

            {/* Now playing indicator */}
            {isCurrent && isPlaying && (
              <div className="absolute bottom-2 left-2 flex items-end gap-0.5 h-4">
                <div className="w-1 bg-primary rounded-full animate-wave" style={{ height: "100%" }} />
                <div className="w-1 bg-primary rounded-full animate-wave" style={{ animationDelay: "0.1s", height: "70%" }} />
                <div className="w-1 bg-primary rounded-full animate-wave" style={{ animationDelay: "0.2s", height: "85%" }} />
              </div>
            )}

            {/* Upload status */}
            {showUploadStatus && uploadProvider && (
              <div className="absolute top-2 right-2">
                <div className="p-1 rounded-full bg-black/50 backdrop-blur-sm">
                  <Cloud className="w-3 h-3 text-emerald-400" aria-label="Uploaded to cloud" />
                </div>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-3">
            <p className={cn("font-medium truncate", isCurrent ? "text-primary" : "text-foreground", sizes.title)}>
              {track.title}
            </p>
            <p className={cn("text-muted-foreground truncate mt-0.5", sizes.subtitle)}>{track.artist}</p>
            {variant === "large" && track.album && (
              <p className={cn("text-muted-foreground/70 truncate mt-0.5", sizes.subtitle)}>{track.album}</p>
            )}
          </div>
        </button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm font-medium">{track.title}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {onNavigateToArtist ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToArtist(track.artist);
                }}
                className="underline hover:text-primary hover:bg-primary/10 rounded px-1 transition-colors focus:outline-none"
              >
                {track.artist}
              </button>
            ) : (
              track.artist
            )}
          </div>
          {track.album && (
            <div className="text-xs text-muted-foreground/70 mt-1">
              {onNavigateToAlbum ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateToAlbum(track.album!, track.artist);
                  }}
                  className="underline hover:text-primary hover:bg-primary/10 rounded px-1 transition-colors focus:outline-none"
                >
                  {track.album}
                </button>
              ) : (
                track.album
              )}
            </div>
          )}
          <div className="text-xs text-muted-foreground/70 mt-1">{formatTime(track.duration)}</div>
        </TooltipContent>
      </Tooltip>
    );
  },
);
DefaultTrackCard.displayName = "DefaultTrackCard";

// Main component with conditional rendering
export const TrackCard = memo((props: TrackCardProps) => {
  if (props.variant === "compact") {
    return <CompactTrackCard {...props} />;
  }
  return <DefaultTrackCard {...props} />;
});
TrackCard.displayName = "TrackCard";
