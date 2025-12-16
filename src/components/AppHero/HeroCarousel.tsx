"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCoverUrl, getDefaultHeroImage, getFallbackHeroImage } from "@/lib/audio";
import type { Track } from "@/types/music";

interface HeroCarouselProps {
  /** Tracks to display in carousel */
  tracks: Track[];
  /** Current index (controlled) */
  currentIndex?: number;
  /** Index change callback */
  onIndexChange?: (index: number) => void;
  /** Track selection callback */
  onTrackSelect?: (track: Track) => void;
  /** Auto-play interval in ms (0 to disable) */
  autoPlayInterval?: number;
  /** Show navigation dots */
  showDots?: boolean;
  /** Show navigation arrows */
  showArrows?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Hero carousel component - Steam-style featured items carousel
 * Displays track cards with hover effects and navigation
 */
export const HeroCarousel = ({
  tracks,
  currentIndex: controlledIndex,
  onIndexChange,
  onTrackSelect,
  autoPlayInterval = 6000,
  showDots = true,
  showArrows = true,
  className,
}: HeroCarouselProps) => {
  const [internalIndex, setInternalIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(autoPlayInterval > 0);
  const [isHovered, setIsHovered] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const currentIndex = controlledIndex ?? internalIndex;

  const setIndex = useCallback((index: number) => {
    const newIndex = ((index % tracks.length) + tracks.length) % tracks.length;
    setInternalIndex(newIndex);
    onIndexChange?.(newIndex);
  }, [tracks.length, onIndexChange]);

  // Auto-play
  useEffect(() => {
    if (!isAutoPlaying || isHovered || tracks.length <= 1) return;

    const interval = setInterval(() => {
      setIndex(currentIndex + 1);
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [isAutoPlaying, isHovered, currentIndex, autoPlayInterval, tracks.length, setIndex]);

  const goToPrev = () => setIndex(currentIndex - 1);
  const goToNext = () => setIndex(currentIndex + 1);
  const goToIndex = (index: number) => setIndex(index);

  if (tracks.length === 0) return null;

  return (
    <div 
      className={cn("relative", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Track Cards */}
      <div className="flex gap-3 overflow-hidden">
        {tracks.slice(0, 5).map((track, index) => {
          const coverUrl = track.coverUrl ? getCoverUrl(track.coverUrl) : getDefaultHeroImage();
          const fallbackImage = getFallbackHeroImage();
          const isActive = index === currentIndex;
          const hasError = imageErrors.has(track.id);
          const displayImage = hasError ? fallbackImage : coverUrl;
          
          return (
            <button
              key={track.id}
              onClick={() => {
                goToIndex(index);
                onTrackSelect?.(track);
              }}
              className={cn(
                "relative flex-shrink-0 rounded-xl overflow-hidden transition-all duration-500 group",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                isActive 
                  ? "w-48 md:w-56 opacity-100 scale-100" 
                  : "w-32 md:w-40 opacity-60 scale-95 hover:opacity-80 hover:scale-[0.97]"
              )}
            >
              {/* Cover Image */}
              <div className="aspect-square relative overflow-hidden">
                <img
                  src={displayImage}
                  alt={track.album || track.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  onError={() => {
                    if (!hasError) {
                      setImageErrors(prev => new Set(prev).add(track.id));
                    }
                  }}
                  onLoad={() => {
                    if (hasError) {
                      setImageErrors(prev => {
                        const next = new Set(prev);
                        next.delete(track.id);
                        return next;
                      });
                    }
                  }}
                />
                
                {/* Hover overlay */}
                <div className={cn(
                  "absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-300",
                  isActive ? "opacity-0 group-hover:opacity-100" : "opacity-0"
                )}>
                  <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg transform transition-transform duration-300 group-hover:scale-110">
                    <Play className="w-5 h-5 text-black fill-current ml-0.5" />
                  </div>
                </div>

                {/* Gradient overlay */}
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
              </div>

              {/* Track Info */}
              <div className="absolute bottom-0 left-0 right-0 p-3 text-left">
                <p className={cn(
                  "font-semibold text-white truncate drop-shadow-lg transition-all duration-300",
                  isActive ? "text-sm md:text-base" : "text-xs md:text-sm"
                )}>
                  {track.title}
                </p>
                <p className={cn(
                  "text-white/70 truncate drop-shadow",
                  isActive ? "text-xs md:text-sm" : "text-[10px] md:text-xs"
                )}>
                  {track.artist}
                </p>
              </div>

              {/* Active indicator */}
              {isActive && (
                <div className="absolute top-2 right-2">
                  <div className="w-2 h-2 rounded-full bg-white shadow-lg animate-pulse" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Navigation Arrows */}
      {showArrows && tracks.length > 1 && (
        <>
          <button
            onClick={goToPrev}
            className={cn(
              "absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4",
              "w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm",
              "flex items-center justify-center",
              "text-white/80 hover:text-white hover:bg-black/70",
              "transition-all duration-200 opacity-0 group-hover:opacity-100",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            )}
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={goToNext}
            className={cn(
              "absolute right-0 top-1/2 -translate-y-1/2 translate-x-4",
              "w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm",
              "flex items-center justify-center",
              "text-white/80 hover:text-white hover:bg-black/70",
              "transition-all duration-200 opacity-0 group-hover:opacity-100",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            )}
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Navigation Dots */}
      {showDots && tracks.length > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {tracks.slice(0, 5).map((_, index) => (
            <button
              key={index}
              onClick={() => goToIndex(index)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
                index === currentIndex 
                  ? "w-6 bg-white" 
                  : "w-1.5 bg-white/40 hover:bg-white/60"
              )}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
          
          {/* Auto-play toggle */}
          <button
            onClick={() => setIsAutoPlaying(!isAutoPlaying)}
            className={cn(
              "ml-2 w-6 h-6 rounded-full flex items-center justify-center",
              "text-white/60 hover:text-white transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            )}
            aria-label={isAutoPlaying ? "Pause auto-play" : "Start auto-play"}
          >
            {isAutoPlaying ? (
              <Pause className="w-3 h-3" />
            ) : (
              <Play className="w-3 h-3 ml-0.5" />
            )}
          </button>
        </div>
      )}
    </div>
  );
};
