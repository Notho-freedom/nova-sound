"use client";

import { User, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface ArtistCardProps {
  name: string;
  imageUrl?: string | null;
  trackCount?: number;
  playCount?: number;
  onClick?: () => void;
  className?: string;
}

export const ArtistCard = ({
  name,
  imageUrl,
  trackCount,
  playCount,
  onClick,
  className,
}: ArtistCardProps) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "group flex flex-col items-center gap-3 p-4 rounded-xl transition-all duration-200 ease-out",
            "hover:bg-card/50 active:scale-95",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
            className
          )}
        >
          {/* Artist image - circular like Spotify */}
          <div className="relative">
            <div className={cn(
              "w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-secondary/20",
              "shadow-lg group-hover:shadow-xl transition-shadow duration-200"
            )}>
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-10 h-10 text-muted-foreground/50" />
                </div>
              )}
            </div>
            
            {/* Play button on hover */}
            <div className={cn(
              "absolute bottom-0 right-0 w-10 h-10 rounded-full bg-primary shadow-lg",
              "flex items-center justify-center",
              "opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0",
              "transition-all duration-200 ease-out"
            )}>
              <Play className="w-5 h-5 text-primary-foreground fill-current ml-0.5" />
            </div>
          </div>

          {/* Artist name */}
          <div className="text-center w-full">
            <p className="font-medium text-sm truncate">{name}</p>
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
        <div className="text-sm font-medium">{name}</div>
        {trackCount !== undefined && (
          <div className="text-xs text-muted-foreground">{trackCount} titre{trackCount > 1 ? "s" : ""}</div>
        )}
        {playCount !== undefined && playCount > 0 && (
          <div className="text-xs text-muted-foreground">{playCount} écoute{playCount > 1 ? "s" : ""}</div>
        )}
      </TooltipContent>
    </Tooltip>
  );
};
