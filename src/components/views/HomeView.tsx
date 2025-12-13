import { Play, Clock, TrendingUp, Sparkles, Heart, Music } from "lucide-react";
import { Track } from "@/types/music";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import { PageHeader } from "@/components/PageHeader";
import { useState, useMemo } from "react";
import { useCloudSync } from "@/hooks/useCloudSync";

interface HistoryEntry {
  trackId: string;
  playedAt: string;
  playCount: number;
}

interface HomeViewProps {
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onTrackSelect: (index: number) => void;
  onPlayTracks?: (trackIds: string[]) => void;
  recentTracks?: Track[];
  favoriteTracks?: Track[];
  history?: HistoryEntry[];
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// Generate random selections from most played tracks
const generateMostPlayedSelections = (tracks: Track[], history: HistoryEntry[] = []) => {
  // Create a map of trackId -> playCount
  const playCountMap = new Map<string, number>();
  history.forEach(entry => {
    playCountMap.set(entry.trackId, entry.playCount || 1);
  });

  // Get tracks with play counts, sort by play count
  const tracksWithCounts = tracks
    .map(track => ({
      track,
      playCount: playCountMap.get(track.id) || 0
    }))
    .filter(item => item.playCount > 0)
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, 50); // Take top 50 most played

  // Create 3 random selections from the most played tracks
  const shuffled1 = [...tracksWithCounts].sort(() => Math.random() - 0.5);
  const shuffled2 = [...tracksWithCounts].sort(() => Math.random() - 0.5);
  const shuffled3 = [...tracksWithCounts].sort(() => Math.random() - 0.5);

  return {
    discoveries: shuffled1.slice(0, 10).map(item => item.track),
    similar: shuffled2.slice(0, 10).map(item => item.track),
    mix: shuffled3.slice(0, 10).map(item => item.track),
  };
};

