import { useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  Play, 
  Video as VideoIcon,
  FolderOpen,
  Grid, 
  List, 
  Clock,
  Film,
  Plus,
  Search,
  X,
  FileVideo,
  Link,
  Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useVideos } from "@/hooks/useVideos";
import { VideoPlayer } from "@/components/VideoPlayer";
import type { Video } from "@/types/music";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { AlbumCardSkeleton, TrackTableSkeleton, PageHeaderSkeleton } from "@/components/ui/skeletons";

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

export const VideosView = () => {
  const { videos, loading, error, addVideoFiles, addVideoFromUrl, selectVideoFolders, scanVideos } = useVideos();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlTitle, setUrlTitle] = useState("");

  // Debug logging removed for production

  const displayVideos = useMemo(() => {
    if (!searchQuery.trim()) return videos;
    const query = searchQuery.toLowerCase();
    return videos.filter(video =>
      video.title.toLowerCase().includes(query) ||
      video.filePath.toLowerCase().includes(query)
    );
  }, [videos, searchQuery]);

  // Video Player View
  if (selectedVideo) {
    const currentIndex = displayVideos.findIndex(v => v.id === selectedVideo.id);
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
    const handleOpenFolder = async () => {
      if (window.electronAPI && selectedVideo.filePath) {
        const path = require('path');
        const folderPath = path.dirname(selectedVideo.filePath);
        await window.electronAPI.openPath?.(folderPath);
      }
    };

    return (
      <div className="h-full flex flex-col animate-in fade-in duration-300 bg-black">
        <VideoPlayer
          video={selectedVideo}
          videos={displayVideos}
          onClose={() => setSelectedVideo(null)}
          onNext={handleNext}
          onPrevious={handlePrevious}
          className="flex-1"
          showControls={true}
          autoPlay={true}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-300">
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <PageHeader
            title="Vidéos"
            subtitle={`${displayVideos.length} vidéos dans votre bibliothèque`}
            rightContent={
              <div className="flex rounded-lg bg-muted/30 p-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setViewMode("grid")}
                      className={cn(
                        "p-2 rounded transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
                        viewMode === "grid"
                          ? "bg-primary/20 text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Grid className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm">Vue grille</div>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setViewMode("list")}
                      className={cn(
                        "p-2 rounded transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
                        viewMode === "list"
                          ? "bg-primary/20 text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm">Vue liste</div>
                  </TooltipContent>
                </Tooltip>
              </div>
            }
          />

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Rechercher des vidéos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">Effacer la recherche</div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-muted-foreground">Chargement des vidéos...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <VideoIcon className="w-10 h-10 text-destructive" />
          </div>
          <h3 className="text-lg font-medium mb-2">Erreur</h3>
          <p className="text-muted-foreground text-sm max-w-md mb-6">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && displayVideos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-4">
            <VideoIcon className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">Aucune vidéo</h3>
          <p className="text-muted-foreground text-sm max-w-md mb-6">
            Ajoutez des vidéos depuis votre ordinateur ou une URL pour commencer.
          </p>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-2xl w-full px-4">
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
                  const files = await window.electronAPI.openVideoFile(false);
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
              Ouvrir un fichier
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
              <Upload className="w-5 h-5 mr-2" />
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

      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="p-4 bg-muted/30 rounded-lg text-xs font-mono">
          <p>Videos count: {videos.length}</p>
          <p>Display videos count: {displayVideos.length}</p>
          <p>Loading: {loading ? 'true' : 'false'}</p>
          <p>Error: {error || 'none'}</p>
        </div>
      )}

      {/* Video Grid */}
      {!loading && !error && displayVideos.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {displayVideos.map((video) => (
            <Tooltip key={video.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setSelectedVideo(video)}
                  className="group text-left p-3 rounded-xl hover:bg-card/50 transition-all duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                >
              <div className="aspect-video rounded-lg overflow-hidden mb-3 relative bg-muted">
                {video.thumbnailUrl ? (
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film className="w-12 h-12 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                    <Play className="w-6 h-6 text-primary-foreground fill-current ml-0.5" />
                  </div>
                </div>
                {video.duration > 0 && (
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-xs text-white font-mono">
                    {formatTime(video.duration)}
                  </div>
                )}
              </div>
              <p className="text-sm font-medium truncate">{video.title}</p>
              <p className="text-xs text-muted-foreground">{formatSize(video.fileSize)}</p>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-sm font-medium">{video.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{formatTime(video.duration)}</div>
                <div className="text-xs text-muted-foreground mt-1">{formatSize(video.fileSize)}</div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}

      {/* Video List */}
      {!loading && !error && displayVideos.length > 0 && viewMode === "list" && (
        <div className="bg-card/30 backdrop-blur-sm rounded-xl border border-border/30 relative">
          <div className="overflow-y-auto max-h-[calc(100vh-400px)]">
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/50">
                <tr className="border-b border-border/30">
                  <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground">
                    Nom
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                    Durée
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden lg:table-cell">
                    Taille
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-display uppercase tracking-widest text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
              {displayVideos.map((video) => (
                <tr
                  key={video.id}
                  className="group cursor-pointer hover:bg-muted/30 transition-all duration-200 ease-out"
                  onClick={() => setSelectedVideo(video)}
                >
                  <td className="px-4 py-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-9 rounded overflow-hidden bg-muted flex items-center justify-center">
                            {video.thumbnailUrl ? (
                              <img
                                src={video.thumbnailUrl}
                                alt={video.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Film className="w-6 h-6 text-muted-foreground" />
                            )}
                          </div>
                          <p className="text-sm font-medium truncate">{video.title}</p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-sm font-medium">{video.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">{formatTime(video.duration)}</div>
                        <div className="text-xs text-muted-foreground mt-1">{formatSize(video.fileSize)}</div>
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {video.duration > 0 ? formatTime(video.duration) : "-"}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-sm text-muted-foreground">{formatSize(video.fileSize)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2">
                      <Play className="w-4 h-4 mr-2" />
                      Lire
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

