import { Play, Clock, TrendingUp, Sparkles, Heart, Music } from "lucide-react";
import { Track } from "@/types/music";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import { PageHeader } from "@/components/PageHeader";
import { AppHero } from "@/components/AppHero";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useCloudSync } from "@/hooks/useCloudSync";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { TrackCardSkeleton, PlaylistCardSkeleton, TableRowSkeleton } from "@/components/ui/skeletons";

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
  loading?: boolean;
  onOpenSettings?: () => void;
  uploadProgress?: number;
  hasNotifications?: boolean;
  onToggleNotifications?: () => void;
  isFullscreen?: boolean;
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
  loading = false,
  onOpenSettings,
  uploadProgress,
  hasNotifications = false,
  onToggleNotifications,
  isFullscreen = false,
}: HomeViewProps) => {
  // Remove duplicates by ID before slicing - memoized
  const getUniqueTracks = useCallback((trackList: Track[]) => {
    const seen = new Set<string>();
    return trackList.filter(track => {
      if (seen.has(track.id)) {
        return false;
      }
      seen.add(track.id);
      return true;
    });
  }, []);

  const displayRecent = recentTracks.length > 0 
    ? getUniqueTracks(recentTracks).slice(0, 20) 
    : getUniqueTracks(tracks).slice(0, 10);
  
  const displayFavorites = favoriteTracks.length > 0 
    ? getUniqueTracks(favoriteTracks).slice(0, 6) 
    : getUniqueTracks(tracks).slice(0, 6);
  
  // Get random selections from most played tracks - recalculated dynamically when history or tracks change
  const mostPlayedSelections = useMemo(() => {
    if (history.length === 0 || tracks.length === 0) {
      return { discoveries: [], similar: [], mix: [] };
    }
    return generateMostPlayedSelections(tracks, history);
  }, [tracks, history]);

  const uniqueDiscoveries = useMemo(() => 
    getUniqueTracks(mostPlayedSelections.discoveries), 
    [mostPlayedSelections.discoveries]
  );
  const uniqueSimilar = useMemo(() => 
    getUniqueTracks(mostPlayedSelections.similar), 
    [mostPlayedSelections.similar]
  );
  const uniqueMix = useMemo(() => 
    getUniqueTracks(mostPlayedSelections.mix), 
    [mostPlayedSelections.mix]
  );

  // Force re-render when history updates to ensure fresh random selections
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    // Update selections when history changes significantly
    const timer = setTimeout(() => {
      setRefreshKey(prev => prev + 1);
    }, 1000); // Small delay to batch updates
    
    return () => clearTimeout(timer);
  }, [history.length]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bonjour";
    if (hour < 18) return "Bon après-midi";
    return "Bonsoir";
  };

  const { nexusUser, nexusAuthenticated } = useCloudSync();
  const userName = nexusUser?.displayName || nexusUser?.email?.split("@")[0] || "";


  if (loading) {
    return (
      <div className="px-6 py-4 space-y-6 animate-in fade-in duration-200">
        {/* Welcome Section Skeleton */}
        <div>
          <Skeleton className="h-9 w-96 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>

        {/* Recently Played Skeleton */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="w-5 h-5" />
            <Skeleton className="h-6 w-48" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <TrackCardSkeleton key={`recent-skeleton-${i}`} className="" />
            ))}
          </div>
        </div>

        {/* Favorites Section Skeleton */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="w-5 h-5" />
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="bg-card/30 backdrop-blur-sm rounded-xl overflow-hidden border border-border/30">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="px-4 py-2.5 text-left text-xs font-display uppercase tracking-widest text-muted-foreground w-12">
                    #
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-display uppercase tracking-widest text-muted-foreground">
                    Titre
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                    Album
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-display uppercase tracking-widest text-muted-foreground">
                    Durée
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <TableRowSkeleton key={`favorite-skeleton-${i}`} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* For You Section Skeleton */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="w-5 h-5" />
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <PlaylistCardSkeleton key={`playlist-skeleton-${i}`} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Get featured tracks for hero slider (up to 5 tracks)
  const featuredTracks = useMemo(() => {
    const tracksList: Track[] = [];
    
    // Add recent tracks first
    if (recentTracks.length > 0) {
      tracksList.push(...getUniqueTracks(recentTracks).slice(0, 3));
    }
    
    // Add favorite tracks if we need more
    if (tracksList.length < 5 && favoriteTracks.length > 0) {
      const favorites = getUniqueTracks(favoriteTracks).filter(
        t => !tracksList.some(existing => existing.id === t.id)
      );
      tracksList.push(...favorites.slice(0, 5 - tracksList.length));
    }
    
    // Add any tracks if we still need more
    if (tracksList.length < 5 && tracks.length > 0) {
      const additional = getUniqueTracks(tracks).filter(
        t => !tracksList.some(existing => existing.id === t.id)
      );
      tracksList.push(...additional.slice(0, 5 - tracksList.length));
    }
    
    return tracksList;
  }, [recentTracks, favoriteTracks, tracks, getUniqueTracks]);

  return (
    <div className="animate-in fade-in duration-200">
      
      {/* AppHero - Unified hero with TitleBar2 controls integrated */}
      <div className="relative -mx-6 md:-mx-8 -mt-4 mb-0">
        <AppHero 
          variant="home"
          title="NEXUS"
          subtitle={`${tracks.length} titres dans votre bibliothèque`}
          userName={userName}
          featuredTracks={featuredTracks}
          onTrackSelect={(track) => {
            const index = tracks.findIndex(t => t.id === track.id);
            if (index !== -1) onTrackSelect(index);
          }}
          onOpenSettings={onOpenSettings}
          uploadProgress={uploadProgress}
          hasNotifications={hasNotifications}
          onToggleNotifications={onToggleNotifications}
          enableParticles={true}
        />
      </div>
      
      {/* Main Content with padding - Overlaps with hero fade */}
      <div className="px-6 py-4 space-y-6 -mt-24 md:-mt-32 relative z-10 pt-16 md:pt-20">
        {/* Subscription Badge */}
        {nexusAuthenticated && nexusUser && (
          <div className="flex justify-end">
            <div className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
              {nexusUser.subscriptionStatus === "active" ? "Pro" : "Gratuit"}
            </div>
          </div>
        )}

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
                <Tooltip key={`recent-${track.id}-${idx}`}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => actualIndex !== -1 && onTrackSelect(actualIndex)}
                      className={cn(
                        "group relative overflow-hidden rounded-xl bg-card/50 backdrop-blur-sm p-4 text-left transition-all duration-200 ease-out",
                        "hover:bg-card hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98]",
                        isCurrentTrack && isPlaying && "ring-2 ring-primary",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 relative">
                          <img
                            src={getCoverUrl(track.coverUrl)}
                            alt={track.album}
                            className="w-full h-full object-cover transition-transform duration-200 ease-out group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out">
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
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm font-medium">{track.title}</div>
                    <div className="text-xs text-muted-foreground">{track.artist}</div>
                    {track.album && <div className="text-xs text-muted-foreground mt-1">{track.album}</div>}
                  </TooltipContent>
                </Tooltip>
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
                  <th className="px-4 py-2.5 text-left text-xs font-display uppercase tracking-widest text-muted-foreground w-12">
                    #
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-display uppercase tracking-widest text-muted-foreground">
                    Titre
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                    Album
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-display uppercase tracking-widest text-muted-foreground">
                    Durée
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayFavorites.map((track, idx) => {
                  const actualIndex = tracks.findIndex(t => t.id === track.id);
                  const isCurrentTrack = currentTrackIndex === actualIndex;
                  const tooltipText = `${track.title} - ${track.artist}${track.album ? ` (${track.album})` : ''} - ${formatTime(track.duration)}`;
                  
                  return (
                    <tr
                      key={`favorite-${track.id}-${idx}`}
                      onClick={() => actualIndex !== -1 && onTrackSelect(actualIndex)}
                      className={cn(
                        "group cursor-pointer transition-all duration-200 ease-out",
                        isCurrentTrack 
                          ? "bg-primary/10" 
                          : "hover:bg-muted/40 active:bg-muted/50",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                      )}
                    >
                      <td className="px-4 py-2.5">
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
                      <td className="px-4 py-2.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
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
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-sm font-medium">{track.title}</div>
                            <div className="text-xs text-muted-foreground">{track.artist}</div>
                            {track.album && <div className="text-xs text-muted-foreground mt-1">{track.album}</div>}
                            <div className="text-xs text-muted-foreground mt-1">{formatTime(track.duration)}</div>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell">
                        <p className="text-sm text-muted-foreground truncate">
                          {track.album}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-right">
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
              <Tooltip>
                <TooltipTrigger asChild>
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
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm font-medium">Découvertes</div>
                  <div className="text-xs text-muted-foreground">{uniqueDiscoveries.length} pistes recommandées</div>
                  <div className="text-xs text-muted-foreground mt-1">Cliquez pour lire</div>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Similar to Favorites - Style chaleureux */}
            {uniqueSimilar.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
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
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm font-medium">Similaires</div>
                  <div className="text-xs text-muted-foreground">{uniqueSimilar.length} pistes similaires</div>
                  <div className="text-xs text-muted-foreground mt-1">Basé sur vos goûts</div>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Mix based on time - Style dynamique */}
            {uniqueMix.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
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
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm font-medium">
                    {new Date().getHours() < 18 ? "Energy Mix" : "Chill Session"}
                  </div>
                  <div className="text-xs text-muted-foreground">{uniqueMix.length} pistes</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date().getHours() < 18 ? "⚡ Énergisant" : "🌙 Apaisant"}
                  </div>
                </TooltipContent>
              </Tooltip>
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
    </div>
  );
};