export const HomeView = ({
  tracks,
  currentTrackIndex,
  isPlaying,
  onTrackSelect,
  onPlayTracks,
  recentTracks = [],
  favoriteTracks = [],
  history = [],
}: HomeViewProps) => {
  // Remove duplicates by ID before slicing
  const getUniqueTracks = (trackList: Track[]) => {
    const seen = new Set<string>();
    return trackList.filter(track => {
      if (seen.has(track.id)) {
        return false;
      }
      seen.add(track.id);
      return true;
    });
  };

  const displayRecent = recentTracks.length > 0 
    ? getUniqueTracks(recentTracks).slice(0, 20) 
    : getUniqueTracks(tracks).slice(0, 20);
  
  const displayFavorites = favoriteTracks.length > 0 
    ? getUniqueTracks(favoriteTracks).slice(0, 6) 
    : getUniqueTracks(tracks).slice(0, 6);
  
  // Get random selections from most played tracks
  const { discoveries, similar, mix } = generateMostPlayedSelections(tracks, history);
  const uniqueDiscoveries = getUniqueTracks(discoveries);
  const uniqueSimilar = getUniqueTracks(similar);
  const uniqueMix = getUniqueTracks(mix);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bonjour";
    if (hour < 18) return "Bon après-midi";
    return "Bonsoir";
  };

  const { nexusUser, nexusAuthenticated } = useCloudSync();
  const userName = nexusUser?.displayName || nexusUser?.email?.split("@")[0] || "";

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-300">
      {/* Spacing from top */}
      <div className="pt-4" />
      
      {/* Welcome Section */}
      <div>
        <h1 className="font-display text-3xl font-bold mb-2 text-foreground">
          {getGreeting()}{userName ? `, ${userName}` : ""}, bienvenue sur <span className="text-primary">NEXUS</span>
        </h1>
        <p className="text-muted-foreground">
          {tracks.length > 0 
            ? `${tracks.length} pistes disponibles dans votre bibliothèque`
            : "Votre système audio futuriste personnel"
          }
          {nexusAuthenticated && nexusUser && (
            <span className="ml-2 text-xs">
              • {nexusUser.subscriptionStatus === "active" ? "Pro" : "Gratuit"}
            </span>
          )}
        </p>
      </div>

      {/* Quick Play Cards - Recently Played */}
      {displayRecent.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-primary" />
            <h2 className="font-display text-lg tracking-wider">
              {recentTracks.length > 0 ? "ÉCOUTÉ RÉCEMMENT" : "À DÉCOUVRIR"}
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {displayRecent.map((track, idx) => {
              const actualIndex = tracks.findIndex(t => t.id === track.id);
              const isCurrentTrack = currentTrackIndex === actualIndex;
              
              return (
                <button
                  key={`recent-${track.id}-${idx}`}
                  onClick={() => actualIndex !== -1 && onTrackSelect(actualIndex)}
                  className={cn(
                    "group relative overflow-hidden rounded-xl bg-card/50 backdrop-blur-sm p-4 text-left transition-all duration-300",
                    "hover:bg-card hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/10",
                    isCurrentTrack && isPlaying && "ring-2 ring-primary"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 relative">
                      <img
                        src={getCoverUrl(track.coverUrl)}
                        alt={track.album}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-5 h-5 text-white fill-current" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium truncate",
                        isCurrentTrack ? "text-primary" : "text-foreground"
                      )}>
                        {track.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {track.artist}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Favorites Section */}
      {displayFavorites.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Heart className="w-5 h-5 text-red-500" />
            <h2 className="font-display text-lg tracking-wider">
              {favoriteTracks.length > 0 ? "VOS FAVORIS" : "POPULAIRES"}
            </h2>
            {favoriteTracks.length > 0 && (
              <span className="text-xs text-muted-foreground ml-2">
                {favoriteTracks.length} titres
              </span>
            )}
          </div>
          <div className="bg-card/30 backdrop-blur-sm rounded-xl overflow-hidden border border-border/30">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/30">
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
                {displayFavorites.map((track, idx) => {
                  const actualIndex = tracks.findIndex(t => t.id === track.id);
                  const isCurrentTrack = currentTrackIndex === actualIndex;
                  
                  return (
                    <tr
                      key={`favorite-${track.id}-${idx}`}
                      onClick={() => actualIndex !== -1 && onTrackSelect(actualIndex)}
                      className={cn(
                        "group cursor-pointer transition-all duration-200",
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
                              src={getCoverUrl(track.coverUrl)}
                              alt={track.album}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className={cn(
                              "text-sm font-medium truncate",
                              isCurrentTrack ? "text-primary" : "text-foreground"
                            )}>
                              {track.title}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {track.artist}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-sm text-muted-foreground truncate">
                          {track.album}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-muted-foreground font-mono">
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
      )}

      {/* For You Section - Dynamic Recommendations */}
      {(uniqueDiscoveries.length > 0 || uniqueSimilar.length > 0 || uniqueMix.length > 0) && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="font-display text-lg tracking-wider">POUR VOUS</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Discoveries Playlist - Style explorateur */}
            {uniqueDiscoveries.length > 0 && (
              <div 
                className="group relative aspect-[3/2] rounded-xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]"
                onClick={() => {
                  if (uniqueDiscoveries.length > 0) {
                    const firstTrack = uniqueDiscoveries[0];
                    const idx = tracks.findIndex(t => t.id === firstTrack.id);
                    if (idx !== -1) onTrackSelect(idx);
                  }
                }}
              >
                {/* Background avec image de la première piste */}
                <img
                  src={getCoverUrl(uniqueDiscoveries[0]?.coverUrl)}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-50 transition-opacity"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-violet-600/90 via-purple-600/80 to-indigo-700/90" />
                
                {/* Pattern décoratif */}
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-cyan-400/20 rounded-full blur-2xl" />
                </div>

                <div className="absolute inset-0 p-5 flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                        <h3 className="font-display text-xl font-bold text-white drop-shadow-lg">
                          Découvertes
                        </h3>
                      </div>
                      <p className="text-white/80 text-sm font-medium">
                        {uniqueDiscoveries.length} perles cachées
                      </p>
                      <p className="text-white/60 text-xs mt-1">
                        Explorations musicales
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110 group-hover:rotate-12">
                      <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {uniqueDiscoveries.slice(0, 4).map((track, i) => (
                      <div 
                        key={`discovery-${track.id}-${i}`} 
                        className="w-10 h-10 rounded-lg overflow-hidden border-2 border-white/40 shadow-lg backdrop-blur-sm"
                        style={{ marginLeft: i > 0 ? '-8px' : 0, zIndex: 10 - i }}
                      >
                        <img src={getCoverUrl(track.coverUrl)} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {uniqueDiscoveries.length > 4 && (
                      <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center text-white text-xs font-bold">
                        +{uniqueDiscoveries.length - 4}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Similar to Favorites - Style chaleureux */}
            {uniqueSimilar.length > 0 && (
              <div 
                className="group relative aspect-[3/2] rounded-xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]"
                onClick={() => {
                  if (uniqueSimilar.length > 0) {
                    const firstTrack = uniqueSimilar[0];
                    const idx = tracks.findIndex(t => t.id === firstTrack.id);
                    if (idx !== -1) onTrackSelect(idx);
                  }
                }}
              >
                {/* Background avec image de la première piste */}
                <img
                  src={getCoverUrl(uniqueSimilar[0]?.coverUrl)}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-50 transition-opacity"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-rose-500/90 via-pink-600/80 to-fuchsia-700/90" />
                
                {/* Pattern décoratif */}
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-0 left-0 w-28 h-28 bg-yellow-300/30 rounded-full blur-3xl" />
                  <div className="absolute bottom-0 right-0 w-32 h-32 bg-pink-400/20 rounded-full blur-3xl" />
                </div>

                <div className="absolute inset-0 p-5 flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Heart className="w-4 h-4 text-red-300 fill-red-300" />
                        <h3 className="font-display text-xl font-bold text-white drop-shadow-lg">
                          Similaires
                        </h3>
                      </div>
                      <p className="text-white/80 text-sm font-medium">
                        {uniqueSimilar.length} titres qui vous ressemblent
                      </p>
                      <p className="text-white/60 text-xs mt-1">
                        Basé sur vos goûts
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110 group-hover:rotate-12">
                      <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {uniqueSimilar.slice(0, 4).map((track, i) => (
                      <div 
                        key={`similar-${track.id}-${i}`} 
                        className="w-10 h-10 rounded-lg overflow-hidden border-2 border-white/40 shadow-lg backdrop-blur-sm"
                        style={{ marginLeft: i > 0 ? '-8px' : 0, zIndex: 10 - i }}
                      >
                        <img src={getCoverUrl(track.coverUrl)} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {uniqueSimilar.length > 4 && (
                      <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center text-white text-xs font-bold">
                        +{uniqueSimilar.length - 4}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Mix based on time - Style dynamique */}
            {uniqueMix.length > 0 && (
              <div 
                className="group relative aspect-[3/2] rounded-xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]"
                onClick={() => {
                  if (uniqueMix.length > 0) {
                    const firstTrack = uniqueMix[0];
                    const idx = tracks.findIndex(t => t.id === firstTrack.id);
                    if (idx !== -1) onTrackSelect(idx);
                  }
                }}
              >
                {/* Background avec image de la première piste */}
                <img
                  src={getCoverUrl(uniqueMix[0]?.coverUrl)}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-50 transition-opacity"
                />
                <div className={cn(
                  "absolute inset-0 transition-all duration-500",
                  new Date().getHours() < 18 
                    ? "bg-gradient-to-br from-amber-500/90 via-orange-600/80 to-red-600/90"
                    : "bg-gradient-to-br from-indigo-600/90 via-blue-700/80 to-cyan-800/90"
                )} />
                
                {/* Pattern décoratif animé */}
                <div className="absolute inset-0 opacity-20">
                  <div className={cn(
                    "absolute top-0 right-0 w-36 h-36 rounded-full blur-3xl transition-all duration-500",
                    new Date().getHours() < 18 ? "bg-yellow-300/30" : "bg-cyan-300/30"
                  )} />
                  <div className={cn(
                    "absolute bottom-0 left-0 w-28 h-28 rounded-full blur-2xl transition-all duration-500",
                    new Date().getHours() < 18 ? "bg-orange-400/20" : "bg-blue-400/20"
                  )} />
                </div>

                <div className="absolute inset-0 p-5 flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className={cn(
                          "w-4 h-4 transition-colors duration-500",
                          new Date().getHours() < 18 ? "text-yellow-300" : "text-cyan-300"
                        )} />
                        <h3 className="font-display text-xl font-bold text-white drop-shadow-lg">
                          {new Date().getHours() < 18 ? "Energy Mix" : "Chill Session"}
                        </h3>
                      </div>
                      <p className="text-white/80 text-sm font-medium">
                        {uniqueMix.length} titres pour {new Date().getHours() < 18 ? "vous booster" : "vous détendre"}
                      </p>
                      <p className="text-white/60 text-xs mt-1">
                        {new Date().getHours() < 18 ? "⚡ Énergisant" : "🌙 Apaisant"}
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110 group-hover:rotate-12">
                      <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {uniqueMix.slice(0, 4).map((track, i) => (
                      <div 
                        key={`mix-${track.id}-${i}`} 
                        className="w-10 h-10 rounded-lg overflow-hidden border-2 border-white/40 shadow-lg backdrop-blur-sm"
                        style={{ marginLeft: i > 0 ? '-8px' : 0, zIndex: 10 - i }}
                      >
                        <img src={getCoverUrl(track.coverUrl)} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {uniqueMix.length > 4 && (
                      <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center text-white text-xs font-bold">
                        +{uniqueMix.length - 4}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {tracks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-4">
            <Music className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">Bibliothèque vide</h3>
          <p className="text-muted-foreground text-sm max-w-md">
            Ajoutez des dossiers de musique dans les paramètres pour commencer à écouter.
          </p>
        </div>
      )}
    </div>
  );
};
