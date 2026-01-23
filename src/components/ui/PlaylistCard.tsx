"use client";

import { memo, useCallback, useMemo } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import { SimpleTooltip } from "@/components/ui/tooltip";
import type { Track } from "@/types/music";

interface PlaylistCardProps {
  title: string;
  subtitle?: string;
  description?: string;
  tracks: Track[];
  gradient?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  maxThumbnails?: number;
}

// Memoized thumbnail component
const TrackThumbnail = memo(({ track, index }: { track: Track; index: number }) => (
  <div
    className="w-10 h-10 rounded-lg overflow-hidden border-2 border-white/40 shadow-lg backdrop-blur-sm"
    style={{ marginLeft: index > 0 ? "-8px" : 0, zIndex: 10 - index }}
  >
    <img
      src={getCoverUrl(track.coverUrl)}
      alt=""
      loading="lazy"
      decoding="async"
      className="w-full h-full object-cover"
    />
  </div>
));
TrackThumbnail.displayName = "TrackThumbnail";

export const PlaylistCard = memo(
  ({
    title,
    subtitle,
    description,
    tracks,
    gradient = "from-primary/80 via-primary/60 to-secondary/80",
    icon,
    onClick,
    className,
    maxThumbnails = 4,
  }: PlaylistCardProps) => {
    const handleClick = useCallback(() => {
      onClick?.();
    }, [onClick]);

    const thumbnails = useMemo(() => tracks.slice(0, maxThumbnails), [tracks, maxThumbnails]);
    const extraCount = useMemo(() => Math.max(0, tracks.length - maxThumbnails), [tracks.length, maxThumbnails]);

    // Memoize tooltip content to prevent infinite re-renders
    const tooltipContent = useMemo(
      () => (
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">
            {tracks.length} piste{tracks.length > 1 ? "s" : ""}
          </div>
          {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
        </div>
      ),
      [title, tracks.length, subtitle]
    );

    return (
      <SimpleTooltip content={tooltipContent}>
        <button
          onClick={handleClick}
          className={cn(
            // Vision Pro spatial playlist card
            "group relative aspect-[3/2] rounded-2xl overflow-hidden cursor-pointer",
            "backdrop-blur-xl",
            "border border-white/[0.08] hover:border-white/[0.15]",
            "shadow-[0_8px_32px_rgba(0,0,0,0.25)]",
            "hover:shadow-[0_20px_60px_rgba(0,0,0,0.4)]",
            "transition-all duration-300",
            "hover:scale-[1.03] hover:-translate-y-1",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            "text-left w-full",
            className,
          )}
        >
          {/* Background image from first track */}
          {tracks[0] && (
            <img
              src={getCoverUrl(tracks[0].coverUrl)}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-50 transition-opacity"
            />
          )}

          {/* Gradient overlay */}
          <div className={cn("absolute inset-0 bg-gradient-to-br", gradient)} />

          {/* Decorative pattern */}
          <div className="absolute inset-0 opacity-20" aria-hidden="true">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
          </div>

          {/* Content */}
          <div className="absolute inset-0 p-5 flex flex-col justify-between">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {icon && <div className="text-white/90">{icon}</div>}
                  <h3 className="font-display text-xl font-bold text-white drop-shadow-lg">{title}</h3>
                </div>
                {subtitle && <p className="text-white/80 text-sm font-medium">{subtitle}</p>}
                {description && <p className="text-white/60 text-xs mt-1">{description}</p>}
              </div>

              {/* Play button */}
              <div
                className={cn(
                  "w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center",
                  "opacity-0 group-hover:opacity-100 transition-all duration-300",
                  "group-hover:scale-110 group-hover:rotate-12",
                )}
                aria-hidden="true"
              >
                <Play className="w-5 h-5 text-white fill-current ml-0.5" />
              </div>
            </div>

            {/* Track thumbnails */}
            <div className="flex items-center gap-2">
              {thumbnails.map((track, i) => (
                <TrackThumbnail key={`${track.id}-${i}`} track={track} index={i} />
              ))}
              {extraCount > 0 && (
                <div
                  className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center text-white text-xs font-bold"
                  style={{ marginLeft: "-8px" }}
                >
                  +{extraCount}
                </div>
              )}
            </div>
          </div>
        </button>
      </SimpleTooltip>
    );
  },
);

PlaylistCard.displayName = "PlaylistCard";
