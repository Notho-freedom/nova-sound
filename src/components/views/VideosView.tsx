"use client";

import { useState, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  Play,
  Video as VideoIcon,
  FolderOpen,
  Grid,
  List,
  Film,
  Search,
  X,
  FileVideo,
  Link,
  Upload,
  Filter,
  SortAsc,
  Clock,
  Star,
  Heart,
  Bookmark,
  Plus,
  TrendingUp,
  Sparkles,
  History,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useVideoLibrary } from "@/hooks/useVideoLibrary";
import { useVideoUpload } from "@/hooks/useVideoUpload";
import { useCloudSync } from "@/hooks/useCloudSync";
import { VideoPlayer } from "@/components/VideoPlayer";
import { CinemaMode } from "@/components/CinemaMode";
import { VideoHero } from "@/components/VideoHero";
import { VideoCarousel } from "@/components/VideoCarousel";
import { VideoDetailView } from "@/components/VideoDetailView";
import { VideoContextMenu } from "@/components/VideoContextMenu";
import { UploadIndicator } from "@/components/UploadIndicator";
import type { Video, VideoGenre } from "@/types/music";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { toast } from "sonner";

const formatTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
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

type SortOption = "recent" | "title" | "duration" | "size" | "rating" | "added";
type ViewMode = "home" | "browse" | "watchlist" | "favorites" | "history";

