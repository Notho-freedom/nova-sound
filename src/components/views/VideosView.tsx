"use client";

import { useState, useMemo, useCallback, useEffect, memo } from "react";
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
  CheckSquare,
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
import { useVideosWorker } from "@/hooks/useVideosWorker";
import { useVideoUpload } from "@/hooks/useVideoUpload";
import { useCloudSync } from "@/hooks/useCloudSync";
import { useUploadedStatus } from "@/hooks/useUploadedStatus";
import { VideoPlayer } from "@/components/VideoPlayer";
import { detectMediaSource, extractYouTubeVideoId } from "@/lib/youtube";
import { CinemaMode } from "@/components/CinemaMode";
import { VideoHero } from "@/components/VideoHero";
import { VideoCarousel } from "@/components/VideoCarousel";
import { VideoDetailView } from "@/components/VideoDetailView";
import { VideoContextMenu } from "@/components/VideoContextMenu";
import { UploadIndicator } from "@/components/UploadIndicator";
import type { Video, VideoGenre } from "@/types/music";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { VideoGridSkeleton, VideoCarouselSkeleton } from "@/components/ui/skeletons";
import { YouTubeSearchView } from "@/components/YouTubeSearchView";
import { Youtube } from "lucide-react";
import { HelpButton, HelpIcon } from "@/components/ui/HelpButton";
import { useYouTubeSuggestions } from "@/hooks/useYouTubeSuggestions";
import { useLibrary } from "@/hooks/useLibrary";
import { usePlayHistory } from "@/hooks/usePlayHistory";
import { useI18n } from "@/i18n";

const formatTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatSize = (bytes: number, sizeLabels: string[]) => {
  if (bytes < 1024) return `${bytes} ${sizeLabels[0]}`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${sizeLabels[1]}`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} ${sizeLabels[2]}`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ${sizeLabels[3]}`;
};

type SortOption = "recent" | "title" | "duration" | "size" | "rating" | "added";
type ViewMode = "home" | "browse" | "watchlist" | "favorites" | "history" | "youtube";

export const VideosView = memo(() => {
  const { t } = useI18n();
  const sizeLabels = [
    t("videosSizeBytes"),
    t("videosSizeKB"),
    t("videosSizeMB"),
    t("videosSizeGB"),
  ];
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

  // Historique audio et pistes pour les suggestions personnalisées
  const { tracks: audioTracks } = useLibrary();
  const { history: audioHistory } = usePlayHistory();

  // Suggestions YouTube basées sur l'historique
  const { trendingVideos, loadingTrending, loadTrendingFromHistory } = useYouTubeSuggestions();

  // Charger l'historique de recherche
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("nexus-search-history");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSearchHistory(parsed);
        }
      }
    } catch (error) {
      // Ignorer les erreurs de parsing
    }
  }, []);

  // Écouter les événements pour ajouter les vidéos YouTube à l'historique vidéo
  useEffect(() => {
    const handleYouTubeVideoPlayed = (event: CustomEvent<{ videoId: string; trackId: string; title: string }>) => {
      const { videoId, trackId } = event.detail;
      
      // Trouver la vidéo correspondante dans enhancedVideos
      const video = enhancedVideos.find(v => 
        v.youtubeVideoId === videoId || 
        v.id === trackId ||
        (v.mediaSource === 'youtube' && extractYouTubeVideoId(v.filePath || '') === videoId)
      );
      
      if (video) {
        // Ajouter à l'historique vidéo
        addToWatchHistory(video.id);
        console.log('[VideosView] Vidéo YouTube ajoutée à l\'historique:', video.title);
      } else {
        // Si la vidéo n'est pas dans enhancedVideos, créer une entrée temporaire
        // et l'ajouter quand même à l'historique (sera synchronisé plus tard)
        console.log('[VideosView] Vidéo YouTube non trouvée dans enhancedVideos, ajout direct à l\'historique');
        // On peut créer une vidéo temporaire ou simplement utiliser le trackId
        // Pour l'instant, on essaie d'ajouter avec le trackId
        try {
          const watchHistory = JSON.parse(localStorage.getItem("nexus-video-watch-history") || "[]");
          const newEntry = { videoId: trackId, watchedAt: new Date().toISOString() };
          const filtered = watchHistory.filter((h: any) => h.videoId !== trackId);
          const updated = [newEntry, ...filtered].slice(0, 100);
          localStorage.setItem("nexus-video-watch-history", JSON.stringify(updated));
        } catch (error) {
          console.error('[VideosView] Erreur lors de l\'ajout à l\'historique vidéo:', error);
        }
      }
    };

    window.addEventListener('youtube-video-played', handleYouTubeVideoPlayed as EventListener);
    
    return () => {
      window.removeEventListener('youtube-video-played', handleYouTubeVideoPlayed as EventListener);
    };
  }, [enhancedVideos, addToWatchHistory]);

  // Charger les suggestions YouTube basées sur l'historique au montage et quand l'historique change
  useEffect(() => {
    // Vérifier si une clé API YouTube est configurée avant de charger
    const apiKey = typeof window !== 'undefined' 
      ? localStorage.getItem("nexus-youtube-api-key") || process.env.YOUTUBE_API_KEY
      : null;
    
    if (!apiKey) {
      console.warn('[VideosView] Clé API YouTube non configurée, les suggestions ne seront pas chargées');
      return;
    }

    // Attendre que les données soient chargées
    if (audioTracks.length === 0 && enhancedVideos.length === 0 && audioHistory.length === 0 && searchHistory.length === 0) {
      return; // Pas encore de données
    }

    // Filtrer les vidéos YouTube de l'historique
    const youtubeHistoryVideos = enhancedVideos.filter(v => v.mediaSource === 'youtube');
    
    // Charger les suggestions basées sur l'historique (incluant les recherches)
    loadTrendingFromHistory(audioHistory, audioTracks, youtubeHistoryVideos, searchHistory).catch((error) => {
      console.error('[VideosView] Erreur lors du chargement des suggestions basées sur l\'historique:', error);
    });
  }, [loadTrendingFromHistory, audioHistory, audioTracks, enhancedVideos, searchHistory]);

  const {
    uploadVideoToCloudinary,
    uploadVideoToBunny,
    uploadVideoToNexus,
    getCloudinaryProgress,
    getBunnyProgress,
    getNexusProgress,
    isUploadingToCloudinary,
    isUploadingToBunny,
    isUploadingToNexus,
  } = useVideoUpload();

  const { cloudinaryConfigured, nexusIsPro, nexusAuthenticated } = useCloudSync();
  const { isUploaded: isVideoUploaded, getUploadedProvider } = useUploadedStatus();

  const genreLabels: Record<VideoGenre, string> = {
    action: t("videosGenreAction"),
    adventure: t("videosGenreAdventure"),
    animation: t("videosGenreAnimation"),
    comedy: t("videosGenreComedy"),
    crime: t("videosGenreCrime"),
    documentary: t("videosGenreDocumentary"),
    drama: t("videosGenreDrama"),
    family: t("videosGenreFamily"),
    fantasy: t("videosGenreFantasy"),
    horror: t("videosGenreHorror"),
    music: t("videosGenreMusic"),
    mystery: t("videosGenreMystery"),
    romance: t("videosGenreRomance"),
    scifi: t("videosGenreSciFi"),
    thriller: t("videosGenreThriller"),
    war: t("videosGenreWar"),
    western: t("videosGenreWestern"),
    sport: t("videosGenreSport"),
    biography: t("videosGenreBiography"),
    history: t("videosGenreHistory"),
    anime: t("videosGenreAnime"),
    gaming: t("videosGenreGaming"),
    tutorial: t("videosGenreTutorial"),
    vlog: t("videosGenreVlog"),
    short: t("videosGenreShort"),
    other: t("videosGenreOther"),
  };

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
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [youtubeAudioOnly, setYoutubeAudioOnly] = useState(false);

  const { computed } = useVideosWorker({
    enhancedVideos,
    continueWatching,
    recentlyAdded,
    recentlyWatched,
    watchlistVideos,
    favoriteVideos,
    viewMode,
    searchQuery,
    selectedGenre,
    sortBy,
  });

  const featuredVideos = computed?.featuredVideos ?? [];

  // Auto-rotate hero video every 10 seconds
  const [heroVideoIndex, setHeroVideoIndex] = useState(0);
  const heroVideo = featuredVideos[heroVideoIndex] || null;

  useEffect(() => {
    if (featuredVideos.length <= 1) return;
    
    const interval = setInterval(() => {
      setHeroVideoIndex((prev) => (prev + 1) % featuredVideos.length);
    }, 10000); // Change every 10 seconds

    return () => clearInterval(interval);
  }, [featuredVideos.length]);

  const filteredVideos = computed?.filteredVideos ?? [];

  const displayVideos = computed?.displayVideos ?? enhancedVideos;

  // Handlers
  const handlePlayVideo = useCallback((video: Video, audioOnly?: boolean) => {
    // Si c'est une vidéo YouTube et mode audio, utiliser audioOnly
    if (video.mediaSource === 'youtube' && audioOnly) {
      setYoutubeAudioOnly(true);
    } else {
      setYoutubeAudioOnly(false);
    }
    setSelectedVideo(video);
    addToWatchHistory(video.id);
  }, [addToWatchHistory]);

  const handleViewDetails = useCallback((video: Video) => {
    setDetailVideo(video);
  }, []);

  const handleToggleWatchlist = useCallback((video: Video) => {
    if (isInWatchlist(video.id)) {
      removeFromWatchlist(video.id);
      toast.success(t("videosToastRemovedFromWatchlist"));
    } else {
      addToWatchlist(video.id);
      toast.success(t("videosToastAddedToWatchlist"));
    }
  }, [isInWatchlist, addToWatchlist, removeFromWatchlist, t]);

  const handleToggleFavorite = useCallback((video: Video) => {
    toggleFavorite(video.id);
    toast.success(isFavorite(video.id) ? t("videosToastRemovedFromFavorites") : t("videosToastAddedToFavorites"));
  }, [toggleFavorite, isFavorite, t]);

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
  // Ne pas afficher le lecteur vidéo en mode YouTube (YouTubeSearchView gère sa propre lecture)
  if (selectedVideo && viewMode !== "youtube") {
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
          isFullApp ? "fixed inset-0 z-[9998]" : (viewMode as string) === "youtube" ? "fixed inset-0 z-[9997]" : "absolute inset-0"
        )}
      >
        {/* Utiliser VideoPlayer pour toutes les vidéos (locales et YouTube) */}
        <VideoPlayer
          video={selectedVideo}
          videos={displayVideos}
          onClose={() => {
            setIsFullApp(false);
            setSelectedVideo(null);
            setYoutubeAudioOnly(false);
          }}
          onNext={handleNext}
          onPrevious={handlePrevious}
          className="w-full h-full"
          showControls={true}
          autoPlay={true}
          onFullApp={() => setIsFullApp(!isFullApp)}
          onCinemaMode={() => setIsCinemaMode(true)}
          isFullApp={isFullApp}
          audioOnly={youtubeAudioOnly}
          onProgressUpdate={updateWatchProgress}
          onPlayAsAudio={(track) => {
            // Même logique que YouTubeSearchView : émettre un événement
            if (window.dispatchEvent) {
              window.dispatchEvent(new CustomEvent('youtube-audio-play', { detail: track }));
            }
          }}
        />
      </div>
    );
  }

  // Video Detail View
  if (detailVideo) {
    return (
      <VideoDetailView
        video={detailVideo}
        relatedVideos={enhancedVideos.filter((v) => v.id !== detailVideo.id)}
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
        canUploadToCloudinary={cloudinaryConfigured && nexusIsPro && nexusAuthenticated} // Pro only (serveur 0)
        canUploadToNexus={nexusIsPro && nexusAuthenticated} // Pro only (serveur 2)
        isUploadingToCloudinary={isUploadingToCloudinary}
        isUploadingToNexus={isUploadingToNexus}
      />
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col min-h-0 w-full animate-in fade-in duration-300 overflow-hidden">
      {/* Navigation Tabs */}
      <div className="flex-shrink-0 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-card/40 backdrop-blur-2xl border border-border/30 shadow-xl">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode("home")}
                className={cn(
                  "text-sm font-medium transition-colors",
                  viewMode === "home" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Sparkles className="w-4 h-4 inline mr-2" />
                {t("videosTabHome")}
              </button>
              <HelpIcon description={t("videosHelpHome")} />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode("browse")}
                className={cn(
                  "text-sm font-medium transition-colors",
                  viewMode === "browse" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Grid className="w-4 h-4 inline mr-2" />
                {t("videosTabBrowse")}
              </button>
              <HelpIcon description={t("videosHelpBrowse")} />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode("watchlist")}
                className={cn(
                  "text-sm font-medium transition-colors",
                  viewMode === "watchlist" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Bookmark className="w-4 h-4 inline mr-2" />
                {t("videosTabWatchlist")}
                {watchlistVideos.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {watchlistVideos.length}
                  </Badge>
                )}
              </button>
              <HelpIcon description={t("videosHelpWatchlist")} />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode("favorites")}
                className={cn(
                  "text-sm font-medium transition-colors",
                  viewMode === "favorites" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Heart className="w-4 h-4 inline mr-2" />
                {t("videosTabFavorites")}
              </button>
              <HelpIcon description={t("videosHelpFavorites")} />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode("history")}
                className={cn(
                  "text-sm font-medium transition-colors",
                  viewMode === "history" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <History className="w-4 h-4 inline mr-2" />
                {t("videosTabHistory")}
              </button>
              <HelpIcon description={t("videosHelpHistory")} />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode("youtube")}
                className={cn(
                  "text-sm font-medium transition-colors",
                  viewMode === "youtube" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Youtube className="w-4 h-4 inline mr-2" />
                YouTube
              </button>
              <HelpIcon description={t("videosHelpYouTube")} />
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center gap-4">
            <div className="flex-1 min-w-[220px] relative group">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 opacity-0 group-focus-within:opacity-100 blur transition-opacity" />
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-emerald-400 transition-colors" />
                <Input
                  type="text"
                  placeholder={t("videosSearchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value) setViewMode("browse");
                  }}
                  className="pl-12 pr-10 w-64 h-12 bg-background/50 border-border/50 rounded-xl focus:border-emerald-500/50 focus:ring-emerald-500/20 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted/50 transition-colors"
                    aria-label={t("videosClearSearchAria")}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
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
              {t("videosAdd")}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Loading State */}
        {loading && (
          <div className="p-6 space-y-8">
            <VideoCarouselSkeleton count={8} />
            <VideoCarouselSkeleton count={8} />
            <VideoGridSkeleton count={12} />
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <VideoIcon className="w-10 h-10 text-destructive" />
            </div>
            <h3 className="text-lg font-medium mb-2">{t("videosErrorTitle")}</h3>
            <p className="text-muted-foreground text-sm max-w-md mb-6">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && enhancedVideos.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-24 h-24 rounded-full bg-muted/30 flex items-center justify-center mb-6">
              <Film className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-bold mb-3">{t("videosEmptyTitle")}</h3>
            <p className="text-muted-foreground text-base max-w-lg mb-8">
              {t("videosEmptyDescription")}
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
                {t("videosEmptyOpenFolder")}
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
                {t("videosEmptyOpenFiles")}
              </Button>

              <Button
                onClick={() => setShowUrlDialog(true)}
                variant="outline"
                className="flex-1"
                size="lg"
              >
                <Link className="w-5 h-5 mr-2" />
                {t("videosEmptyFromUrl")}
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
                  title={t("videosCarouselContinueWatching")}
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
                  title={t("videosCarouselWatchlist")}
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
                  title={t("videosCarouselRecentlyAdded")}
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
                  title={t("videosCarouselMostWatched")}
                  videos={enhancedVideos
                    .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))}
                  onVideoSelect={handlePlayVideo}
                  onViewDetails={handleViewDetails}
                  onToggleWatchlist={handleToggleWatchlist}
                  onToggleFavorite={handleToggleFavorite}
                  isInWatchlist={isInWatchlist}
                  isFavorite={isFavorite}
                  showRank
                />
              )}

              {/* Vidéos YouTube déjà regardées */}
              {(() => {
                const youtubeWatchedVideos = recentlyWatched.filter(
                  v => v.mediaSource === 'youtube' || v.youtubeVideoId || (v.filePath && extractYouTubeVideoId(v.filePath))
                );
                return youtubeWatchedVideos.length > 0 ? (
                  <VideoCarousel
                    title={t("videosCarouselYouTubeWatched")}
                    videos={youtubeWatchedVideos}
                    onVideoSelect={handlePlayVideo}
                    onViewDetails={handleViewDetails}
                    onToggleWatchlist={handleToggleWatchlist}
                    onToggleFavorite={handleToggleFavorite}
                    isInWatchlist={isInWatchlist}
                    isFavorite={isFavorite}
                  />
                ) : null;
              })()}

              {/* By Genre */}
              {availableGenres.map((genre) => {
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
                title={t("videosCarouselAllVideos")}
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
                  <SelectValue placeholder={t("videosGenrePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("videosGenreAll")}</SelectItem>
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
                  <SelectValue placeholder={t("videosSortPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">{t("videosSortRecent")}</SelectItem>
                  <SelectItem value="title">{t("videosSortTitle")}</SelectItem>
                  <SelectItem value="duration">{t("videosSortDuration")}</SelectItem>
                  <SelectItem value="size">{t("videosSortSize")}</SelectItem>
                  <SelectItem value="rating">{t("videosSortRating")}</SelectItem>
                  <SelectItem value="added">{t("videosSortAdded")}</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 ml-auto">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectionMode(!selectionMode);
                        if (selectionMode) {
                          setSelectedVideoIds(new Set());
                        }
                      }}
                      className={cn(
                        selectionMode && "bg-primary/20 text-primary"
                      )}
                    >
                      <CheckSquare className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {selectionMode ? t("videosSelectionDisable") : t("videosSelectionEnable")}
                  </TooltipContent>
                </Tooltip>

                <div className="flex rounded-lg bg-muted/30 p-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setDisplayMode("grid")}
                        aria-label={t("videosViewGridAria")}
                        className={cn(
                          "p-2 rounded transition-all",
                          displayMode === "grid"
                            ? "bg-primary/20 text-primary"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Grid className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t("videosViewGridTooltip")}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setDisplayMode("list")}
                        aria-label={t("videosViewListAria")}
                        className={cn(
                          "p-2 rounded transition-all",
                          displayMode === "list"
                            ? "bg-primary/20 text-primary"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <List className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t("videosViewListTooltip")}</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <span className="text-sm text-muted-foreground">
                {selectionMode && selectedVideoIds.size > 0 
                  ? t("videosSelectionCount", {
                      count: selectedVideoIds.size,
                      suffix: selectedVideoIds.size > 1 ? "s" : "",
                    })
                  : t("videosCount", {
                      count: filteredVideos.length,
                      suffix: filteredVideos.length > 1 ? "s" : "",
                    })
                }
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
                    onUploadToBunny={() => uploadVideoToBunny(video)}
                    onUploadToNexus={() => uploadVideoToNexus(video)}
                    canUploadToCloudinary={cloudinaryConfigured && nexusIsPro && nexusAuthenticated} // Pro only (serveur 0)
                    canUploadToBunny={nexusIsPro && nexusAuthenticated} // Pro only (serveur 1)
                    canUploadToNexus={nexusIsPro && nexusAuthenticated} // Pro only (serveur 2)
                    isAuthenticated={nexusAuthenticated}
                    onRate={(rating) => setUserRating(video.id, rating)}
                  >
                    <div
                      className="group cursor-pointer p-2 rounded-xl hover:bg-card/50 transition-all"
                      onClick={() => {
                        if (!selectionMode) {
                          handleViewDetails(video);
                        }
                      }}
                    >
                      <div className="aspect-video rounded-lg overflow-hidden relative bg-muted">
                        {video.thumbnailUrl || video.posterUrl ? (
                          <img
                            src={video.thumbnailUrl || video.posterUrl}
                            alt={video.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // If thumbnail fails to load, try default cover, then show icon
                              const target = e.target as HTMLImageElement;
                              const currentSrc = target.src;
                              
                              // If not already trying default, try it
                              if (!currentSrc.includes('album-cover-1.jpg')) {
                                target.src = '/album-cover-1.jpg';
                                return;
                              }
                              
                              // If default also failed, show icon
                              target.style.display = 'none';
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) {
                                fallback.style.display = 'flex';
                              }
                            }}
                          />
                        ) : (
                          <img
                            src="/album-cover-1.jpg"
                            alt={video.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Hide image and show fallback icon if default also fails
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) {
                                fallback.style.display = 'flex';
                              }
                            }}
                          />
                        )}
                        <div 
                          className="w-full h-full flex items-center justify-center hidden"
                          style={{ display: 'none' }}
                        >
                          <Film className="w-12 h-12 text-muted-foreground" />
                        </div>

                        {/* Cloud indicator */}
                        {(video.cloudStatus?.isUploaded || isVideoUploaded(video.id)) && (
                          <div className="absolute top-2 left-2 z-10">
                            <UploadIndicator 
                              provider={video.cloudStatus?.provider || getUploadedProvider(video.id) || undefined} 
                              size="sm" 
                            />
                          </div>
                        )}
                        
                        {/* Selection checkbox */}
                        {selectionMode && (
                          <div className="absolute top-2 right-2 z-10">
                            <label className="sr-only" htmlFor={`video-checkbox-${video.id}`}>
                              {t("videosSelectAria", { title: video.title })}
                            </label>
                            <input
                              id={`video-checkbox-${video.id}`}
                              type="checkbox"
                              checked={selectedVideoIds.has(video.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                setSelectedVideoIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(video.id)) {
                                    next.delete(video.id);
                                  } else {
                                    next.add(video.id);
                                  }
                                  return next;
                                });
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-5 h-5 rounded border-2 border-white bg-black/50 checked:bg-primary checked:border-primary"
                              aria-label={t("videosSelectAria", { title: video.title })}
                            />
                          </div>
                        )}

                        {/* Hover overlay */}
                        {!selectionMode && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  className="w-12 h-12 rounded-full bg-primary"
                                  aria-label={t("videosPlayAria", { title: video.title })}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePlayVideo(video);
                                  }}
                                >
                                  <Play className="w-6 h-6 fill-current" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t("videosPlayTooltip", { title: video.title })}</TooltipContent>
                            </Tooltip>
                          </div>
                        )}

                        {/* Duration */}
                        {video.duration > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-xs text-white font-mono">
                                {formatTime(video.duration)}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {t("videosDurationTooltip", { time: formatTime(video.duration) })}
                            </TooltipContent>
                          </Tooltip>
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
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <h3 className="text-sm font-medium truncate">{video.title}</h3>
                          </TooltipTrigger>
                          <TooltipContent>{video.title}</TooltipContent>
                        </Tooltip>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {video.year && <span>{video.year}</span>}
                          <span>{formatSize(video.fileSize, sizeLabels)}</span>
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
                          {t("videosColumnTitle")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                          {t("videosColumnDuration")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                          {t("videosColumnSize")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                          {t("videosColumnFormat")}
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          {t("videosColumnActions")}
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
                          canUploadToCloudinary={cloudinaryConfigured && nexusIsPro && nexusAuthenticated} // Pro only (serveur 0)
                          canUploadToNexus={nexusIsPro && nexusAuthenticated}
                          isAuthenticated={nexusAuthenticated}
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
                                {formatSize(video.fileSize, sizeLabels)}
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
                                {t("videosActionPlay")}
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
        {/* YouTube Search View */}
        {viewMode === "youtube" && (
          <YouTubeSearchView
            onPlayVideo={() => {
              // Ne pas naviguer automatiquement vers le player vidéo
              // YouTubeSearchView gère sa propre lecture interne
            }}
            onAddToQueue={(video) => {
              // Ajouter à la file d'attente si nécessaire
              toast.success(t("videosToastAddedToQueue"));
            }}
            onPlayAsAudio={(track) => {
              // Jouer comme audio et naviguer vers inline player
              // Ce callback sera passé depuis DesktopApp
              if (window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('youtube-audio-play', { detail: track }));
              }
            }}
          />
        )}

        {!loading && !error && (viewMode === "watchlist" || viewMode === "favorites" || viewMode === "history") && (
          <div className="p-6">
            <PageHeader
              title={
                viewMode === "watchlist"
                  ? t("videosWatchlistTitle")
                  : viewMode === "favorites"
                  ? t("videosFavoritesTitle")
                  : t("videosHistoryTitle")
              }
              subtitle={t("videosCount", {
                count: displayVideos.length,
                suffix: displayVideos.length > 1 ? "s" : "",
              })}
            />

            {displayVideos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                  {viewMode === "watchlist" && <Bookmark className="w-10 h-10 text-muted-foreground" />}
                  {viewMode === "favorites" && <Heart className="w-10 h-10 text-muted-foreground" />}
                  {viewMode === "history" && <History className="w-10 h-10 text-muted-foreground" />}
                </div>
                <h3 className="text-lg font-medium mb-2">
                  {viewMode === "watchlist" && t("videosEmptyWatchlistTitle")}
                  {viewMode === "favorites" && t("videosEmptyFavoritesTitle")}
                  {viewMode === "history" && t("videosEmptyHistoryTitle")}
                </h3>
                <p className="text-muted-foreground text-sm max-w-md">
                  {viewMode === "watchlist" &&
                    t("videosEmptyWatchlistDescription")}
                  {viewMode === "favorites" &&
                    t("videosEmptyFavoritesDescription")}
                  {viewMode === "history" && t("videosEmptyHistoryDescription")}
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
                    onUploadToBunny={() => uploadVideoToBunny(video)}
                    onUploadToNexus={() => uploadVideoToNexus(video)}
                    canUploadToCloudinary={cloudinaryConfigured && nexusIsPro && nexusAuthenticated} // Pro only (serveur 0)
                    canUploadToBunny={nexusIsPro && nexusAuthenticated} // Pro only (serveur 1)
                    canUploadToNexus={nexusIsPro && nexusAuthenticated} // Pro only (serveur 2)
                    isAuthenticated={nexusAuthenticated}
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
            <h3 className="text-lg font-semibold mb-4">{t("videosAddFromUrlTitle")}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">{t("videosUrlLabel")}</label>
                <Input
                  type="url"
                  placeholder="https://example.com/video.mp4"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">{t("videosTitleOptionalLabel")}</label>
                <Input
                  type="text"
                  placeholder={t("videosTitlePlaceholder")}
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
                {t("videosCancel")}
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
                {t("videosAddConfirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

VideosView.displayName = 'VideosView';

export default VideosView;
