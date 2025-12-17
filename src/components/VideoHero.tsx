import { useState, useEffect, useRef } from "react";
import { Play, Info, Plus, Check, VolumeX, Volume2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Video } from "@/types/music";
import { UploadIndicator } from "./UploadIndicator";

interface VideoHeroProps {
  video: Video;
  onPlay: () => void;
  onViewDetails: () => void;
  onToggleWatchlist?: () => void;
  isInWatchlist?: boolean;
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

export const VideoHero = ({
  video,
  onPlay,
  onViewDetails,
  onToggleWatchlist,
  isInWatchlist = false,
  className,
}: VideoHeroProps) => {
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Determine teaser source: trailer/preview or auto-generated from video file
  const teaserSource = video.trailerUrl || video.previewUrl || video.filePath;
  const hasTeaser = !!(video.trailerUrl || video.previewUrl || video.filePath);
  
  // Convert file path to local-video:// protocol if needed
  const getTeaserUrl = () => {
    if (video.trailerUrl || video.previewUrl) {
      return video.trailerUrl || video.previewUrl;
    }
    // Use local-video:// protocol for local files in Electron
    if (video.filePath && window.electronAPI) {
      return `local-video://${encodeURIComponent(video.filePath)}`;
    }
    return video.filePath;
  };

  const backdrop = video.backdropUrl || video.posterUrl || video.thumbnailUrl;
  const rating = video.ratings?.[0];

  return (
    <div className={cn("relative w-full h-[70vh] min-h-[500px] overflow-hidden", className)}>
      {/* Background Image/Video */}
      <div className="absolute inset-0">
        {hasTeaser ? (
          <>
            <video
              ref={videoRef}
              src={getTeaserUrl()}
              autoPlay
              loop
              muted={isMuted}
              playsInline
              className="w-full h-full object-cover"
              onLoadedData={() => {
                // For auto-generated teaser, start from beginning (or skip intro if long)
                if (videoRef.current && !video.trailerUrl && !video.previewUrl) {
                  // Start from beginning for teaser
                  videoRef.current.currentTime = 0;
                }
              }}
            />
            {/* Fallback backdrop image */}
            {backdrop && (
              <img
                src={backdrop}
                alt={video.title}
                className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
                style={{ zIndex: -1 }}
              />
            )}
          </>
        ) : backdrop ? (
          <img
            src={backdrop}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-background" />
        )}

        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* Content */}
      <div className="absolute inset-0 flex items-center">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="max-w-2xl space-y-6">
            {/* Cloud Status */}
            {video.cloudStatus?.isUploaded && (
              <div className="flex items-center gap-2">
                <UploadIndicator provider={video.cloudStatus.provider} size="md" />
                <span className="text-sm text-muted-foreground">
                  Disponible sur le cloud
                </span>
              </div>
            )}

            {/* Type Badge */}
            {video.type && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-medium">
                {video.type === 'movie' && 'Film'}
                {video.type === 'series' && 'Série'}
                {video.type === 'documentary' && 'Documentaire'}
                {video.type === 'episode' && `S${video.episodeInfo?.seasonNumber}E${video.episodeInfo?.episodeNumber}`}
                {video.type === 'clip' && 'Clip'}
                {video.type === 'music_video' && 'Clip Musical'}
              </div>
            )}

            {/* Title */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
              {video.title}
            </h1>

            {/* Metadata Row */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {rating && (
                <div className="flex items-center gap-1 text-yellow-500">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="font-semibold">{rating.value}</span>
                  <span className="text-muted-foreground">/{rating.maxValue}</span>
                  {rating.source !== 'user' && (
                    <span className="text-xs uppercase ml-1">({rating.source})</span>
                  )}
                </div>
              )}
              {video.year && <span>{video.year}</span>}
              {video.duration > 0 && <span>{formatTime(video.duration)}</span>}
              {video.quality && (
                <span className="px-1.5 py-0.5 border border-muted-foreground/50 rounded text-xs font-medium">
                  {video.quality}
                </span>
              )}
              {video.ageRating && (
                <span className="px-1.5 py-0.5 border border-muted-foreground/50 rounded text-xs font-medium">
                  {video.ageRating}
                </span>
              )}
            </div>

            {/* Genres */}
            {video.genres && video.genres.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {video.genres.slice(0, 4).map((genre) => (
                  <span
                    key={genre}
                    className="px-3 py-1 rounded-full bg-muted/50 text-sm capitalize"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

            {/* Tagline */}
            {video.tagline && (
              <p className="text-lg text-muted-foreground italic">
                "{video.tagline}"
              </p>
            )}

            {/* Synopsis */}
            {(video.synopsis || video.description) && (
              <p className="text-base text-muted-foreground line-clamp-3 max-w-xl">
                {video.synopsis || video.description}
              </p>
            )}

            {/* Cast */}
            {video.cast && video.cast.length > 0 && (
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">Avec : </span>
                {video.cast.slice(0, 3).join(", ")}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-4 pt-4">
              <Button
                size="lg"
                className="px-8 py-6 text-lg font-semibold gap-3 bg-white text-black hover:bg-white/90"
                onClick={onPlay}
              >
                <Play className="w-6 h-6 fill-current" />
                {video.watchProgress && !video.watchProgress.completed
                  ? "Reprendre"
                  : "Lecture"}
              </Button>

              <Button
                size="lg"
                variant="secondary"
                className="px-6 py-6 text-lg font-semibold gap-3 bg-white/20 hover:bg-white/30"
                onClick={onViewDetails}
              >
                <Info className="w-6 h-6" />
                Plus d'infos
              </Button>

              {onToggleWatchlist && (
                <Button
                  size="icon"
                  variant="outline"
                  className="w-12 h-12 rounded-full border-2 border-white/50 hover:border-white"
                  onClick={onToggleWatchlist}
                >
                  {isInWatchlist ? (
                    <Check className="w-6 h-6" />
                  ) : (
                    <Plus className="w-6 h-6" />
                  )}
                </Button>
              )}
            </div>

            {/* Watch Progress */}
            {video.watchProgress && !video.watchProgress.completed && (
              <div className="max-w-md">
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-1">
                  <span>Reprise à {formatTime(video.watchProgress.currentTime)}</span>
                  <span>{Math.round(video.watchProgress.percentage)}%</span>
                </div>
                <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-600 transition-all"
                    style={{ width: `${video.watchProgress.percentage}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mute Button (when teaser is playing) */}
      {hasTeaser && (
        <Button
          size="icon"
          variant="outline"
          className="absolute bottom-8 right-8 w-10 h-10 rounded-full border-white/50 bg-black/30 hover:bg-black/50 backdrop-blur-sm"
          onClick={() => setIsMuted(!isMuted)}
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5" />
          ) : (
            <Volume2 className="w-5 h-5" />
          )}
        </Button>
      )}
    </div>
  );
};

export default VideoHero;

