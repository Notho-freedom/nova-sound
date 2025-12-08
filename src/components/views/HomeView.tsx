import { Play, Clock, TrendingUp, Sparkles, Heart, Music } from "lucide-react";
import { Track } from "@/types/music";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import { PageHeader } from "@/components/PageHeader";
import { useState, useMemo } from "react";
import { useCloudSync } from "@/hooks/useCloudSync";

interface HomeViewProps {
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onTrackSelect: (index: number) => void;
  recentTracks?: Track[];
  favoriteTracks?: Track[];
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// Generate dynamic recommendations based on listening history
const generateRecommendations = (tracks: Track[], recentTracks: Track[], favoriteTracks: Track[]) => {
  // Get unique artists from favorites and recent
  const preferredArtists = new Set([
    ...favoriteTracks.map(t => t.artist),
    ...recentTracks.map(t => t.artist)
  ]);
  
  // Get unique genres
  const preferredGenres = new Set([
    ...favoriteTracks.filter(t => t.genre).map(t => t.genre!),
    ...recentTracks.filter(t => t.genre).map(t => t.genre!)
  ]);

  // Discoveries - tracks not in recent or favorites
  const recentIds = new Set(recentTracks.map(t => t.id));
  const favoriteIds = new Set(favoriteTracks.map(t => t.id));
  
  const discoveries = tracks
    .filter(t => !recentIds.has(t.id) && !favoriteIds.has(t.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, 10);

  // Similar to favorites - same artist or genre
  const similar = tracks
    .filter(t => !favoriteIds.has(t.id) && (
      preferredArtists.has(t.artist) || 
      (t.genre && preferredGenres.has(t.genre))
    ))
    .slice(0, 10);

  return { discoveries, similar };
};

export const HomeView = ({
  tracks,
  currentTrackIndex,
  isPlaying,
  onTrackSelect,
  recentTracks = [],
  favoriteTracks = [],
}: HomeViewProps) => {
  const displayRecent = recentTracks.length > 0 ? recentTracks.slice(0, 4) : tracks.slice(0, 4);
  const displayFavorites = favoriteTracks.length > 0 ? favoriteTracks.slice(0, 6) : tracks.slice(0, 6);
  
  const { discoveries, similar } = generateRecommendations(tracks, recentTracks, favoriteTracks);

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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {displayRecent.map((track) => {
              const actualIndex = tracks.findIndex(t => t.id === track.id);
              const isCurrentTrack = currentTrackIndex === actualIndex;
              
              return (
                <button
                  key={track.id}
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
                      key={track.id}
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
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h2 className="font-display text-lg tracking-wider">POUR VOUS</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Discoveries Playlist */}
          <div className="group relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/80 to-purple-600/80" />
            <div className="absolute inset-0 p-6 flex flex-col justify-between">
              <div>
                <h3 className="font-display text-xl font-bold text-white mb-1">
                  Découvertes
                </h3>
                <p className="text-white/70 text-sm">
                  {discoveries.length} nouveaux titres à explorer
                </p>
              </div>
              <div className="flex items-center gap-2">
                {discoveries.slice(0, 3).map((track, i) => (
                  <div 
                    key={track.id} 
                    className="w-10 h-10 rounded overflow-hidden border-2 border-white/30"
                    style={{ marginLeft: i > 0 ? '-8px' : 0 }}
                  >
                    <img src={getCoverUrl(track.coverUrl)} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
                <div className="ml-auto w-10 h-10 rounded-full bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110">
                  <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                </div>
              </div>
            </div>
          </div>

          {/* Similar to Favorites */}
          <div className="group relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500/80 to-rose-600/80" />
            <div className="absolute inset-0 p-6 flex flex-col justify-between">
              <div>
                <h3 className="font-display text-xl font-bold text-white mb-1">
                  Similaires
                </h3>
                <p className="text-white/70 text-sm">
                  Basé sur vos favoris
                </p>
              </div>
              <div className="flex items-center gap-2">
                {similar.slice(0, 3).map((track, i) => (
                  <div 
                    key={track.id} 
                    className="w-10 h-10 rounded overflow-hidden border-2 border-white/30"
                    style={{ marginLeft: i > 0 ? '-8px' : 0 }}
                  >
                    <img src={getCoverUrl(track.coverUrl)} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
                <div className="ml-auto w-10 h-10 rounded-full bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110">
                  <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                </div>
              </div>
            </div>
          </div>

          {/* Mix based on time */}
          <div className="group relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/80 to-blue-600/80" />
            <div className="absolute inset-0 p-6 flex flex-col justify-between">
              <div>
                <h3 className="font-display text-xl font-bold text-white mb-1">
                  {new Date().getHours() < 18 ? "Energy Mix" : "Chill Session"}
                </h3>
                <p className="text-white/70 text-sm">
                  Parfait pour ce moment
                </p>
              </div>
              <div className="flex items-center gap-2">
                {tracks.slice(0, 3).map((track, i) => (
                  <div 
                    key={track.id} 
                    className="w-10 h-10 rounded overflow-hidden border-2 border-white/30"
                    style={{ marginLeft: i > 0 ? '-8px' : 0 }}
                  >
                    <img src={getCoverUrl(track.coverUrl)} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
                <div className="ml-auto w-10 h-10 rounded-full bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110">
                  <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
