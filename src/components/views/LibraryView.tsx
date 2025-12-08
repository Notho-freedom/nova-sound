import { useState } from "react";
import { Play, Grid, List, SortAsc, Filter } from "lucide-react";
import { Track } from "@/types/music";
import { cn } from "@/lib/utils";

interface LibraryViewProps {
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onTrackSelect: (index: number) => void;
  title?: string;
  showFilters?: boolean;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

type ViewMode = "grid" | "list";
type SortMode = "title" | "artist" | "album" | "duration";

export const LibraryView = ({
  tracks,
  currentTrackIndex,
  isPlaying,
  onTrackSelect,
  title = "Bibliothèque",
  showFilters = true,
}: LibraryViewProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortMode, setSortMode] = useState<SortMode>("title");

  const sortedTracks = [...tracks].sort((a, b) => {
    switch (sortMode) {
      case "title":
        return a.title.localeCompare(b.title);
      case "artist":
        return a.artist.localeCompare(b.artist);
      case "album":
        return a.album.localeCompare(b.album);
      case "duration":
        return b.duration - a.duration;
      default:
        return 0;
    }
  });

  const totalDuration = tracks.reduce((acc, track) => acc + track.duration, 0);
  const hours = Math.floor(totalDuration / 3600);
  const minutes = Math.floor((totalDuration % 3600) / 60);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold mb-1 text-foreground">
            {title}
          </h1>
          <p className="text-muted-foreground">
            {tracks.length} titres • {hours > 0 ? `${hours}h ` : ""}{minutes} min
          </p>
        </div>

        {showFilters && (
          <div className="flex items-center gap-2">
            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
              <SortAsc className="w-4 h-4 text-muted-foreground" />
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="bg-transparent text-sm text-foreground focus:outline-none cursor-pointer"
              >
                <option value="title">Titre</option>
                <option value="artist">Artiste</option>
                <option value="album">Album</option>
                <option value="duration">Durée</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex rounded-lg bg-muted/50 p-1">
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
            </div>
          </div>
        )}
      </div>

      {/* Play All Button */}
      <button
        onClick={() => onTrackSelect(0)}
        className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium hover:scale-105 glow-cyan transition-all duration-200"
      >
        <Play className="w-5 h-5 fill-current" />
        Tout lire
      </button>

      {/* Content */}
      {viewMode === "list" ? (
        <div className="glass rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground w-12">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground">
                  Titre
                </th>
                <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                  Album
                </th>
                <th className="px-4 py-3 text-right text-xs font-display uppercase tracking-widest text-muted-foreground">
                  Durée
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTracks.map((track, idx) => {
                const actualIndex = tracks.findIndex((t) => t.id === track.id);
                const isCurrentTrack = currentTrackIndex === actualIndex;

                return (
                  <tr
                    key={track.id}
                    onClick={() => onTrackSelect(actualIndex)}
                    className={cn(
                      "group cursor-pointer transition-colors",
                      isCurrentTrack ? "bg-primary/10" : "hover:bg-muted/30"
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="w-6 flex items-center justify-center">
                        {isCurrentTrack && isPlaying ? (
                          <div className="flex items-center gap-0.5">
                            <div className="w-1 h-4 bg-primary rounded-full animate-wave" />
                            <div className="w-1 h-4 bg-primary rounded-full animate-wave" style={{ animationDelay: "0.1s" }} />
                            <div className="w-1 h-4 bg-primary rounded-full animate-wave" style={{ animationDelay: "0.2s" }} />
                          </div>
                        ) : (
                          <>
                            <span className="text-sm text-muted-foreground group-hover:hidden">
                              {idx + 1}
                            </span>
                            <Play className="w-4 h-4 text-foreground hidden group-hover:block fill-current" />
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
                          <img
                            src={track.coverUrl || "/placeholder.svg"}
                            alt={track.album}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p
                            className={cn(
                              "text-sm font-medium",
                              isCurrentTrack ? "text-primary" : "text-foreground"
                            )}
                          >
                            {track.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {track.artist}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-sm text-muted-foreground">{track.album}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-muted-foreground font-display">
                        {formatTime(track.duration)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {sortedTracks.map((track) => {
            const actualIndex = tracks.findIndex((t) => t.id === track.id);
            const isCurrentTrack = currentTrackIndex === actualIndex;

            return (
              <button
                key={track.id}
                onClick={() => onTrackSelect(actualIndex)}
                className={cn(
                  "group p-4 rounded-xl text-left transition-all duration-200",
                  "hover:bg-muted/50",
                  isCurrentTrack && "ring-2 ring-primary glow-cyan"
                )}
              >
                <div className="aspect-square rounded-lg overflow-hidden mb-3 relative">
                  <img
                    src={track.coverUrl || "/placeholder.svg"}
                    alt={track.album}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                      <Play className="w-6 h-6 text-primary-foreground fill-current ml-0.5" />
                    </div>
                  </div>
                </div>
                <p
                  className={cn(
                    "text-sm font-medium truncate",
                    isCurrentTrack ? "text-primary" : "text-foreground"
                  )}
                >
                  {track.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {track.artist}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
