"use client";

import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
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

export const PlaylistCard = ({
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
  const thumbnails = tracks.slice(0, maxThumbnails);
  const extraCount = Math.max(0, tracks.length - maxThumbnails);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "group relative aspect-[3/2] rounded-xl overflow-hidden cursor-pointer",
            "shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
            "text-left w-full",
            className
          )}
        >
          {/* Background image from first track */}
          {tracks[0] && (
            <img
              src={getCoverUrl(tracks[0].coverUrl)}
              alt=""
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-50 transition-opacity"
            />
          )}
          
          {/* Gradient overlay */}
          <div className={cn("absolute inset-0 bg-gradient-to-br", gradient)} />

          {/* Decorative pattern */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
          </div>

          {/* Content */}
          <div className="absolute inset-0 p-5 flex flex-col justify-between">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {icon && (
                    <div className="text-white/90">{icon}</div>
                  )}
                  <h3 className="font-display text-xl font-bold text-white drop-shadow-lg">
                    {title}
                  </h3>
                </div>
                {subtitle && (
                  <p className="text-white/80 text-sm font-medium">{subtitle}</p>
                )}
                {description && (
                  <p className="text-white/60 text-xs mt-1">{description}</p>
                )}
              </div>
              
              {/* Play button */}
              <div className={cn(
                "w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center",
                "opacity-0 group-hover:opacity-100 transition-all duration-300",
                "group-hover:scale-110 group-hover:rotate-12"
              )}>
                <Play className="w-5 h-5 text-white fill-current ml-0.5" />
              </div>
            </div>

            {/* Track thumbnails */}
            <div className="flex items-center gap-2">
              {thumbnails.map((track, i) => (
                <div
                  key={`${track.id}-${i}`}
                  className="w-10 h-10 rounded-lg overflow-hidden border-2 border-white/40 shadow-lg backdrop-blur-sm"
                  style={{ marginLeft: i > 0 ? "-8px" : 0, zIndex: 10 - i }}
                >
                  <img
                    src={getCoverUrl(track.coverUrl)}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </div>
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
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{tracks.length} piste{tracks.length > 1 ? "s" : ""}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
      </TooltipContent>
    </Tooltip>
  );
};
