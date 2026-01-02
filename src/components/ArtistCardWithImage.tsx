/**
 * Exemple d'intégration : ArtistCard avec ArtistImage Provider
 * Version améliorée qui utilise automatiquement le service d'images
 */

"use client";

import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ArtistImage } from "./ArtistImage";

interface ArtistCardWithImageProps {
  name: string;
  trackCount?: number;
  playCount?: number;
  onClick?: () => void;
  onNavigateToArtist?: (artist: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ArtistCardWithImage = ({
  name,
  trackCount,
  playCount,
  onClick,
  onNavigateToArtist,
  className,
  size = 'md',
}: ArtistCardWithImageProps) => {
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  };

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
          {/* Artist image avec fallback automatique */}
          <div className="relative">
            <div className={cn(
              "rounded-full overflow-hidden",
              "shadow-lg group-hover:shadow-xl transition-shadow duration-200",
              sizeClasses[size]
            )}>
              <ArtistImage
                artistName={name}
                size={size}
                showLoading={true}
              />
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
        <div className="text-sm font-medium">
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
          <div className="text-xs text-muted-foreground">{trackCount} titre{trackCount > 1 ? "s" : ""}</div>
        )}
        {playCount !== undefined && playCount > 0 && (
          <div className="text-xs text-muted-foreground">{playCount} écoute{playCount > 1 ? "s" : ""}</div>
        )}
      </TooltipContent>
    </Tooltip>
  );
};

