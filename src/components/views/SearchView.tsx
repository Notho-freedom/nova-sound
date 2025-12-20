import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, Play, X, Clock, TrendingUp, Disc3, User, Music, MoreHorizontal } from "lucide-react";
import { Track } from "@/types/music";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { TrackCardSkeleton, AlbumCardSkeleton, TrackTableSkeleton } from "@/components/ui/skeletons";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { UploadIndicator } from "@/components/UploadIndicator";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useFavorites } from "@/hooks/useFavorites";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";
import { useBunnyUpload } from "@/hooks/useBunnyUpload";
import { useNexusUpload } from "@/hooks/useNexusUpload";
import { useUploadedStatus } from "@/hooks/useUploadedStatus";
import { useCloudSync } from "@/hooks/useCloudSync";

interface SearchViewProps {
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onTrackSelect: (index: number) => void;
  onPlayNext?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  onAddToPlaylist?: (playlistId: string, track: Track) => void;
  loading?: boolean;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const MAX_HISTORY = 8;

export const SearchView = ({
  tracks,
  currentTrackIndex,
  isPlaying,
  onTrackSelect,
  onPlayNext,
  onAddToQueue,
  onAddToPlaylist,
  loading = false,
}: SearchViewProps) => {
  const [query, setQuery] = useState("");
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  
  // Hooks for context menu
  const playlistsResult = usePlaylists();
  const playlists = playlistsResult?.playlists ?? [];
  const createPlaylist = playlistsResult?.createPlaylist ?? (async () => null);
  const { isFavorite, toggleFavorite } = useFavorites();
  const { uploadTrack, getTrackProgress } = useCloudinaryUpload();
  const { uploadTrack: uploadTrackToBunny, getTrackProgress: getBunnyTrackProgress } = useBunnyUpload();
  const { uploadTrack: uploadTrackToNexus, getTrackProgress: getNexusTrackProgress } = useNexusUpload();
  const { cloudinaryConfigured, nexusIsPro, nexusAuthenticated } = useCloudSync();
  const { isUploaded, getUploadedProvider } = useUploadedStatus();
  // Free users: Cloudinary only (serveur 0)
  // Pro users: Bunny (serveur 1) and PlanetHoster/Nexus (serveur 2)
  const canUploadToCloudinary = cloudinaryConfigured && !nexusIsPro; // Free only
  const canUploadToBunny = nexusIsPro && nexusAuthenticated; // Pro only (serveur 1)
  const canUploadToNexus = nexusIsPro && nexusAuthenticated; // Pro only (serveur 2)

  // Load search history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("nexus-search-history");
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved));
      } catch {
        setSearchHistory([]);
      }
    }
  }, []);

  // Save search history
  const saveToHistory = (term: string) => {
    if (!term.trim()) return;
    const newHistory = [term, ...searchHistory.filter(h => h !== term)].slice(0, MAX_HISTORY);
    setSearchHistory(newHistory);
    localStorage.setItem("nexus-search-history", JSON.stringify(newHistory));
    
    // Sync to Firebase
    (async () => {
      try {
        const { firebaseSyncService } = await import('@/services/firebase-sync');
        firebaseSyncService.queueSync('searchHistory', newHistory);
      } catch (error) {
        // Silently fail if Firebase sync is not available
      }
    })();
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem("nexus-search-history");
    
    // Sync to Firebase
    (async () => {
      try {
        const { firebaseSyncService } = await import('@/services/firebase-sync');
        firebaseSyncService.queueSync('searchHistory', []);
      } catch (error) {
        // Silently fail if Firebase sync is not available
      }
    })();
  };

  const removeFromHistory = (term: string) => {
    const newHistory = searchHistory.filter(h => h !== term);
    setSearchHistory(newHistory);
    localStorage.setItem("nexus-search-history", JSON.stringify(newHistory));
    
    // Sync to Firebase
    (async () => {
      try {
        const { firebaseSyncService } = await import('@/services/firebase-sync');
        firebaseSyncService.queueSync('searchHistory', newHistory);
      } catch (error) {
        // Silently fail if Firebase sync is not available
      }
    })();
  };

  // Utility function to remove duplicates
  const getUniqueTracks = useCallback((trackList: Track[]): Track[] => {
    const seen = new Set<string>();
    return trackList.filter(track => {
      if (seen.has(track.id)) {
        return false;
      }
      seen.add(track.id);
      return true;
    });
  }, []);

  // Search results
  const searchResults = useMemo(() => {
    if (!query.trim()) return { tracks: [], albums: [], artists: [] };

    const q = query.toLowerCase();
    
    const matchedTracks = tracks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.album.toLowerCase().includes(q)
    );
    
    // Remove duplicates
    const uniqueMatchedTracks = getUniqueTracks(matchedTracks);

    // Group by album
    const albumsMap = new Map<string, { name: string; artist: string; coverUrl: string; count: number }>();
    uniqueMatchedTracks.forEach(t => {
      const key = `${t.album}-${t.artist}`;
      if (!albumsMap.has(key)) {
        albumsMap.set(key, { name: t.album, artist: t.artist, coverUrl: t.coverUrl, count: 0 });
      }
      albumsMap.get(key)!.count++;
    });

    // Group by artist
    const artistsMap = new Map<string, { name: string; coverUrl: string; count: number }>();
    uniqueMatchedTracks.forEach(t => {
      if (!artistsMap.has(t.artist)) {
        artistsMap.set(t.artist, { name: t.artist, coverUrl: t.coverUrl, count: 0 });
      }
      artistsMap.get(t.artist)!.count++;
    });

    return {
      tracks: uniqueMatchedTracks,
      albums: Array.from(albumsMap.values()).slice(0, 6),
      artists: Array.from(artistsMap.values()).slice(0, 6)
    };
  }, [query, tracks, getUniqueTracks]);

  // Get unique genres from tracks
  const genres = useMemo(() => {
    const genreSet = new Set<string>();
    tracks.forEach(t => {
      if (t.genre) genreSet.add(t.genre);
    });
    return Array.from(genreSet).slice(0, 6);
  }, [tracks]);

  // Default categories if no genres
  const defaultCategories = [
    { name: "Électronique", color: "from-cyan-500 to-blue-600" },
    { name: "Synthwave", color: "from-pink-500 to-purple-600" },
    { name: "Ambient", color: "from-green-500 to-teal-600" },
    { name: "Cyberpunk", color: "from-yellow-500 to-orange-600" },
    { name: "Lo-Fi", color: "from-indigo-500 to-purple-600" },
    { name: "Techno", color: "from-red-500 to-pink-600" },
  ];

  const handleSearch = (term: string) => {
    setQuery(term);
    saveToHistory(term);
  };

  const hasResults = query && (searchResults.tracks.length > 0 || searchResults.albums.length > 0 || searchResults.artists.length > 0);

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-200">
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-4 space-y-6">
          {/* Header */}
          <PageHeader
            title="Recherche"
            subtitle={searchResults.tracks.length > 0 || searchResults.albums.length > 0 || searchResults.artists.length > 0 ? `${searchResults.tracks.length + searchResults.albums.length + searchResults.artists.length} résultat(s) trouvé(s)` : "Recherchez dans votre bibliothèque"}
          />

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Rechercher des titres, artistes ou albums..."
              value={query}
              onChange={(e) => {
                const value = e.target.value;
                setQuery(value);
                if (value.trim()) saveToHistory(value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) {
                  saveToHistory(query.trim());
                }
              }}
              className="pl-10 pr-10 py-6 text-lg bg-card/50 border-border/50 focus:border-primary focus:ring-primary transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-primary/50"
            />
            {query && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-muted/40 transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                    aria-label="Effacer la recherche"
                  >
                    <X className="w-4 h-4 text-muted-foreground hover:scale-105 transition-transform duration-200 ease-out" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">Effacer la recherche</div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

      {query ? (
        /* Search Results */
        <div className="space-y-6">
          {/* Artists Results */}
          {searchResults.artists.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-primary" />
                <h2 className="font-display text-lg tracking-wider">ARTISTES</h2>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {searchResults.artists.map((artist) => (
                  <Tooltip key={artist.name}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleSearch(artist.name)}
                        className="flex-shrink-0 p-4 rounded-xl hover:bg-card/50 transition-all duration-200 ease-out active:scale-95 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                      >
                        <div className="w-24 h-24 rounded-full overflow-hidden mx-auto mb-2 bg-gradient-to-br from-primary/20 to-secondary/20">
                          <img src={getCoverUrl(artist.coverUrl)} alt={artist.name} className="w-full h-full object-cover" />
                        </div>
                        <p className="text-sm font-medium truncate w-24">{artist.name}</p>
                        <p className="text-xs text-muted-foreground">{artist.count} titres</p>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-sm font-medium">{artist.name}</div>
                      <div className="text-xs text-muted-foreground">{artist.count} titre{artist.count > 1 ? 's' : ''}</div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          )}

          {/* Albums Results */}
          {searchResults.albums.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Disc3 className="w-5 h-5 text-primary" />
                <h2 className="font-display text-lg tracking-wider">ALBUMS</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {searchResults.albums.map((album) => (
                  <Tooltip key={`${album.name}-${album.artist}`}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleSearch(album.name)}
                        className="p-3 rounded-xl hover:bg-card/50 transition-all duration-200 ease-out active:scale-95 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                      >
                        <div className="aspect-square rounded-lg overflow-hidden mb-2 shadow-lg">
                          <img src={getCoverUrl(album.coverUrl)} alt={album.name} className="w-full h-full object-cover" />
                        </div>
                        <p className="text-sm font-medium truncate">{album.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{album.artist}</p>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-sm font-medium">{album.name}</div>
                      <div className="text-xs text-muted-foreground">{album.artist}</div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          )}

          {/* Tracks Results */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Music className="w-5 h-5 text-primary" />
              <h2 className="font-display text-lg tracking-wider">
                TITRES ({searchResults.tracks.length})
              </h2>
            </div>
            {searchResults.tracks.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">
                  Aucun résultat pour "{query}"
                </p>
              </div>
            ) : (
              <div className="bg-card/30 backdrop-blur-sm rounded-xl border border-border/30 divide-y divide-border/30">
                {searchResults.tracks.slice(0, 20).map((track) => {
                  const actualIndex = tracks.findIndex((t) => t.id === track.id);
                  const isCurrentTrack = currentTrackIndex === actualIndex;

                  return (
                    <TrackContextMenu
                      key={track.id}
                      track={track}
                      playlists={playlists}
                      isFavorite={isFavorite(track.id)}
                      onPlay={() => onTrackSelect(actualIndex)}
                      onPlayNext={() => onPlayNext?.(track)}
                      onAddToQueue={() => onAddToQueue?.(track)}
                      onAddToPlaylist={(playlistId) => onAddToPlaylist?.(playlistId, track)}
                      onCreatePlaylist={() => createPlaylist("Nouvelle playlist", [track.id])}
                      onToggleFavorite={() => toggleFavorite(track.id)}
                      onUploadToCloudinary={() => uploadTrack?.(track)}
                      canUploadToCloudinary={canUploadToCloudinary && !!track.filePath}
                      isUploading={getTrackProgress?.(track.id)?.status === 'uploading'}
                      onUploadToBunny={() => uploadTrackToBunny?.(track)}
                      canUploadToBunny={canUploadToBunny && !!track.filePath}
                      isUploadingToBunny={getBunnyTrackProgress?.(track.id)?.status === 'uploading'}
                      onUploadToNexus={() => uploadTrackToNexus?.(track)}
                      canUploadToNexus={canUploadToNexus && !!track.filePath}
                      isUploadingToNexus={getNexusTrackProgress?.(track.id)?.status === 'uploading'}
                    >
                      <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          onClick={() => onTrackSelect(actualIndex)}
                          className={cn(
                            "flex items-center gap-4 px-3 py-2.5 cursor-pointer transition-all duration-200 ease-out group",
                            isCurrentTrack ? "bg-primary/10" : "hover:bg-muted/40 active:bg-muted/50",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                          )}
                        >
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 relative">
                        <img
                          src={getCoverUrl(track.coverUrl)}
                          alt={track.album}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out">
                          <Play className="w-5 h-5 text-white fill-current" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                        <p className={cn(
                          "text-sm font-medium truncate",
                          isCurrentTrack ? "text-primary" : "text-foreground"
                        )}>
                          {track.title}
                        </p>
                                {isUploaded(track.id) && (
                                  <UploadIndicator provider={getUploadedProvider(track.id) || undefined} size="sm" />
                                )}
                              </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {track.artist} • {track.album}
                        </p>
                      </div>
                      <span className="text-sm text-muted-foreground font-mono">
                        {formatTime(track.duration)}
                      </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                              aria-label="Options"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-sm font-medium">{track.title}</div>
                        <div className="text-xs text-muted-foreground">{track.artist}</div>
                        {track.album && <div className="text-xs text-muted-foreground mt-1">{track.album}</div>}
                        <div className="text-xs text-muted-foreground mt-1">{formatTime(track.duration)}</div>
                      </TooltipContent>
                    </Tooltip>
                    </TrackContextMenu>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Browse View */
        <div className="space-y-6">
          {/* Search History */}
          {searchHistory.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  <h2 className="font-display text-lg tracking-wider">RECHERCHES RÉCENTES</h2>
                </div>
                <button
                  onClick={clearHistory}
                  className="text-sm text-muted-foreground hover:text-foreground transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 rounded"
                >
                  Effacer tout
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {searchHistory.map((term) => (
                  <Tooltip key={term}>
                    <TooltipTrigger asChild>
                      <div className="group flex items-center gap-2 px-4 py-2 rounded-full bg-card/50 hover:bg-card transition-all duration-200 ease-out">
                        <button
                          onClick={() => setQuery(term)}
                          className="text-sm text-foreground transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 rounded"
                        >
                          {term}
                        </button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFromHistory(term);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 rounded"
                              aria-label="Supprimer de l'historique"
                            >
                              <X className="w-3 h-3 text-muted-foreground hover:text-foreground hover:scale-105 transition-all duration-200 ease-out" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-sm">Supprimer de l'historique</div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-sm">Rechercher "{term}"</div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          )}

          {/* Browse by Genre */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="font-display text-lg tracking-wider">
                {genres.length > 0 ? "VOS GENRES" : "PARCOURIR LES GENRES"}
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {(genres.length > 0 ? genres.map((g, i) => ({ 
                name: g, 
                color: defaultCategories[i % defaultCategories.length].color 
              })) : defaultCategories).map((category) => (
                <button
                  key={category.name}
                  onClick={() => handleSearch(category.name)}
                  className={cn(
                    "relative h-28 rounded-xl overflow-hidden group transition-all duration-200 ease-out active:scale-95",
                    "bg-gradient-to-br",
                    category.color,
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                  )}
                >
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-200 ease-out" />
                  <div className="absolute inset-0 flex items-end p-4">
                    <h3 className="font-display text-xl font-bold text-white">
                      {category.name}
                    </h3>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Access - Top Artists */}
          {tracks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-secondary" />
                <h2 className="font-display text-lg tracking-wider">ARTISTES POPULAIRES</h2>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {Array.from(new Set(tracks.map(t => t.artist))).slice(0, 8).map((artist) => {
                  const artistTrack = tracks.find(t => t.artist === artist);
                  return (
                    <button
                      key={artist}
                      onClick={() => handleSearch(artist)}
                      className="flex-shrink-0 p-4 rounded-xl hover:bg-card/50 transition-all duration-200 ease-out active:scale-95 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                    >
                      <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-2 shadow-lg">
                        <img 
                          src={getCoverUrl(artistTrack?.coverUrl)} 
                          alt={artist} 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                      <p className="text-sm font-medium truncate w-20">{artist}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
        </div>
      </div>
    </div>
  );
};
