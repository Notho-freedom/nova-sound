import { Play, Heart, MoreHorizontal, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import type { Track } from "@/types/music";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useState } from "react";

interface TrackCarouselProps {
  tracks: Track[];
  title: string;
  onTrackSelect: (track: Track) => void;
  currentTrackId?: string;
  isPlaying?: boolean;
  className?: string;
  variant?: "default" | "compact" | "large";
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const TrackCarousel = ({
  tracks,
  title,
  onTrackSelect,
  currentTrackId,
  isPlaying = false,
  className,
  variant = "default",
}: TrackCarouselProps) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (tracks.length === 0) return null;

  const cardSize = variant === "large" ? "basis-full md:basis-1/2 lg:basis-1/3 xl:basis-1/4" : 
                   variant === "compact" ? "basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5" :
                   "basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5 2xl:basis-1/6";

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl md:text-2xl font-bold">{title}</h2>
      </div>
      
      <Carousel className="w-full">
        <CarouselContent className="-ml-2 md:-ml-4">
          {tracks.map((track, index) => {
            const isCurrentTrack = currentTrackId === track.id;
            const isHovered = hoveredIndex === index;
            
            return (
              <CarouselItem key={track.id} className={cn("pl-2 md:pl-4", cardSize)}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      onClick={() => onTrackSelect(track)}
                      className={cn(
                        "group relative overflow-hidden rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 transition-all duration-300 ease-out cursor-pointer",
                        "hover:bg-card hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 hover:scale-[1.03]",
                        isCurrentTrack && "ring-2 ring-primary border-primary/50",
                        isHovered && "z-10"
                      )}
                    >
                      {/* Cover Image */}
                      <div className="relative aspect-square overflow-hidden bg-muted/30">
                        <img
                          src={getCoverUrl(track.coverUrl)}
                          alt={track.album}
                          className={cn(
                            "w-full h-full object-cover transition-transform duration-500 ease-out",
                            isHovered && "scale-110"
                          )}
                        />
                        
                        {/* Overlay with play button */}
                        <div className={cn(
                          "absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-300",
                          isHovered ? "opacity-100" : "opacity-0"
                        )}>
                          <div className={cn(
                            "w-14 h-14 rounded-full bg-white/90 flex items-center justify-center transition-all duration-300",
                            isHovered && "scale-110"
                          )}>
                            {isCurrentTrack && isPlaying ? (
                              <div className="flex items-center gap-1">
                                <div className="w-1 h-4 bg-primary rounded-full animate-wave" />
                                <div className="w-1 h-4 bg-primary rounded-full animate-wave" style={{ animationDelay: "0.1s" }} />
                                <div className="w-1 h-4 bg-primary rounded-full animate-wave" style={{ animationDelay: "0.2s" }} />
                              </div>
                            ) : (
                              <Play className="w-6 h-6 text-black fill-current ml-1" />
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Track Info */}
                      <div className="p-3 space-y-1">
                        <p className={cn(
                          "font-medium text-sm truncate transition-colors",
                          isCurrentTrack ? "text-primary" : "text-foreground"
                        )}>
                          {track.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {track.artist}
                        </p>
                        {variant === "large" && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>{formatTime(track.duration)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <div className="space-y-1">
                      <div className="font-medium">{track.title}</div>
                      <div className="text-xs text-muted-foreground">{track.artist}</div>
                      {track.album && <div className="text-xs text-muted-foreground">{track.album}</div>}
                      <div className="text-xs text-muted-foreground">{formatTime(track.duration)}</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </CarouselItem>
            );
          })}
        </CarouselContent>
        <CarouselPrevious className="left-0 md:-left-12" />
        <CarouselNext className="right-0 md:-right-12" />
      </Carousel>
    </div>
  );
};
