import { useState } from "react";
import { Search, Play, X } from "lucide-react";
import { Track } from "@/types/music";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface SearchViewProps {
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onTrackSelect: (index: number) => void;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const categories = [
  { name: "Électronique", color: "from-primary to-blue-500" },
  { name: "Synthwave", color: "from-secondary to-pink-500" },
  { name: "Ambient", color: "from-accent to-purple-500" },
  { name: "Cyberpunk", color: "from-cyan-500 to-primary" },
  { name: "Lo-Fi", color: "from-orange-500 to-red-500" },
  { name: "Techno", color: "from-green-500 to-teal-500" },
];

export const SearchView = ({
  tracks,
  currentTrackIndex,
  isPlaying,
  onTrackSelect,
}: SearchViewProps) => {
  const [query, setQuery] = useState("");

  const filteredTracks = query
    ? tracks.filter(
        (track) =>
          track.title.toLowerCase().includes(query.toLowerCase()) ||
          track.artist.toLowerCase().includes(query.toLowerCase()) ||
          track.album.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  return (
    <div className="p-6 space-y-8">
      {/* Search Input */}
      <div className="relative max-w-2xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Rechercher des titres, artistes ou albums..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-12 pr-10 py-6 text-lg bg-muted/50 border-border/50 focus:border-primary focus:ring-primary"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {query ? (
        /* Search Results */
        <div>
          <h2 className="font-display text-lg tracking-wider mb-4">
            RÉSULTATS ({filteredTracks.length})
          </h2>
          {filteredTracks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                Aucun résultat pour "{query}"
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTracks.map((track) => {
                const actualIndex = tracks.findIndex((t) => t.id === track.id);
                const isCurrentTrack = currentTrackIndex === actualIndex;

                return (
                  <div
                    key={track.id}
                    onClick={() => onTrackSelect(actualIndex)}
                    className={cn(
                      "flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-all duration-200 group",
                      isCurrentTrack
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 relative">
                      <img
                        src={track.coverUrl || "/placeholder.svg"}
                        alt={track.album}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-5 h-5 text-white fill-current" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium truncate",
                          isCurrentTrack ? "text-primary" : "text-foreground"
                        )}
                      >
                        {track.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {track.artist} • {track.album}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground font-display">
                      {formatTime(track.duration)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Browse Categories */
        <div>
          <h2 className="font-display text-lg tracking-wider mb-4">
            PARCOURIR LES GENRES
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {categories.map((category) => (
              <button
                key={category.name}
                onClick={() => setQuery(category.name)}
                className={cn(
                  "relative h-32 rounded-xl overflow-hidden group",
                  "bg-gradient-to-br",
                  category.color
                )}
              >
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                <div className="absolute inset-0 flex items-end p-4">
                  <h3 className="font-display text-xl font-bold text-white">
                    {category.name}
                  </h3>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
