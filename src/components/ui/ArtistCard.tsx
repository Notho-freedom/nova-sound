"use client";

import { memo, useCallback } from "react";
import { User, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface ArtistCardProps {
  name: string;
  imageUrl?: string | null;
  trackCount?: number;
  playCount?: number;
  onClick?: () => void;
  onNavigateToArtist?: (artist: string) => void;
  className?: string;
}

export const ArtistCard = memo(({ name, imageUrl, trackCount, playCount, onClick, onNavigateToArtist, className }: ArtistCardProps) => {
  const handleClick = useCallback(() => {
    onClick?.();
  }, [onClick]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
      <button
        onClick={handleClick}
        className={cn(
          // Vision Pro spatial artist card
          "group flex flex-col items-center gap-3 p-4 rounded-2xl transition-all duration-300 ease-out",
          "bg-white/[0.02] backdrop-blur-xl",
          "border border-white/[0.04] hover:border-white/[0.08]",
          "hover:bg-white/[0.05]",
          "hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)]",
          "hover:-translate-y-1",
          "active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          className,
        )}
      >
        {/* Artist image - circular with Vision Pro glow */}
        <div className="relative">
          {/* Ambient glow behind image */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 blur-xl scale-110 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div
            className={cn(
              "w-24 h-24 rounded-full overflow-hidden",
              "bg-gradient-to-br from-white/[0.08] to-white/[0.02]",
              "shadow-[0_4px_24px_rgba(0,0,0,0.3)] group-hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
              "ring-2 ring-white/[0.06] group-hover:ring-primary/30",
              "transition-all duration-300",
            )}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={name}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-10 h-10 text-muted-foreground/50" aria-hidden="true" />
              </div>
            )}
          </div>

          {/* Play button on hover */}
          <div
            className={cn(
              "absolute bottom-0 right-0 w-10 h-10 rounded-full bg-primary shadow-lg",
              "flex items-center justify-center",
              "opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0",
              "transition-all duration-200 ease-out",
            )}
            aria-hidden="true"
          >
            <Play className="w-5 h-5 text-primary-foreground fill-current ml-0.5" />
          </div>
        </div>

        {/* Artist name */}
        <div className="text-center w-full">
          <p className="font-medium text-sm truncate max-w-[10rem]">{name}</p>
          {(trackCount !== undefined || playCount !== undefined) && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {playCount !== undefined && playCount > 0
                ? `${playCount} écoutes`
                : trackCount !== undefined
                  ? `${trackCount} titre${trackCount > 1 ? "s" : ""}`
                  : "Artiste"}
            </p>
          )}
        </div>
      </button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-sm font-medium truncate max-w-xs">
          {onNavigateToArtist ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigateToArtist(name);
              }}
              className="underline hover:text-primary hover:bg-primary/10 rounded px-1 transition-colors focus:outline-none"
            >
              {name}
            </button>
          ) : (
            name
          )}
        </div>
        {trackCount !== undefined && (
          <div className="text-xs text-muted-foreground">
            {trackCount} titre{trackCount > 1 ? "s" : ""}
          </div>
        )}
        {playCount !== undefined && playCount > 0 && (
          <div className="text-xs text-muted-foreground">
            {playCount} écoute{playCount > 1 ? "s" : ""}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
});

ArtistCard.displayName = "ArtistCard";