export const VideosView = () => {
  const {
    loading,
    error,
    enhancedVideos,
    continueWatching,
    recentlyAdded,
    recentlyWatched,
    watchlistVideos,
    favoriteVideos,
    availableGenres,
    getVideosByGenre,
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist,
    toggleFavorite,
    isFavorite,
    updateWatchProgress,
    addToWatchHistory,
    markAsWatched,
    markAsUnwatched,
    setUserRating,
    selectVideoFolders,
    scanVideos,
    addVideoFiles,
    addVideoFromUrl,
  } = useVideoLibrary();

  const {
    uploadVideoToCloudinary,
    uploadVideoToNexus,
    getCloudinaryProgress,
    getNexusProgress,
    isUploadingToCloudinary,
    isUploadingToNexus,
  } = useVideoUpload();

  const { cloudinaryConfigured, nexusIsPro, nexusAuthenticated } = useCloudSync();

  // View states
  const [viewMode, setViewMode] = useState<ViewMode>("home");
  const [displayMode, setDisplayMode] = useState<"grid" | "list">("grid");
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [detailVideo, setDetailVideo] = useState<Video | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<VideoGenre | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [isFullApp, setIsFullApp] = useState(false);
  const [isCinemaMode, setIsCinemaMode] = useState(false);
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlTitle, setUrlTitle] = useState("");

  // Get hero video (featured - first from continue watching or recently added)
  const heroVideo = useMemo(() => {
    if (continueWatching.length > 0) return continueWatching[0];
    if (recentlyAdded.length > 0) return recentlyAdded[0];
    if (enhancedVideos.length > 0) return enhancedVideos[0];
    return null;
  }, [continueWatching, recentlyAdded, enhancedVideos]);

  // Filtered and sorted videos for browse mode
  const filteredVideos = useMemo(() => {
    let result = [...enhancedVideos];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (v) =>
          v.title.toLowerCase().includes(query) ||
          v.description?.toLowerCase().includes(query) ||
          v.director?.toLowerCase().includes(query) ||
          v.cast?.some((c) => c.toLowerCase().includes(query))
      );
    }

    // Genre filter
    if (selectedGenre) {
      result = result.filter((v) => v.genres?.includes(selectedGenre));
    }

    // Sort
    switch (sortBy) {
      case "title":
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "duration":
        result.sort((a, b) => b.duration - a.duration);
        break;
      case "size":
        result.sort((a, b) => b.fileSize - a.fileSize);
        break;
      case "rating":
        result.sort((a, b) => (b.userRating || 0) - (a.userRating || 0));
        break;
      case "added":
        result.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
        break;
      case "recent":
      default:
        result.sort((a, b) => {
          const aTime = a.lastPlayedAt ? new Date(a.lastPlayedAt).getTime() : 0;
          const bTime = b.lastPlayedAt ? new Date(b.lastPlayedAt).getTime() : 0;
          return bTime - aTime || new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
        });
    }

    return result;
  }, [enhancedVideos, searchQuery, selectedGenre, sortBy]);

  // Get videos by current view
  const displayVideos = useMemo(() => {
    switch (viewMode) {
      case "watchlist":
        return watchlistVideos;
      case "favorites":
        return favoriteVideos;
      case "history":
        return recentlyWatched;
      case "browse":
        return filteredVideos;
      default:
        return enhancedVideos;
    }
  }, [viewMode, watchlistVideos, favoriteVideos, recentlyWatched, filteredVideos, enhancedVideos]);

  // Handlers
  const handlePlayVideo = useCallback((video: Video) => {
    setSelectedVideo(video);
    addToWatchHistory(video.id);
  }, [addToWatchHistory]);

  const handleViewDetails = useCallback((video: Video) => {
    setDetailVideo(video);
  }, []);

  const handleToggleWatchlist = useCallback((video: Video) => {
    if (isInWatchlist(video.id)) {
      removeFromWatchlist(video.id);
      toast.success("Retiré de Ma liste");
    } else {
      addToWatchlist(video.id);
      toast.success("Ajouté à Ma liste");
    }
  }, [isInWatchlist, addToWatchlist, removeFromWatchlist]);

  const handleToggleFavorite = useCallback((video: Video) => {
    toggleFavorite(video.id);
    toast.success(isFavorite(video.id) ? "Retiré des favoris" : "Ajouté aux favoris");
  }, [toggleFavorite, isFavorite]);

  // Cinema Mode View
  if (selectedVideo && isCinemaMode) {
    const currentIndex = displayVideos.findIndex((v) => v.id === selectedVideo.id);
    const handleNext = () => {
      if (currentIndex >= 0 && currentIndex < displayVideos.length - 1) {
        setSelectedVideo(displayVideos[currentIndex + 1]);
      }
    };
    const handlePrevious = () => {
      if (currentIndex > 0) {
        setSelectedVideo(displayVideos[currentIndex - 1]);
      }
    };

    return (
      <CinemaMode
        video={selectedVideo}
        videos={displayVideos}
        onClose={() => {
          setIsCinemaMode(false);
          setSelectedVideo(null);
        }}
        onNext={handleNext}
        onPrevious={handlePrevious}
        autoPlay={true}
      />
    );
  }

  // Video Player View
  if (selectedVideo) {
    const currentIndex = displayVideos.findIndex((v) => v.id === selectedVideo.id);
    const handleNext = () => {
      if (currentIndex >= 0 && currentIndex < displayVideos.length - 1) {
        setSelectedVideo(displayVideos[currentIndex + 1]);
      }
    };
    const handlePrevious = () => {
      if (currentIndex > 0) {
        setSelectedVideo(displayVideos[currentIndex - 1]);
      }
    };

    return (
      <div
        className={cn(
          "flex flex-col animate-in fade-in duration-300 bg-black",
          isFullApp ? "fixed inset-0 z-[9998]" : "absolute inset-0"
        )}
      >
        <VideoPlayer
          video={selectedVideo}
          videos={displayVideos}
          onClose={() => {
            setIsFullApp(false);
            setSelectedVideo(null);
          }}
          onNext={handleNext}
          onPrevious={handlePrevious}
          className="w-full h-full"
          showControls={true}
          autoPlay={true}
          onFullApp={() => setIsFullApp(!isFullApp)}
          onCinemaMode={() => setIsCinemaMode(true)}
          isFullApp={isFullApp}
        />
      </div>
    );
  }

  // Video Detail View
  if (detailVideo) {
    return (
      <VideoDetailView
        video={detailVideo}
        relatedVideos={enhancedVideos.filter((v) => v.id !== detailVideo.id).slice(0, 12)}
        onPlay={() => {
          setDetailVideo(null);
          handlePlayVideo(detailVideo);
        }}
        onPlayFromStart={() => {
          setDetailVideo(null);
          handlePlayVideo(detailVideo);
        }}
        onClose={() => setDetailVideo(null)}
        onToggleWatchlist={() => handleToggleWatchlist(detailVideo)}
        onToggleFavorite={() => handleToggleFavorite(detailVideo)}
        onUploadToCloudinary={() => uploadVideoToCloudinary(detailVideo)}
        onUploadToNexus={() => uploadVideoToNexus(detailVideo)}
        isInWatchlist={isInWatchlist(detailVideo.id)}
        isFavorite={isFavorite(detailVideo.id)}
        canUploadToCloudinary={cloudinaryConfigured || nexusIsPro}
        canUploadToNexus={nexusIsPro && nexusAuthenticated}
        isUploadingToCloudinary={isUploadingToCloudinary}
        isUploadingToNexus={isUploadingToNexus}
      />
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col animate-in fade-in duration-300 overflow-hidden">
      {/* Navigation Tabs */}
      <div className="flex-shrink-0 border-b border-border/30 bg-background/80 backdrop-blur-sm px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setViewMode("home")}
              className={cn(
                "text-sm font-medium transition-colors",
                viewMode === "home" ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkles className="w-4 h-4 inline mr-2" />
              Accueil
            </button>
            <button
              onClick={() => setViewMode("browse")}
              className={cn(
                "text-sm font-medium transition-colors",
                viewMode === "browse" ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Grid className="w-4 h-4 inline mr-2" />
              Parcourir
            </button>
            <button
              onClick={() => setViewMode("watchlist")}
              className={cn(
                "text-sm font-medium transition-colors",
                viewMode === "watchlist" ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Bookmark className="w-4 h-4 inline mr-2" />
              Ma liste
              {watchlistVideos.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {watchlistVideos.length}
                </Badge>
              )}
            </button>
            <button
              onClick={() => setViewMode("favorites")}
              className={cn(
                "text-sm font-medium transition-colors",
                viewMode === "favorites" ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Heart className="w-4 h-4 inline mr-2" />
              Favoris
            </button>
            <button
              onClick={() => setViewMode("history")}
              className={cn(
                "text-sm font-medium transition-colors",
                viewMode === "history" ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <History className="w-4 h-4 inline mr-2" />
              Historique
            </button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value) setViewMode("browse");
                }}
                className="pl-10 pr-10 w-64"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Effacer la recherche"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Add buttons */}
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const folders = await selectVideoFolders();
                if (folders.length > 0) {
                  await scanVideos(folders);
                }
              }}
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              Ajouter
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-muted-foreground">Chargement des vidéos...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <VideoIcon className="w-10 h-10 text-destructive" />
            </div>
            <h3 className="text-lg font-medium mb-2">Erreur</h3>
            <p className="text-muted-foreground text-sm max-w-md mb-6">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && enhancedVideos.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-24 h-24 rounded-full bg-muted/30 flex items-center justify-center mb-6">
              <Film className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-bold mb-3">Bienvenue dans votre vidéothèque</h3>
            <p className="text-muted-foreground text-base max-w-lg mb-8">
              Ajoutez vos films, séries et vidéos pour créer votre bibliothèque personnelle.
              Profitez d'une expérience de streaming comme Netflix, directement depuis vos fichiers.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 max-w-2xl w-full">
              <Button
                onClick={async () => {
                  const folders = await selectVideoFolders();
                  if (folders.length > 0) {
                    await scanVideos(folders);
                  }
                }}
                className="flex-1"
                size="lg"
              >
                <FolderOpen className="w-5 h-5 mr-2" />
                Ouvrir un dossier
              </Button>

              <Button
                onClick={async () => {
                  if (window.electronAPI?.openVideoFile) {
                    const files = await window.electronAPI.openVideoFile(true);
                    if (files.length > 0) {
                      await addVideoFiles(files);
                    }
                  }
                }}
                variant="outline"
                className="flex-1"
                size="lg"
              >
                <FileVideo className="w-5 h-5 mr-2" />
                Ouvrir des fichiers
              </Button>

              <Button
                onClick={() => setShowUrlDialog(true)}
                variant="outline"
                className="flex-1"
                size="lg"
              >
                <Link className="w-5 h-5 mr-2" />
                Depuis une URL
              </Button>
            </div>
          </div>
        )}

        {/* Home View - Netflix Style */}
        {!loading && !error && enhancedVideos.length > 0 && viewMode === "home" && (
          <div className="space-y-8 pb-12">
            {/* Hero Banner */}
            {heroVideo && (
              <VideoHero
                video={heroVideo}
                onPlay={() => handlePlayVideo(heroVideo)}
                onViewDetails={() => handleViewDetails(heroVideo)}
                onToggleWatchlist={() => handleToggleWatchlist(heroVideo)}
                isInWatchlist={isInWatchlist(heroVideo.id)}
              />
            )}

            <div className="px-6 space-y-10">
              {/* Continue Watching */}
              {continueWatching.length > 0 && (
                <VideoCarousel
                  title="Reprendre la lecture"
                  videos={continueWatching}
                  onVideoSelect={handlePlayVideo}
                  onViewDetails={handleViewDetails}
                  onToggleWatchlist={handleToggleWatchlist}
                  onToggleFavorite={handleToggleFavorite}
                  isInWatchlist={isInWatchlist}
                  isFavorite={isFavorite}
                  showProgress
                />
              )}

              {/* Watchlist */}
              {watchlistVideos.length > 0 && (
                <VideoCarousel
                  title="Ma liste"
                  videos={watchlistVideos}
                  onVideoSelect={handlePlayVideo}
                  onViewDetails={handleViewDetails}
                  onToggleWatchlist={handleToggleWatchlist}
                  onToggleFavorite={handleToggleFavorite}
                  isInWatchlist={isInWatchlist}
                  isFavorite={isFavorite}
                />
              )}

              {/* Recently Added */}
              {recentlyAdded.length > 0 && (
                <VideoCarousel
                  title="Ajoutés récemment"
                  videos={recentlyAdded}
                  onVideoSelect={handlePlayVideo}
                  onViewDetails={handleViewDetails}
                  onToggleWatchlist={handleToggleWatchlist}
                  onToggleFavorite={handleToggleFavorite}
                  isInWatchlist={isInWatchlist}
                  isFavorite={isFavorite}
                />
              )}

              {/* Top 10 Style */}
              {enhancedVideos.length >= 10 && (
                <VideoCarousel
                  title="Les plus regardés"
                  videos={enhancedVideos
                    .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
                    .slice(0, 10)}
                  onVideoSelect={handlePlayVideo}
                  onViewDetails={handleViewDetails}
                  onToggleWatchlist={handleToggleWatchlist}
                  onToggleFavorite={handleToggleFavorite}
                  isInWatchlist={isInWatchlist}
                  isFavorite={isFavorite}
                  showRank
                />
              )}

              {/* By Genre */}
              {availableGenres.slice(0, 5).map((genre) => {
                const genreVideos = getVideosByGenre(genre);
                if (genreVideos.length < 3) return null;
                return (
                  <VideoCarousel
                    key={genre}
                    title={genreLabels[genre] || genre}
                    videos={genreVideos}
                    onVideoSelect={handlePlayVideo}
                    onViewDetails={handleViewDetails}
                    onToggleWatchlist={handleToggleWatchlist}
                    onToggleFavorite={handleToggleFavorite}
                    isInWatchlist={isInWatchlist}
                    isFavorite={isFavorite}
                  />
                );
              })}

              {/* All Videos */}
              <VideoCarousel
                title="Toutes les vidéos"
                videos={enhancedVideos}
                onVideoSelect={handlePlayVideo}
                onViewDetails={handleViewDetails}
                onToggleWatchlist={handleToggleWatchlist}
                onToggleFavorite={handleToggleFavorite}
                isInWatchlist={isInWatchlist}
                isFavorite={isFavorite}
              />
            </div>
          </div>
        )}

        {/* Browse View */}
        {!loading && !error && enhancedVideos.length > 0 && viewMode === "browse" && (
          <div className="p-6 space-y-6">
            {/* Filters */}
            <div className="flex items-center gap-4 flex-wrap">
              <Select
                value={selectedGenre || "all"}
                onValueChange={(v) => setSelectedGenre(v === "all" ? null : (v as VideoGenre))}
              >
                <SelectTrigger className="w-40">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Genre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les genres</SelectItem>
                  {availableGenres.map((genre) => (
                    <SelectItem key={genre} value={genre}>
                      {genreLabels[genre] || genre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-40">
                  <SortAsc className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Trier par" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Récents</SelectItem>
                  <SelectItem value="title">Titre</SelectItem>
                  <SelectItem value="duration">Durée</SelectItem>
                  <SelectItem value="size">Taille</SelectItem>
                  <SelectItem value="rating">Note</SelectItem>
                  <SelectItem value="added">Date d'ajout</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex rounded-lg bg-muted/30 p-1 ml-auto">
                <button
                  onClick={() => setDisplayMode("grid")}
                  aria-label="Vue grille"
                  className={cn(
                    "p-2 rounded transition-all",
                    displayMode === "grid"
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDisplayMode("list")}
                  aria-label="Vue liste"
                  className={cn(
                    "p-2 rounded transition-all",
                    displayMode === "list"
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              <span className="text-sm text-muted-foreground">
                {filteredVideos.length} vidéo(s)
              </span>
            </div>

            {/* Grid View */}
            {displayMode === "grid" && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredVideos.map((video) => (
                  <VideoContextMenu
                    key={video.id}
                    video={video}
                    isFavorite={isFavorite(video.id)}
                    isInWatchlist={isInWatchlist(video.id)}
                    hasWatchProgress={!!video.watchProgress}
                    onPlay={() => handlePlayVideo(video)}
                    onViewDetails={() => handleViewDetails(video)}
                    onToggleWatchlist={() => handleToggleWatchlist(video)}
                    onToggleFavorite={() => handleToggleFavorite(video)}
                    onMarkAsWatched={() => markAsWatched(video.id)}
                    onMarkAsUnwatched={() => markAsUnwatched(video.id)}
                    onUploadToCloudinary={() => uploadVideoToCloudinary(video)}
                    onUploadToNexus={() => uploadVideoToNexus(video)}
                    canUploadToCloudinary={cloudinaryConfigured || nexusIsPro}
                    canUploadToNexus={nexusIsPro && nexusAuthenticated}
                    onRate={(rating) => setUserRating(video.id, rating)}
                  >
                    <div
                      className="group cursor-pointer p-2 rounded-xl hover:bg-card/50 transition-all"
                      onClick={() => handleViewDetails(video)}
                    >
                      <div className="aspect-video rounded-lg overflow-hidden relative bg-muted">
                        {video.thumbnailUrl || video.posterUrl ? (
                          <img
                            src={video.thumbnailUrl || video.posterUrl}
                            alt={video.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film className="w-12 h-12 text-muted-foreground" />
                          </div>
                        )}

                        {/* Cloud indicator */}
                        {video.cloudStatus?.isUploaded && (
                          <div className="absolute top-2 left-2">
                            <UploadIndicator provider={video.cloudStatus.provider} size="sm" />
                          </div>
                        )}

                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            className="w-12 h-12 rounded-full bg-primary"
                            aria-label={`Lire ${video.title}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayVideo(video);
                            }}
                          >
                            <Play className="w-6 h-6 fill-current" />
                          </Button>
                        </div>

                        {/* Duration */}
                        {video.duration > 0 && (
                          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-xs text-white font-mono">
                            {formatTime(video.duration)}
                          </div>
                        )}

                        {/* Progress bar */}
                        {video.watchProgress && !video.watchProgress.completed && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30">
                            <div
                              className="h-full bg-red-600"
                              style={{ width: `${video.watchProgress.percentage}%` }}
                            />
                          </div>
                        )}
                      </div>

                      <div className="mt-2 px-1">
                        <h3 className="text-sm font-medium truncate">{video.title}</h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {video.year && <span>{video.year}</span>}
                          <span>{formatSize(video.fileSize)}</span>
                        </div>
                      </div>
                    </div>
                  </VideoContextMenu>
                ))}
              </div>
            )}

            {/* List View */}
            {displayMode === "list" && (
              <div className="bg-card/30 backdrop-blur-sm rounded-xl border border-border/30 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 z-10 bg-background/80 backdrop-blur-md">
                      <tr className="border-b border-border/30">
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Titre
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                          Durée
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                          Taille
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                          Format
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVideos.map((video) => (
                        <VideoContextMenu
                          key={video.id}
                          video={video}
                          isFavorite={isFavorite(video.id)}
                          isInWatchlist={isInWatchlist(video.id)}
                          hasWatchProgress={!!video.watchProgress}
                          onPlay={() => handlePlayVideo(video)}
                          onViewDetails={() => handleViewDetails(video)}
                          onToggleWatchlist={() => handleToggleWatchlist(video)}
                          onToggleFavorite={() => handleToggleFavorite(video)}
                          onMarkAsWatched={() => markAsWatched(video.id)}
                          onMarkAsUnwatched={() => markAsUnwatched(video.id)}
                          onUploadToCloudinary={() => uploadVideoToCloudinary(video)}
                          onUploadToNexus={() => uploadVideoToNexus(video)}
                          canUploadToCloudinary={cloudinaryConfigured || nexusIsPro}
                          canUploadToNexus={nexusIsPro && nexusAuthenticated}
                          onRate={(rating) => setUserRating(video.id, rating)}
                        >
                          <tr
                            className="group cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => handleViewDetails(video)}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-16 h-10 rounded overflow-hidden bg-muted flex-shrink-0 relative">
                                  {video.thumbnailUrl ? (
                                    <img
                                      src={video.thumbnailUrl}
                                      alt={video.title}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Film className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                  )}
                                  {video.cloudStatus?.isUploaded && (
                                    <div className="absolute top-0.5 left-0.5">
                                      <UploadIndicator
                                        provider={video.cloudStatus.provider}
                                        size="sm"
                                      />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{video.title}</p>
                                  {video.genres && video.genres.length > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      {video.genres.slice(0, 2).map((g) => genreLabels[g] || g).join(" • ")}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="w-4 h-4" />
                                {video.duration > 0 ? formatTime(video.duration) : "-"}
                              </div>
                            </td>
                            <td className="px-4 py-3 hidden lg:table-cell">
                              <span className="text-sm text-muted-foreground">
                                {formatSize(video.fileSize)}
                              </span>
                            </td>
                            <td className="px-4 py-3 hidden lg:table-cell">
                              <span className="text-sm text-muted-foreground uppercase">
                                {video.format || "-"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlayVideo(video);
                                }}
                              >
                                <Play className="w-4 h-4 mr-2" />
                                Lire
                              </Button>
                            </td>
                          </tr>
                        </VideoContextMenu>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Watchlist / Favorites / History Views */}
        {!loading && !error && (viewMode === "watchlist" || viewMode === "favorites" || viewMode === "history") && (
          <div className="p-6">
            <PageHeader
              title={
                viewMode === "watchlist"
                  ? "Ma liste"
                  : viewMode === "favorites"
                  ? "Favoris"
                  : "Historique"
              }
              subtitle={`${displayVideos.length} vidéo(s)`}
            />

            {displayVideos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                  {viewMode === "watchlist" && <Bookmark className="w-10 h-10 text-muted-foreground" />}
                  {viewMode === "favorites" && <Heart className="w-10 h-10 text-muted-foreground" />}
                  {viewMode === "history" && <History className="w-10 h-10 text-muted-foreground" />}
                </div>
                <h3 className="text-lg font-medium mb-2">
                  {viewMode === "watchlist" && "Votre liste est vide"}
                  {viewMode === "favorites" && "Aucun favori"}
                  {viewMode === "history" && "Aucun historique"}
                </h3>
                <p className="text-muted-foreground text-sm max-w-md">
                  {viewMode === "watchlist" &&
                    "Ajoutez des vidéos à votre liste pour les retrouver facilement."}
                  {viewMode === "favorites" &&
                    "Marquez des vidéos comme favoris pour y accéder rapidement."}
                  {viewMode === "history" && "Vos vidéos regardées apparaîtront ici."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mt-6">
                {displayVideos.map((video) => (
                  <VideoContextMenu
                    key={video.id}
                    video={video}
                    isFavorite={isFavorite(video.id)}
                    isInWatchlist={isInWatchlist(video.id)}
                    hasWatchProgress={!!video.watchProgress}
                    onPlay={() => handlePlayVideo(video)}
                    onViewDetails={() => handleViewDetails(video)}
                    onToggleWatchlist={() => handleToggleWatchlist(video)}
                    onToggleFavorite={() => handleToggleFavorite(video)}
                    onMarkAsWatched={() => markAsWatched(video.id)}
                    onMarkAsUnwatched={() => markAsUnwatched(video.id)}
                    onUploadToCloudinary={() => uploadVideoToCloudinary(video)}
                    onUploadToNexus={() => uploadVideoToNexus(video)}
                    canUploadToCloudinary={cloudinaryConfigured || nexusIsPro}
                    canUploadToNexus={nexusIsPro && nexusAuthenticated}
                    onRate={(rating) => setUserRating(video.id, rating)}
                  >
                    <div
                      className="group cursor-pointer"
                      onClick={() => handleViewDetails(video)}
                    >
                      <div className="aspect-video rounded-lg overflow-hidden relative bg-muted">
                        {video.thumbnailUrl || video.posterUrl ? (
                          <img
                            src={video.thumbnailUrl || video.posterUrl}
                            alt={video.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}

                        {video.cloudStatus?.isUploaded && (
                          <div className="absolute top-2 left-2">
                            <UploadIndicator provider={video.cloudStatus.provider} size="sm" />
                          </div>
                        )}

                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-12 h-12 text-white" />
                        </div>

                        {video.duration > 0 && (
                          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-xs text-white font-mono">
                            {formatTime(video.duration)}
                          </div>
                        )}

                        {video.watchProgress && !video.watchProgress.completed && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30">
                            <div
                              className="h-full bg-red-600"
                              style={{ width: `${video.watchProgress.percentage}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-medium mt-2 truncate">{video.title}</p>
                    </div>
                  </VideoContextMenu>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* URL Dialog */}
      {showUrlDialog && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Ajouter une vidéo depuis une URL</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">URL de la vidéo</label>
                <Input
                  type="url"
                  placeholder="https://example.com/video.mp4"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Titre (optionnel)</label>
                <Input
                  type="text"
                  placeholder="Titre de la vidéo"
                  value={urlTitle}
                  onChange={(e) => setUrlTitle(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUrlDialog(false);
                  setUrlInput("");
                  setUrlTitle("");
                }}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onClick={async () => {
                  if (urlInput.trim()) {
                    await addVideoFromUrl(urlInput.trim(), urlTitle.trim() || undefined);
                    setShowUrlDialog(false);
                    setUrlInput("");
                    setUrlTitle("");
                  }
                }}
                disabled={!urlInput.trim()}
                className="flex-1"
              >
                Ajouter
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideosView;
