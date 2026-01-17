import { useState, useMemo, useRef } from "react";
import {
  Play,
  Plus,
  Check,
  Heart,
  Share2,
  Download,
  Star,
  Clock,
  Calendar,
  Film,
  Users,
  Globe,
  X,
  ChevronDown,
  ChevronUp,
  Cloud,
  Upload,
  Subtitles,
  Volume2,
  VolumeX,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Video, VideoGenre } from "@/types/music";
import { UploadIndicator } from "./UploadIndicator";

interface VideoDetailViewProps {
  video: Video;
  relatedVideos?: Video[];
  episodes?: Video[];
  onPlay: () => void;
  onPlayFromStart?: () => void;
  onClose: () => void;
  onToggleWatchlist?: () => void;
  onToggleFavorite?: () => void;
  onUploadToCloudinary?: () => void;
  onUploadToNexus?: () => void;
  onSelectEpisode?: (episode: Video) => void;
  onSelectRelated?: (video: Video) => void;
  isInWatchlist?: boolean;
  isFavorite?: boolean;
  canUploadToCloudinary?: boolean;
  canUploadToNexus?: boolean;
  isUploadingToCloudinary?: boolean;
  isUploadingToNexus?: boolean;
}

const formatTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${mins}min`;
  }
  return `${mins} min`;
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const genreLabels: Record<VideoGenre, string> = {
  action: "Action",
  adventure: "Aventure",
  animation: "Animation",
  comedy: "Comédie",
  crime: "Crime",
  documentary: "Documentaire",
  drama: "Drame",
  family: "Familial",
  fantasy: "Fantasy",
  horror: "Horreur",
  music: "Musical",
  mystery: "Mystère",
  romance: "Romance",
  scifi: "Science-Fiction",
  thriller: "Thriller",
  war: "Guerre",
  western: "Western",
  sport: "Sport",
  biography: "Biographie",
  history: "Histoire",
  anime: "Anime",
  gaming: "Gaming",
  tutorial: "Tutoriel",
  vlog: "Vlog",
  short: "Court-métrage",
  other: "Autre",
};

export const VideoDetailView = ({
  video,
  relatedVideos = [],
  episodes = [],
  onPlay,
  onPlayFromStart,
  onClose,
  onToggleWatchlist,
  onToggleFavorite,
  onUploadToCloudinary,
  onUploadToNexus,
  onSelectEpisode,
  onSelectRelated,
  isInWatchlist = false,
  isFavorite = false,
  canUploadToCloudinary = false,
  canUploadToNexus = false,
  isUploadingToCloudinary = false,
  isUploadingToNexus = false,
}: VideoDetailViewProps) => {
  const [showFullSynopsis, setShowFullSynopsis] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
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
  const hasWatchProgress = video.watchProgress && !video.watchProgress.completed;
  const progressPercent = video.watchProgress ? Math.round(video.watchProgress.percentage) : 0;

  // Group episodes by season
  const episodesBySeason = useMemo(() => {
    const grouped: Record<number, Video[]> = {};
    episodes.forEach((ep) => {
      const season = ep.episodeInfo?.seasonNumber || 1;
      if (!grouped[season]) grouped[season] = [];
      grouped[season].push(ep);
    });
    // Sort episodes within each season
    Object.keys(grouped).forEach((season) => {
      grouped[parseInt(season)].sort(
        (a, b) => (a.episodeInfo?.episodeNumber || 0) - (b.episodeInfo?.episodeNumber || 0)
      );
    });
    return grouped;
  }, [episodes]);

  const seasons = Object.keys(episodesBySeason).map(Number).sort((a, b) => a - b);

  return (
    <div className="fixed inset-0 z-[9999] bg-background overflow-y-auto">
      {/* Close Button */}
      <Button
        size="icon"
        variant="ghost"
        className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70"
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </Button>

      {/* Hero Section */}
      <div className="relative w-full h-[50vh] min-h-[400px]">
        {/* Background Video/Image */}
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
                // For auto-generated teaser, start from beginning
                if (videoRef.current && !video.trailerUrl && !video.previewUrl) {
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
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-background flex items-center justify-center">
            <Film className="w-32 h-32 text-muted-foreground" />
          </div>
        )}

        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent" />

        {/* Mute Button (when teaser is playing) */}
        {hasTeaser && (
          <Button
            size="icon"
            variant="outline"
            className="absolute bottom-8 right-8 w-10 h-10 rounded-full border-white/50 bg-black/30 hover:bg-black/50 backdrop-blur-sm z-20"
            onClick={() => setIsMuted(!isMuted)}
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </Button>
        )}

        {/* Poster (for series/movies) */}
        <div className="absolute bottom-0 left-8 transform translate-y-1/4 hidden md:block">
          {video.posterUrl && (
            <div className="relative">
              <img
                src={video.posterUrl}
                alt={video.title}
                className="w-48 h-72 object-cover rounded-lg shadow-2xl border-4 border-background"
              />
              {video.cloudStatus?.isUploaded && (
                <div className="absolute top-2 left-2">
                  <UploadIndicator provider={video.cloudStatus.provider} size="md" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 pb-12 max-w-7xl">
        <div className="md:ml-56 -mt-32 relative z-10">
          {/* Title Section */}
          <div className="space-y-4 mb-8">
            {/* Cloud Status */}
            {video.cloudStatus?.isUploaded && (
              <div className="flex items-center gap-2">
                <UploadIndicator provider={video.cloudStatus.provider} />
                <span className="text-sm text-green-500 font-medium">
                  Uploadé sur {video.cloudStatus.provider}
                </span>
              </div>
            )}

            {/* Type Badge */}
            {video.type && (
              <Badge variant="secondary" className="text-sm">
                {video.type === 'movie' && 'Film'}
                {video.type === 'series' && 'Série'}
                {video.type === 'documentary' && 'Documentaire'}
                {video.type === 'episode' && 'Épisode'}
                {video.type === 'clip' && 'Clip'}
                {video.type === 'music_video' && 'Clip Musical'}
              </Badge>
            )}

            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-bold">{video.title}</h1>

            {/* Episode Info */}
            {video.episodeInfo && (
              <p className="text-xl text-muted-foreground">
                Saison {video.episodeInfo.seasonNumber}, Épisode {video.episodeInfo.episodeNumber}
                {video.episodeInfo.episodeTitle && ` - ${video.episodeInfo.episodeTitle}`}
              </p>
            )}

            {/* Metadata Row */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {rating && (
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                  <span className="font-semibold text-foreground">{rating.value}</span>
                  <span>/{rating.maxValue}</span>
                  {rating.votes && <span>({rating.votes.toLocaleString()} votes)</span>}
                </div>
              )}
              {video.userRating && (
                <div className="flex items-center gap-1 text-primary">
                  <Star className="w-4 h-4 fill-current" />
                  <span>Votre note : {video.userRating}/10</span>
                </div>
              )}
              {video.year && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {video.year}
                </span>
              )}
              {video.duration > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatTime(video.duration)}
                </span>
              )}
              {video.quality && (
                <Badge variant="outline">{video.quality}</Badge>
              )}
              {video.ageRating && (
                <Badge variant="outline">{video.ageRating}</Badge>
              )}
            </div>

            {/* Genres */}
            {video.genres && video.genres.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {video.genres.map((genre) => (
                  <Badge key={genre} variant="secondary" className="capitalize">
                    {genreLabels[genre] || genre}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 mb-8">
            <Button
              size="lg"
              className="gap-2 bg-white text-black hover:bg-white/90"
              onClick={onPlay}
            >
              <Play className="w-5 h-5 fill-current" />
              {hasWatchProgress ? `Reprendre (${progressPercent}%)` : "Lecture"}
            </Button>

            {hasWatchProgress && onPlayFromStart && (
              <Button size="lg" variant="secondary" className="gap-2" onClick={onPlayFromStart}>
                <Play className="w-5 h-5" />
                Depuis le début
              </Button>
            )}

            <Button
              size="icon"
              variant="outline"
              className="w-12 h-12 rounded-full"
              onClick={onToggleWatchlist}
            >
              {isInWatchlist ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </Button>

            <Button
              size="icon"
              variant="outline"
              className="w-12 h-12 rounded-full"
              onClick={onToggleFavorite}
            >
              <Heart className={cn("w-5 h-5", isFavorite && "fill-red-500 text-red-500")} />
            </Button>

            <Button size="icon" variant="outline" className="w-12 h-12 rounded-full">
              <Share2 className="w-5 h-5" />
            </Button>

            {/* Cloud Upload Options */}
            {(canUploadToCloudinary || canUploadToNexus) && !video.cloudStatus?.isUploaded && (
              <div className="flex items-center gap-2 ml-4 pl-4 border-l border-border">
                {canUploadToCloudinary && (
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={onUploadToCloudinary}
                    disabled={isUploadingToCloudinary}
                  >
                    <Cloud className="w-4 h-4" />
                    {isUploadingToCloudinary ? "Upload..." : "Cloudinary (Serveur 0)"}
                    {!isUploadingToCloudinary && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                  </Button>
                )}
                {canUploadToNexus && (
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={onUploadToNexus}
                    disabled={isUploadingToNexus}
                  >
                    <Upload className="w-4 h-4" />
                    {isUploadingToNexus ? "Upload..." : "PlanetHoster (Serveur 2)"}
                    {!isUploadingToNexus && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Watch Progress Bar */}
          {hasWatchProgress && (
            <div className="mb-8 max-w-md">
              <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-600 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Dernière lecture à {formatTime(video.watchProgress!.currentTime)} sur{" "}
                {formatTime(video.watchProgress!.duration)}
              </p>
            </div>
          )}

          {/* Tagline & Synopsis */}
          <div className="space-y-4 mb-8 max-w-3xl">
            {video.tagline && (
              <p className="text-lg text-muted-foreground italic">
                "{video.tagline}"
              </p>
            )}

            {(video.synopsis || video.description) && (
              <div>
                <p
                  className={cn(
                    "text-base text-muted-foreground",
                    !showFullSynopsis && "line-clamp-4"
                  )}
                >
                  {video.synopsis || video.description}
                </p>
                {(video.synopsis || video.description || "").length > 300 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 gap-1"
                    onClick={() => setShowFullSynopsis(!showFullSynopsis)}
                  >
                    {showFullSynopsis ? (
                      <>
                        <ChevronUp className="w-4 h-4" /> Moins
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" /> Plus
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {/* Cast */}
            {video.cast && video.cast.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Distribution
                </h3>
                <p className="text-sm">{video.cast.join(", ")}</p>
              </div>
            )}

            {/* Director */}
            {video.director && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Réalisation</h3>
                <p className="text-sm">{video.director}</p>
              </div>
            )}

            {/* Studio */}
            {video.studio && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Studio</h3>
                <p className="text-sm">{video.studio}</p>
              </div>
            )}

            {/* Country & Language */}
            {(video.country || video.language) && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4" /> Origine
                </h3>
                <p className="text-sm">
                  {[video.country, video.language].filter(Boolean).join(" • ")}
                </p>
              </div>
            )}

            {/* Release Date */}
            {video.releaseDate && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Date de sortie</h3>
                <p className="text-sm">{formatDate(video.releaseDate)}</p>
              </div>
            )}

            {/* Technical Info */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Informations techniques</h3>
              <div className="text-sm space-y-1">
                {video.width && video.height && (
                  <p>Résolution : {video.width} × {video.height}</p>
                )}
                {video.format && <p>Format : {video.format.toUpperCase()}</p>}
                {video.codec && <p>Codec : {video.codec}</p>}
                {video.bitrate && <p>Débit : {(video.bitrate / 1000).toFixed(0)} kbps</p>}
                {video.frameRate && <p>FPS : {video.frameRate}</p>}
                {video.fileSize && <p>Taille : {formatSize(video.fileSize)}</p>}
              </div>
            </div>

            {/* Subtitles */}
            {video.subtitles && video.subtitles.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                  <Subtitles className="w-4 h-4" /> Sous-titres ({video.subtitles.length})
                </h3>
                <div className="flex flex-wrap gap-1">
                  {video.subtitles.map((sub) => (
                    <Badge key={sub.id} variant="outline" className="text-xs">
                      {sub.label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Audio Tracks */}
            {video.audioTracks && video.audioTracks.length > 1 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                  <Volume2 className="w-4 h-4" /> Pistes audio ({video.audioTracks.length})
                </h3>
                <div className="flex flex-wrap gap-1">
                  {video.audioTracks.map((track) => (
                    <Badge key={track.id} variant="outline" className="text-xs">
                      {track.label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tabs for Episodes / Related / Chapters */}
          <Tabs defaultValue={episodes.length > 0 ? "episodes" : "related"} className="mt-8">
            <TabsList>
              {episodes.length > 0 && (
                <TabsTrigger value="episodes">Épisodes</TabsTrigger>
              )}
              {video.chapters && video.chapters.length > 0 && (
                <TabsTrigger value="chapters">Chapitres</TabsTrigger>
              )}
              {relatedVideos.length > 0 && (
                <TabsTrigger value="related">Similaires</TabsTrigger>
              )}
            </TabsList>

            {/* Episodes Tab */}
            {episodes.length > 0 && (
              <TabsContent value="episodes" className="mt-6">
                {/* Season Selector */}
                {seasons.length > 1 && (
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm text-muted-foreground">Saison :</span>
                    <div className="flex gap-1">
                      {seasons.map((s) => (
                        <Button
                          key={s}
                          variant={selectedSeason === s ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedSeason(s)}
                        >
                          {s}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Episodes Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(episodesBySeason[selectedSeason] || []).map((ep) => (
                    <div
                      key={ep.id}
                      className="group cursor-pointer rounded-lg overflow-hidden bg-card hover:bg-muted/50 transition-colors"
                      onClick={() => onSelectEpisode?.(ep)}
                    >
                      <div className="aspect-video relative">
                        {ep.thumbnailUrl ? (
                          <img
                            src={ep.thumbnailUrl}
                            alt={ep.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Film className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-12 h-12 text-white" />
                        </div>
                        {ep.duration > 0 && (
                          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 rounded text-xs">
                            {formatTime(ep.duration)}
                          </span>
                        )}
                        {/* Episode progress */}
                        {ep.watchProgress && !ep.watchProgress.completed && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30">
                            <div
                              className="h-full bg-red-600"
                              style={{ width: `${ep.watchProgress.percentage}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium">
                          {ep.episodeInfo?.episodeNumber}. {ep.episodeInfo?.episodeTitle || ep.title}
                        </p>
                        {ep.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {ep.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            )}

            {/* Chapters Tab */}
            {video.chapters && video.chapters.length > 0 && (
              <TabsContent value="chapters" className="mt-6">
                <div className="space-y-2">
                  {video.chapters.map((chapter, index) => (
                    <div
                      key={chapter.id}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <span className="text-sm text-muted-foreground w-8">{index + 1}</span>
                      {chapter.thumbnailUrl && (
                        <img
                          src={chapter.thumbnailUrl}
                          alt={chapter.title}
                          className="w-24 h-14 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-medium">{chapter.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatTime(chapter.startTime)} - {formatTime(chapter.endTime)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            )}

            {/* Related Videos Tab */}
            {relatedVideos.length > 0 && (
              <TabsContent value="related" className="mt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {relatedVideos.map((related) => (
                    <div
                      key={related.id}
                      className="group cursor-pointer"
                      onClick={() => onSelectRelated?.(related)}
                    >
                      <div className="aspect-video rounded-lg overflow-hidden relative">
                        {related.thumbnailUrl || related.posterUrl ? (
                          <img
                            src={related.thumbnailUrl || related.posterUrl}
                            alt={related.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Film className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-8 h-8 text-white" />
                        </div>
                      </div>
                      <p className="text-sm font-medium mt-2 line-clamp-2">{related.title}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default VideoDetailView;

