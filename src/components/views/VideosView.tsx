import { useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { 
  Play, 
  Video, 
  FolderOpen, 
  Grid, 
  List, 
  Clock,
  Film,
  Plus,
  Search,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface VideoFile {
  id: string;
  name: string;
  path: string;
  duration: number;
  thumbnail?: string;
  size: number;
  addedAt: string;
}

interface VideosViewProps {
  videos?: VideoFile[];
  onSelectFolder?: () => void;
}

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

// Mock data for demo
const mockVideos: VideoFile[] = [
  {
    id: "1",
    name: "Cyberpunk City Ambience.mp4",
    path: "/videos/cyberpunk.mp4",
    duration: 3600,
    size: 1024 * 1024 * 500,
    addedAt: new Date().toISOString(),
  },
  {
    id: "2",
    name: "Synthwave Music Video.mkv",
    path: "/videos/synthwave.mkv",
    duration: 240,
    size: 1024 * 1024 * 150,
    addedAt: new Date().toISOString(),
  },
  {
    id: "3",
    name: "Lo-Fi Beats Visualizer.webm",
    path: "/videos/lofi.webm",
    duration: 7200,
    size: 1024 * 1024 * 800,
    addedAt: new Date().toISOString(),
  },
];

export const VideosView = ({ videos = [], onSelectFolder }: VideosViewProps) => {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedVideo, setSelectedVideo] = useState<VideoFile | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const displayVideos = useMemo(() => {
    if (!searchQuery.trim()) return videos.length > 0 ? videos : [];
    const query = searchQuery.toLowerCase();
    return videos.filter(video =>
      video.name.toLowerCase().includes(query) ||
      video.path.toLowerCase().includes(query)
    );
  }, [videos, searchQuery]);

  // Video Player View
  if (selectedVideo) {
    return (
      <div className="h-full flex flex-col animate-in fade-in duration-300">
        <div className="p-4 border-b border-border/30">
          <button
            onClick={() => setSelectedVideo(null)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Retour aux vidéos
          </button>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-6 bg-black">
          <div className="w-full max-w-4xl aspect-video bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Film className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">{selectedVideo.name}</p>
              <p className="text-sm text-muted-foreground mb-4">
                Lecteur vidéo en développement
              </p>
              <Button onClick={() => setSelectedVideo(null)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border/30 bg-card/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{selectedVideo.name}</h3>
              <p className="text-sm text-muted-foreground">
                {formatTime(selectedVideo.duration)} • {formatSize(selectedVideo.size)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <FolderOpen className="w-4 h-4 mr-2" />
                Ouvrir le dossier
              </Button>
            </div>
          </div>
        </div>
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
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "p-2 rounded transition-colors",
                    viewMode === "grid"
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "p-2 rounded transition-colors",
                    viewMode === "list"
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <List className="w-4 h-4" />
                </button>
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
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

      {/* Empty State */}
      {displayVideos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-4">
            <Video className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">Aucune vidéo</h3>
          <p className="text-muted-foreground text-sm max-w-md mb-6">
            Ajoutez des dossiers contenant des vidéos dans les paramètres pour les voir ici.
          </p>
          <Button onClick={onSelectFolder}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter des vidéos
          </Button>

          {/* Feature Preview */}
          <div className="mt-12 p-6 rounded-xl bg-card/30 border border-border/30 max-w-lg">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Film className="w-5 h-5 text-primary" />
              Fonctionnalités vidéo (bientôt)
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground text-left">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                Support MP4, MKV, WebM, AVI
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                Génération automatique des vignettes
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                Lecteur vidéo intégré avec contrôles
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                Organisation par dossier
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                Plein écran et picture-in-picture
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Video Grid */}
      {displayVideos.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {displayVideos.map((video) => (
            <button
              key={video.id}
              onClick={() => setSelectedVideo(video)}
              className="group text-left p-3 rounded-xl hover:bg-card/50 transition-colors"
            >
              <div className="aspect-video rounded-lg overflow-hidden mb-3 relative bg-muted">
                {video.thumbnail ? (
                  <img
                    src={video.thumbnail}
                    alt={video.name}
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
                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-xs text-white font-mono">
                  {formatTime(video.duration)}
                </div>
              </div>
              <p className="text-sm font-medium truncate">{video.name}</p>
              <p className="text-xs text-muted-foreground">{formatSize(video.size)}</p>
            </button>
          ))}
        </div>
      )}

      {/* Video List */}
      {displayVideos.length > 0 && viewMode === "list" && (
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
                  className="group cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setSelectedVideo(video)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-9 rounded overflow-hidden bg-muted flex items-center justify-center">
                        {video.thumbnail ? (
                          <img
                            src={video.thumbnail}
                            alt={video.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Film className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-sm font-medium truncate">{video.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {formatTime(video.duration)}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-sm text-muted-foreground">{formatSize(video.size)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
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

