import { Play, Clock, TrendingUp, Sparkles } from "lucide-react";
import { Track } from "@/types/music";
import { cn } from "@/lib/utils";

interface HomeViewProps {
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

export const HomeView = ({
  tracks,
  currentTrackIndex,
  isPlaying,
  onTrackSelect,
}: HomeViewProps) => {
  const recentTracks = tracks.slice(0, 4);
  const topTracks = [...tracks].sort((a, b) => b.duration - a.duration).slice(0, 6);

  return (
    <div className="p-6 space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="font-display text-3xl font-bold mb-2 text-foreground">
          Bienvenue sur <span className="text-primary neon-text-cyan">NEXUS</span>
        </h1>
        <p className="text-muted-foreground">
          Votre système audio futuriste personnel
        </p>
      </div>

      {/* Quick Play Cards */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-primary" />
          <h2 className="font-display text-lg tracking-wider">ÉCOUTÉ RÉCEMMENT</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {recentTracks.map((track, idx) => (
            <button
              key={track.id}
              onClick={() => onTrackSelect(idx)}
              className={cn(
                "group relative overflow-hidden rounded-xl bg-muted/30 p-4 text-left transition-all duration-300",
                "hover:bg-muted/50 hover:scale-[1.02]",
                currentTrackIndex === idx && isPlaying && "ring-2 ring-primary glow-cyan"
              )}
            >
              <div className="flex items-center gap-3">
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
                  <p className="text-sm font-medium truncate text-foreground">
                    {track.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {track.artist}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Top Tracks */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-secondary" />
          <h2 className="font-display text-lg tracking-wider">VOS FAVORIS</h2>
        </div>
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
              {topTracks.map((track, idx) => {
                const actualIndex = tracks.findIndex(t => t.id === track.id);
                const isCurrentTrack = currentTrackIndex === actualIndex;
                
                return (
                  <tr
                    key={track.id}
                    onClick={() => onTrackSelect(actualIndex)}
                    className={cn(
                      "group cursor-pointer transition-colors",
                      isCurrentTrack 
                        ? "bg-primary/10" 
                        : "hover:bg-muted/30"
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="w-6 flex items-center justify-center">
                        {isCurrentTrack && isPlaying ? (
                          <div className="flex items-center gap-0.5">
                            <div className="w-1 h-4 bg-primary rounded-full animate-wave" />
                            <div className="w-1 h-4 bg-primary rounded-full animate-wave" style={{ animationDelay: '0.1s' }} />
                            <div className="w-1 h-4 bg-primary rounded-full animate-wave" style={{ animationDelay: '0.2s' }} />
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
                          <p className={cn(
                            "text-sm font-medium",
                            isCurrentTrack ? "text-primary" : "text-foreground"
                          )}>
                            {track.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {track.artist}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-sm text-muted-foreground">
                        {track.album}
                      </p>
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
      </div>

      {/* Featured Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-accent" />
          <h2 className="font-display text-lg tracking-wider">POUR VOUS</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {['Découvertes de la semaine', 'Mix Cyberpunk', 'Sessions Nocturnes'].map((playlist, idx) => (
            <div
              key={idx}
              className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer"
            >
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br",
                idx === 0 && "from-primary/80 to-secondary/80",
                idx === 1 && "from-secondary/80 to-accent/80",
                idx === 2 && "from-accent/80 to-primary/80"
              )} />
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <h3 className="font-display text-xl font-bold text-white mb-2">
                  {playlist}
                </h3>
                <p className="text-white/70 text-sm">
                  Playlist générée pour vous
                </p>
                <div className="mt-4 w-12 h-12 rounded-full bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110">
                  <Play className="w-6 h-6 text-white fill-current ml-0.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
