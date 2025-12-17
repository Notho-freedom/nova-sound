import { useState, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Play, Plus, Check, Star, Clock, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Video } from "@/types/music";
import { VideoContextMenu } from "./VideoContextMenu";
import { UploadIndicator } from "./UploadIndicator";

interface VideoCarouselProps {
  title: string;
  videos: Video[];
  onVideoSelect: (video: Video) => void;
  onViewDetails?: (video: Video) => void;
  onToggleWatchlist?: (video: Video) => void;
  onToggleFavorite?: (video: Video) => void;
  isInWatchlist?: (videoId: string) => boolean;
  isFavorite?: (videoId: string) => boolean;
  showRank?: boolean;
  showProgress?: boolean;
  className?: string;
}

const formatTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${mins}min`;
  }
  return `${mins} min`;
};

export const VideoCarousel = ({
  title,
  videos,
  onVideoSelect,
  onViewDetails,
  onToggleWatchlist,
  onToggleFavorite,
  isInWatchlist,
  isFavorite,
  showRank = false,
  showProgress = false,
  className,
}: VideoCarouselProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);

  const scroll = useCallback((direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = container.clientWidth * 0.8;
    const newScrollLeft =
      direction === "left"
        ? container.scrollLeft - scrollAmount
        : container.scrollLeft + scrollAmount;

    container.scrollTo({ left: newScrollLeft, behavior: "smooth" });
  }, []);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setShowLeftArrow(container.scrollLeft > 0);
    setShowRightArrow(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 10
    );
  }, []);

  if (videos.length === 0) return null;

  return (
    <div className={cn("relative group/carousel", className)}>
      {/* Title */}
      <h2 className="text-xl font-semibold mb-4 px-2">{title}</h2>

      {/* Scroll Buttons */}
      {showLeftArrow && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-12 h-24 rounded-r-lg bg-black/60 hover:bg-black/80 opacity-0 group-hover/carousel:opacity-100 transition-opacity"
          onClick={() => scroll("left")}
        >
          <ChevronLeft className="w-8 h-8" />
        </Button>
      )}
      {showRightArrow && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-12 h-24 rounded-l-lg bg-black/60 hover:bg-black/80 opacity-0 group-hover/carousel:opacity-100 transition-opacity"
          onClick={() => scroll("right")}
        >
          <ChevronRight className="w-8 h-8" />
        </Button>
      )}

      {/* Video Cards Container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth pb-4 px-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {videos.map((video, index) => {
          const isHovered = hoveredVideo === video.id;
          const inWatchlist = isInWatchlist?.(video.id) ?? video.isInWatchlist;
          const favorite = isFavorite?.(video.id) ?? video.isFavorite;
          const progress = video.watchProgress;
          const progressPercent = progress ? Math.round(progress.percentage) : 0;

          return (
            <VideoContextMenu
              key={video.id}
              video={video}
              isFavorite={favorite}
              isInWatchlist={inWatchlist}
              hasWatchProgress={!!progress}
              onPlay={() => onVideoSelect(video)}
              onViewDetails={() => onViewDetails?.(video)}
              onToggleWatchlist={() => onToggleWatchlist?.(video)}
              onToggleFavorite={() => onToggleFavorite?.(video)}
            >
              <div
                className={cn(
                  "relative flex-shrink-0 cursor-pointer transition-all duration-300 ease-out",
                  "group/card",
                  isHovered ? "z-10" : ""
                )}
                style={{ width: showRank ? "180px" : "220px" }}
                onMouseEnter={() => setHoveredVideo(video.id)}
                onMouseLeave={() => setHoveredVideo(null)}
                onClick={() => onVideoSelect(video)}
              >
                {/* Rank Number (for Top 10 style) */}
                {showRank && (
                  <div className="absolute -left-6 bottom-0 z-10">
                    <span
                      className="text-8xl font-black text-transparent"
                      style={{
                        WebkitTextStroke: "2px rgba(255,255,255,0.5)",
                      }}
                    >
                      {index + 1}
                    </span>
                  </div>
                )}

                {/* Thumbnail */}
                <div
                  className={cn(
                    "aspect-video rounded-lg overflow-hidden relative",
                    "border-2 border-transparent",
                    isHovered && "border-white shadow-xl shadow-primary/20"
                  )}
                >
                  {video.thumbnailUrl || video.posterUrl ? (
                    <img
                      src={video.thumbnailUrl || video.posterUrl}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Film className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}

                  {/* Cloud Upload Indicator */}
                  {video.cloudStatus?.isUploaded && (
                    <div className="absolute top-2 left-2 z-10">
                      <UploadIndicator provider={video.cloudStatus.provider} size="sm" />
                    </div>
                  )}

                  {/* Duration Badge */}
                  {video.duration > 0 && !showProgress && (
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-xs text-white font-mono">
                      {formatTime(video.duration)}
                    </div>
                  )}

                  {/* Progress Bar */}
                  {showProgress && progress && !progress.completed && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30">
                      <div
                        className="h-full bg-red-600 transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  )}

                  {/* Hover Overlay */}
                  <div
                    className={cn(
                      "absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent",
                      "flex flex-col justify-end p-3",
                      "opacity-0 group-hover/card:opacity-100 transition-opacity"
                    )}
                  >
                    {/* Quick Actions */}
                    <div className="flex items-center gap-2 mb-2">
                      <Button
                        size="icon"
                        className="w-10 h-10 rounded-full bg-white text-black hover:bg-white/90"
                        onClick={(e) => {
                          e.stopPropagation();
                          onVideoSelect(video);
                        }}
                      >
                        <Play className="w-5 h-5 fill-current" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="w-8 h-8 rounded-full border-white/50 hover:border-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleWatchlist?.(video);
                        }}
                      >
                        {inWatchlist ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </Button>
                    </div>

                    {/* Video Info */}
                    <div className="space-y-1">
                      {video.year && (
                        <span className="text-xs text-white/70">{video.year}</span>
                      )}
                      {video.ratings?.[0] && (
                        <div className="flex items-center gap-1 text-xs text-white/70">
                          <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                          <span>{video.ratings[0].value}/{video.ratings[0].maxValue}</span>
                        </div>
                      )}
                      {video.duration > 0 && (
                        <div className="flex items-center gap-1 text-xs text-white/70">
                          <Clock className="w-3 h-3" />
                          <span>{formatTime(video.duration)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Title & Info */}
                <div className="mt-2 px-1">
                  <h3 className="text-sm font-medium truncate">{video.title}</h3>
                  {video.genres && video.genres.length > 0 && (
                    <p className="text-xs text-muted-foreground truncate">
                      {video.genres.slice(0, 2).join(" • ")}
                    </p>
                  )}
                </div>
              </div>
            </VideoContextMenu>
          );
        })}
      </div>
    </div>
  );
};

export default VideoCarousel;

