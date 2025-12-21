import { useState, useMemo, useEffect, useRef, useCallback, memo } from "react";
import { 
  Play, 
  Grid, 
  List, 
  SortAsc, 
  Music, 
  Disc3, 
  User, 
  FolderOpen, 
  Clock,
  Heart,
  MoreHorizontal,
  Shuffle,
  Trash2,
  Cloud,
  ListMusic,
  Search,
  X,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { Track } from "@/types/music";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { TrackListView } from "@/components/TrackListView";
import { TrackGridView } from "@/components/TrackGridView";
import { AlbumContextMenu } from "@/components/AlbumContextMenu";
import { ArtistContextMenu } from "@/components/ArtistContextMenu";
import { PageHeader } from "@/components/PageHeader";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";
import { useBunnyUpload } from "@/hooks/useBunnyUpload";
import { useNexusUpload } from "@/hooks/useNexusUpload";
import { useUploadedStatus } from "@/hooks/useUploadedStatus";
import { useCloudSync } from "@/hooks/useCloudSync";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useFavorites } from "@/hooks/useFavorites";
import { UploadIndicator } from "@/components/UploadIndicator";
import { AlbumGridSkeleton, TrackGridSkeleton, TrackTableSkeleton, PageHeaderSkeleton, AlbumTableSkeleton, ArtistTableSkeleton } from "@/components/ui/skeletons";
import { fetchYouTubeChannelPlaylists, fetchYouTubePlaylistVideos } from "@/lib/youtube-playlists";
import { extractYouTubeChannelId } from "@/lib/youtube";
import { youtubeSuggestionsToTracks } from "@/lib/youtube-artist-search";

interface LibraryViewProps {
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onTrackSelect: (index: number) => void;
  onPlayNext?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  onAddToPlaylist?: (playlistId: string, track: Track) => void;
  title?: string;
  showFilters?: boolean;
  viewMode?: "tracks" | "albums" | "artists" | "folders";
  emptyMessage?: string;
  showHistory?: boolean;
  initialSelectedAlbum?: string | null;
  loading?: boolean;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes} min`;
};

type DisplayMode = "grid" | "list";
type SortMode = "title" | "artist" | "album" | "duration" | "date";

// Group tracks by album
const groupByAlbum = (tracks: Track[]) => {
  const albums = new Map<string, { name: string; artist: string; coverUrl: string; tracks: Track[]; year?: number }>();
  
  tracks.forEach(track => {
    const key = `${track.album}-${track.artist}`;
    if (!albums.has(key)) {
      albums.set(key, {
        name: track.album,
        artist: track.artist,
        coverUrl: track.coverUrl,
        tracks: [],
        year: track.year
      });
    }
    albums.get(key)!.tracks.push(track);
  });
  
  return Array.from(albums.values()).sort((a, b) => a.name.localeCompare(b.name));
};

// Group tracks by artist
const groupByArtist = (tracks: Track[]) => {
  const artists = new Map<string, { name: string; tracks: Track[]; albums: Set<string> }>();
  
  tracks.forEach(track => {
    if (!artists.has(track.artist)) {
      artists.set(track.artist, {
        name: track.artist,
        tracks: [],
        albums: new Set()
      });
    }
    const artist = artists.get(track.artist)!;
    artist.tracks.push(track);
    artist.albums.add(track.album);
  });
  
  return Array.from(artists.values()).sort((a, b) => a.name.localeCompare(b.name));
};

// Group tracks by folder
const groupByFolder = (tracks: Track[]) => {
  const folders = new Map<string, { path: string; tracks: Track[] }>();
  
  tracks.forEach(track => {
    if (!track.filePath) return;
    const folderPath = track.filePath.replace(/[/\\][^/\\]+$/, '');
    if (!folders.has(folderPath)) {
      folders.set(folderPath, {
        path: folderPath,
        tracks: []
      });
    }
    folders.get(folderPath)!.tracks.push(track);
  });
  
  return Array.from(folders.values()).sort((a, b) => a.path.localeCompare(b.path));
};

export const LibraryView = memo(({
  tracks,
  currentTrackIndex,
  isPlaying,
  onTrackSelect,
  onPlayNext,
  onAddToQueue,
  onAddToPlaylist,
  title = "Bibliothèque",
  showFilters = true,
  viewMode = "tracks",
  emptyMessage = "Aucun titre trouvé",
  showHistory = false,
  initialSelectedAlbum,
  loading = false,
}: LibraryViewProps) => {
  const [displayMode, setDisplayMode] = useState<DisplayMode>("list");
  const [sortMode, setSortMode] = useState<SortMode>("title");
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const currentTrackRef = useRef<HTMLTableRowElement>(null);
  
  // Albums view state
  const [albumsViewMode, setAlbumsViewMode] = useState<"grid" | "list">("grid");
  const [albumsSearchQuery, setAlbumsSearchQuery] = useState("");
  const [albumsSortBy, setAlbumsSortBy] = useState<"name" | "artist" | "year" | "tracks">("name");
  const [albumsSortOrder, setAlbumsSortOrder] = useState<"asc" | "desc">("asc");
  const [albumsFilterArtist, setAlbumsFilterArtist] = useState<string | null>(null);
  
  // Artists view state
  const [artistsViewMode, setArtistsViewMode] = useState<"grid" | "list">("grid");
  const [artistsSearchQuery, setArtistsSearchQuery] = useState("");
  const [artistsSortBy, setArtistsSortBy] = useState<"name" | "albums" | "tracks">("name");
  const [artistsSortOrder, setArtistsSortOrder] = useState<"asc" | "desc">("asc");
  
  // Cloudinary upload
  const { uploadTrack, uploadAlbum, uploadPlaylist, getTrackProgress } = useCloudinaryUpload();
  // Bunny upload (Pro only)
  const { uploadTrack: uploadTrackToBunny, uploadAlbum: uploadAlbumToBunny, uploadPlaylist: uploadPlaylistToBunny, getTrackProgress: getBunnyTrackProgress } = useBunnyUpload();
  // Nexus upload (Pro only - local storage)
  const { uploadTrack: uploadTrackToNexus, uploadAlbum: uploadAlbumToNexus, uploadPlaylist: uploadPlaylistToNexus, getTrackProgress: getNexusTrackProgress } = useNexusUpload();
  const { cloudinaryConfigured, nexusIsPro, nexusAuthenticated } = useCloudSync();
  const playlistsResult = usePlaylists();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isUploaded, getUploadedProvider } = useUploadedStatus();
  
  // Ensure playlists is always an array
  const playlists = playlistsResult?.playlists ?? [];
  const createPlaylist = playlistsResult?.createPlaylist ?? (async () => null);
  
  // Free users: Cloudinary only (serveur 0)
  // Pro users: Bunny (serveur 1) and PlanetHoster/Nexus (serveur 2)
  const canUploadToCloudinary = cloudinaryConfigured && !nexusIsPro; // Free only
  const canUploadToBunny = nexusIsPro && nexusAuthenticated; // Pro only (serveur 1)
  const canUploadToNexus = nexusIsPro && nexusAuthenticated; // Pro only (serveur 2)

  const [searchQuery, setSearchQuery] = useState("");

  // État pour les playlists YouTube de l'artiste (toujours déclaré, même si non utilisé)
  const [youtubePlaylists, setYoutubePlaylists] = useState<Array<{ id: string; title: string; videoCount: number; tracks: Track[] }>>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);

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

  const filteredAndSortedTracks = useMemo(() => {
    // First remove duplicates from input tracks
    const uniqueTracks = getUniqueTracks(tracks);
    
    // Utiliser l'index inversé pour recherche rapide si query présente
    if (searchQuery.trim()) {
      // Import synchrone (require) pour éviter problèmes avec useMemo
      try {
        const { searchAndSortTracks } = require('@/lib/search-utils');
        return searchAndSortTracks(uniqueTracks, searchQuery, sortMode as 'title' | 'artist' | 'album' | 'duration' | 'date');
      } catch (error) {
        // Fallback si import échoue
        console.warn('[LibraryView] Erreur import search-utils, fallback recherche normale:', error);
      const query = searchQuery.toLowerCase();
        const filtered = uniqueTracks.filter(track =>
        track.title.toLowerCase().includes(query) ||
        track.artist.toLowerCase().includes(query) ||
        track.album.toLowerCase().includes(query)
      );
        // Trier avec Intl.Collator
        const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
        return [...filtered].sort((a, b) => {
          switch (sortMode) {
            case "title": return collator.compare(a.title, b.title);
            case "artist": return collator.compare(a.artist, b.artist);
            case "album": return collator.compare(a.album, b.album);
            case "duration": return b.duration - a.duration;
            case "date": return (b.addedAt || "").localeCompare(a.addedAt || "");
            default: return 0;
          }
        });
      }
    }
    
    // Pas de recherche, juste trier avec Intl.Collator (plus performant)
    const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
    return [...uniqueTracks].sort((a, b) => {
      switch (sortMode) {
        case "title":
          return collator.compare(a.title, b.title);
        case "artist":
          return collator.compare(a.artist, b.artist);
        case "album":
          return collator.compare(a.album, b.album);
        case "duration":
          return b.duration - a.duration;
        case "date":
          return (b.addedAt || "").localeCompare(a.addedAt || "");
        default:
          return 0;
      }
    });
  }, [tracks, sortMode, searchQuery, getUniqueTracks]);

  const albums = useMemo(() => groupByAlbum(tracks), [tracks]);
  const artists = useMemo(() => groupByArtist(tracks), [tracks]);
  const folders = useMemo(() => groupByFolder(tracks), [tracks]);

  // Filtered and sorted albums
  const filteredAndSortedAlbums = useMemo(() => {
    let filtered = albums;

    // Apply search filter
    if (albumsSearchQuery.trim()) {
      const query = albumsSearchQuery.toLowerCase();
      filtered = filtered.filter(album =>
        album.name.toLowerCase().includes(query) ||
        album.artist.toLowerCase().includes(query)
      );
    }

    // Apply artist filter
    if (albumsFilterArtist) {
      filtered = filtered.filter(album => album.artist === albumsFilterArtist);
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (albumsSortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "artist":
          comparison = a.artist.localeCompare(b.artist);
          break;
        case "year":
          comparison = (a.year || 0) - (b.year || 0);
          break;
        case "tracks":
          comparison = a.tracks.length - b.tracks.length;
          break;
      }
      return albumsSortOrder === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [albums, albumsSearchQuery, albumsFilterArtist, albumsSortBy, albumsSortOrder]);

  // Get unique artists for album filter
  const uniqueAlbumArtists = useMemo(() => {
    const artistsSet = new Set<string>();
    albums.forEach(album => {
      if (album.artist) artistsSet.add(album.artist);
    });
    return Array.from(artistsSet).sort();
  }, [albums]);

  // Filtered and sorted artists
  const filteredAndSortedArtists = useMemo(() => {
    let filtered = artists;

    // Apply search filter
    if (artistsSearchQuery.trim()) {
      const query = artistsSearchQuery.toLowerCase();
      filtered = filtered.filter(artist =>
        artist.name.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (artistsSortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "albums":
          comparison = a.albums.size - b.albums.size;
          break;
        case "tracks":
          comparison = a.tracks.length - b.tracks.length;
          break;
      }
      return artistsSortOrder === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [artists, artistsSearchQuery, artistsSortBy, artistsSortOrder]);

  const totalDuration = tracks.reduce((acc, track) => acc + track.duration, 0);

  // Handle initial album selection from props
  useEffect(() => {
    if (initialSelectedAlbum && viewMode === "albums") {
      setSelectedAlbum(initialSelectedAlbum);
    }
  }, [initialSelectedAlbum, viewMode]);

  // Scroll to current track when album is opened
  useEffect(() => {
    if (selectedAlbum && currentTrackRef.current) {
      setTimeout(() => {
        currentTrackRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [selectedAlbum, currentTrackIndex]);

  // Handle back navigation from detail view
  const handleBack = () => {
    setSelectedAlbum(null);
    setSelectedArtist(null);
    setSelectedFolder(null);
  };

  // Render loading state
  if (loading) {
    return (
      <div className="px-6 py-4 h-full flex flex-col animate-in fade-in duration-200">
        <PageHeaderSkeleton />
        <div className="mt-6">
          {viewMode === "albums" && <AlbumGridSkeleton count={12} />}
          {viewMode === "artists" && <AlbumGridSkeleton count={12} />}
          {viewMode === "tracks" && displayMode === "grid" && <TrackGridSkeleton count={20} />}
          {viewMode === "tracks" && displayMode === "list" && <TrackTableSkeleton count={15} />}
          {viewMode === "folders" && <TrackTableSkeleton count={10} />}
        </div>
      </div>
    );
  }

  // Render empty state
  if (tracks.length === 0) {
    return (
      <div className="px-6 py-4 h-full flex flex-col items-center justify-center text-center animate-in fade-in duration-200">
        <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-4">
          <Music className="w-10 h-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">{emptyMessage}</h3>
        <p className="text-muted-foreground text-sm max-w-md">
          {viewMode === "tracks" && "Ajoutez des fichiers audio pour voir votre bibliothèque."}
          {viewMode === "albums" && "Les albums apparaîtront ici une fois la musique ajoutée."}
          {viewMode === "artists" && "Les artistes apparaîtront ici une fois la musique ajoutée."}
          {viewMode === "folders" && "Les dossiers scannés apparaîtront ici."}
        </p>
      </div>
    );
  }

  // Album Detail View
  if (selectedAlbum) {
    const album = albums.find(a => `${a.name}-${a.artist}` === selectedAlbum);
    if (!album) return null;

    return (
      <div className="px-6 py-4 space-y-6 animate-in fade-in slide-in-from-right duration-200">
        <button onClick={handleBack} className="text-sm text-muted-foreground hover:text-foreground transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 rounded">
          ← Retour aux albums
        </button>
        
        <div className="flex gap-6">
          <div className="w-48 h-48 rounded-xl overflow-hidden shadow-2xl flex-shrink-0">
            <img src={getCoverUrl(album.coverUrl)} alt={album.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col justify-end">
            <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Album</p>
            <h1 className="font-display text-4xl font-bold mb-2">{album.name}</h1>
            <p className="text-lg text-muted-foreground mb-4">{album.artist}</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {album.year && <span>{album.year}</span>}
              <span>{album.tracks.length} titres</span>
              <span>{formatDuration(album.tracks.reduce((a, t) => a + t.duration, 0))}</span>
            </div>
            <div className="flex gap-3 mt-4">
              <Button onClick={() => {
                const firstTrack = album.tracks[0];
                const idx = tracks.findIndex(t => t.id === firstTrack.id);
                if (idx !== -1) onTrackSelect(idx);
              }} className="gap-2">
                <Play className="w-4 h-4 fill-current" />
                Lecture
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => {
                const shuffled = [...album.tracks].sort(() => Math.random() - 0.5);
                const idx = tracks.findIndex(t => t.id === shuffled[0].id);
                if (idx !== -1) onTrackSelect(idx);
              }}>
                <Shuffle className="w-4 h-4" />
                Aléatoire
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => {
                  album.tracks.forEach(track => toggleFavorite(track.id));
                }}
              >
                <Heart className={cn("w-4 h-4", album.tracks.some(t => isFavorite(t.id)) && "fill-red-500 text-red-500")} />
              </Button>
            </div>
          </div>
        </div>

        {/* Track list */}
        <div className="bg-card/30 backdrop-blur-sm rounded-xl border border-border/30 relative">
          <div className="overflow-y-auto max-h-[calc(100vh-400px)]">
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/50">
                <tr className="border-b border-border/30">
                  <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground w-12">#</th>
                  <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground">Titre</th>
                  <th className="px-4 py-3 text-right text-xs font-display uppercase tracking-widest text-muted-foreground">Durée</th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody>
              {album.tracks.map((track, idx) => {
                const actualIndex = tracks.findIndex(t => t.id === track.id);
                const isCurrentTrack = currentTrackIndex === actualIndex;
                const tooltipText = `${track.title} - ${track.artist} - ${formatTime(track.duration)}`;

                return (
                  <tr
                    key={`album-track-${track.id}-${idx}`}
                    ref={isCurrentTrack ? currentTrackRef : null}
                    onClick={() => onTrackSelect(actualIndex)}
                    className={cn(
                      "group cursor-pointer transition-all duration-200",
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
                            <span className="text-sm text-muted-foreground group-hover:hidden">{track.trackNumber || idx + 1}</span>
                            <Play className="w-4 h-4 text-foreground hidden group-hover:block fill-current" />
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <TrackContextMenu
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
                              <div className="flex items-center gap-2">
                          <p className={cn("text-sm font-medium", isCurrentTrack ? "text-primary" : "text-foreground")}>
                            {track.title}
                          </p>
                                {isUploaded(track.id) && (
                                  <UploadIndicator provider={getUploadedProvider(track.id) || undefined} size="sm" />
                                )}
                              </div>
                            </TrackContextMenu>
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
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-muted-foreground font-mono">{formatTime(track.duration)}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <TrackContextMenu
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
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                              aria-label="Options"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-sm">Options</div>
                          </TooltipContent>
                        </Tooltip>
                      </TrackContextMenu>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Charger les playlists YouTube de l'artiste si c'est un profil YouTube
  // (hooks toujours appelés, mais logique conditionnelle à l'intérieur)
  useEffect(() => {
    // Ne charger que si on est en mode artistes et qu'un artiste est sélectionné
    if (viewMode !== "artists" || !selectedArtist) {
      setYoutubePlaylists([]);
      setLoadingPlaylists(false);
      return;
    }

    const loadArtistPlaylists = async () => {
      // Trouver l'artiste
      const artist = artists.find(a => a.name === selectedArtist);
      if (!artist) {
        setYoutubePlaylists([]);
        return;
      }

      // Chercher un track YouTube de cet artiste pour détecter le profil
      const youtubeTrack = artist.tracks.find(t => 
        t.mediaSource === 'youtube' && 
        (t.filePath?.includes('/@') || t.filePath?.includes('/channel/') || 
         (!t.youtubeVideoId || t.youtubeVideoId === 'undefined' || t.duration === 0))
      );

      if (!youtubeTrack || !youtubeTrack.filePath) {
        console.log(`[LibraryView] Pas de profil YouTube trouvé pour l'artiste: ${selectedArtist}`);
        setYoutubePlaylists([]);
        return;
      }

      console.log(`[LibraryView] 🎵 Chargement playlists YouTube pour l'artiste: ${selectedArtist}`);
      setLoadingPlaylists(true);

      try {
        // Extraire le channelId depuis le track
        const channelId = extractYouTubeChannelId(youtubeTrack.filePath);
        
        let actualChannelId = channelId;
        
        // Si pas de channelId direct, rechercher par nom d'artiste
        if (!actualChannelId) {
          console.log(`[LibraryView] Recherche channelId pour: ${selectedArtist}`);
          const apiKey = typeof window !== 'undefined' 
            ? (localStorage.getItem("nexus-youtube-api-key") || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || null)
            : null;
          
          if (apiKey) {
            const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
            searchUrl.searchParams.set("key", apiKey);
            searchUrl.searchParams.set("part", "snippet");
            searchUrl.searchParams.set("type", "channel");
            searchUrl.searchParams.set("q", selectedArtist);
            searchUrl.searchParams.set("maxResults", "1");
            
            const searchResponse = await fetch(searchUrl.toString());
            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              if (searchData.items && searchData.items.length > 0) {
                actualChannelId = searchData.items[0].id.channelId;
                console.log(`[LibraryView] ✅ ChannelId trouvé: ${actualChannelId}`);
              }
            }
          }
        }

        if (actualChannelId) {
          // Charger les playlists
          const playlists = await fetchYouTubeChannelPlaylists(actualChannelId, 20);
          console.log(`[LibraryView] ${playlists.length} playlists trouvées pour ${selectedArtist}`);

          // Charger les vidéos de chaque playlist
          const playlistsWithTracks = await Promise.all(
            playlists.slice(0, 10).map(async (playlist) => {
              try {
                const videos = await fetchYouTubePlaylistVideos(playlist.videoId, 10);
                // Filtrer les vidéos sans videoId valide
                const validVideos = videos.filter(v => v.videoId && v.videoId !== 'undefined' && v.videoId.trim() !== '');
                const tracks = youtubeSuggestionsToTracks(validVideos);
                return {
                  id: playlist.videoId,
                  title: playlist.title,
                  videoCount: playlist.viewCount || validVideos.length,
                  tracks: tracks,
                };
              } catch (err) {
                console.warn(`[LibraryView] Erreur chargement playlist ${playlist.videoId}:`, err);
                return {
                  id: playlist.videoId,
                  title: playlist.title,
                  videoCount: playlist.viewCount || 0,
                  tracks: [],
                };
              }
            })
          );

          setYoutubePlaylists(playlistsWithTracks.filter(p => p.tracks.length > 0));
          console.log(`[LibraryView] ✅ ${playlistsWithTracks.filter(p => p.tracks.length > 0).length} playlists chargées avec succès`);
        } else {
          setYoutubePlaylists([]);
        }
      } catch (err) {
        console.error(`[LibraryView] Erreur chargement playlists pour ${selectedArtist}:`, err);
        setYoutubePlaylists([]);
      } finally {
        setLoadingPlaylists(false);
      }
    };

    loadArtistPlaylists();
  }, [viewMode, selectedArtist, artists]);

  // Artist Details View
  if (viewMode === "artists" && selectedArtist) {
    const artist = artists.find(a => a.name === selectedArtist);
    if (!artist) return null;

    // Calculate artist albums (moved outside useMemo to avoid hook order issues)
    const artistAlbums = (() => {
      const albumsMap = new Map<string, { name: string; coverUrl: string; tracks: Track[] }>();
      artist.tracks.forEach(track => {
        const key = track.album;
        if (!albumsMap.has(key)) {
          albumsMap.set(key, {
            name: track.album,
            coverUrl: track.coverUrl,
            tracks: []
          });
        }
        albumsMap.get(key)!.tracks.push(track);
      });
      return Array.from(albumsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    })();

    return (
      <div className="px-6 py-4 space-y-6 animate-in fade-in slide-in-from-right duration-200">
        <button 
          onClick={() => setSelectedArtist(null)} 
          className="text-sm text-muted-foreground hover:text-foreground transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 rounded"
        >
          ← Retour aux artistes
        </button>
        
        <div className="flex gap-6">
          <div className="w-48 h-48 rounded-full overflow-hidden shadow-2xl flex-shrink-0 bg-gradient-to-br from-primary/20 to-secondary/20">
            {artist.tracks[0]?.coverUrl ? (
              <img 
                src={getCoverUrl(artist.tracks[0].coverUrl)} 
                alt={artist.name} 
                className="w-full h-full object-cover" 
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-24 h-24 text-primary/50" />
              </div>
            )}
          </div>
          <div className="flex flex-col justify-end">
            <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Artiste</p>
            <h1 className="font-display text-4xl font-bold mb-4">{artist.name}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <span>{artist.albums.size} album{artist.albums.size > 1 ? "s" : ""}</span>
              <span>{artist.tracks.length} titre{artist.tracks.length > 1 ? "s" : ""}</span>
              <span>{formatDuration(artist.tracks.reduce((a, t) => a + t.duration, 0))}</span>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => {
                const firstTrack = artist.tracks[0];
                const idx = tracks.findIndex(t => t.id === firstTrack.id);
                if (idx !== -1) onTrackSelect(idx);
              }} className="gap-2">
                <Play className="w-4 h-4 fill-current" />
                Lecture
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => {
                const shuffled = [...artist.tracks].sort(() => Math.random() - 0.5);
                const idx = tracks.findIndex(t => t.id === shuffled[0].id);
                if (idx !== -1) onTrackSelect(idx);
              }}>
                <Shuffle className="w-4 h-4" />
                Aléatoire
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => {
                  artist.tracks.forEach(track => toggleFavorite(track.id));
                }}
              >
                <Heart className={cn("w-4 h-4", artist.tracks.some(t => isFavorite(t.id)) && "fill-red-500 text-red-500")} />
              </Button>
            </div>
          </div>
        </div>

        {/* Playlists YouTube */}
        {youtubePlaylists.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ListMusic className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Playlists YouTube</h2>
          </div>
            {loadingPlaylists ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {youtubePlaylists.map((playlist) => (
                  <div
                    key={playlist.id}
                    className="group relative p-4 rounded-xl text-left transition-all duration-200 ease-out hover:bg-card/50 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    onClick={() => {
                      // Jouer la première vidéo de la playlist
                      if (playlist.tracks.length > 0) {
                        const firstTrack = playlist.tracks[0];
                        const idx = tracks.findIndex(t => t.id === firstTrack.id);
                        if (idx !== -1) {
                          onTrackSelect(idx);
                        } else {
                          // Ajouter tous les tracks de la playlist à la queue
                          if (onAddToQueue) {
                            playlist.tracks.forEach(track => onAddToQueue(track));
                          }
                        }
                      }
                    }}
                  >
                    <div className="aspect-square rounded-lg overflow-hidden mb-3 relative shadow-lg bg-gradient-to-br from-primary/20 to-secondary/20">
                      {playlist.tracks[0]?.coverUrl ? (
                        <img
                          src={getCoverUrl(playlist.tracks[0].coverUrl)}
                          alt={playlist.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ListMusic className="w-10 h-10 text-primary/50" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out">
                        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg">
                          <Play className="w-6 h-6 text-primary-foreground fill-current ml-0.5" />
                        </div>
                      </div>
                    </div>
                    <p className="text-sm font-medium truncate text-foreground">{playlist.title}</p>
                    <p className="text-xs text-muted-foreground/70">{playlist.videoCount} vidéos</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Albums Grid */}
        {artistAlbums.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Albums</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {artistAlbums.map((album) => (
                <AlbumContextMenu
                  key={album.name}
                  album={{
                    name: album.name,
                    artist: artist.name,
                    tracks: album.tracks,
                    coverUrl: album.coverUrl
                  }}
                  playlists={playlists}
                  onPlay={() => {
                    const firstTrack = album.tracks[0];
                    const idx = tracks.findIndex(t => t.id === firstTrack.id);
                    if (idx !== -1) onTrackSelect(idx);
                  }}
                  onShuffle={() => {
                    const shuffled = [...album.tracks].sort(() => Math.random() - 0.5);
                    const idx = tracks.findIndex(t => t.id === shuffled[0].id);
                    if (idx !== -1) onTrackSelect(idx);
                  }}
                  onAddToQueue={() => {
                    if (onAddToQueue) {
                      album.tracks.forEach(track => onAddToQueue(track));
                    }
                  }}
                  onAddToPlaylist={(playlistId) => {
                    if (onAddToPlaylist) {
                      album.tracks.forEach(track => onAddToPlaylist(playlistId, track));
                    }
                  }}
                  onCreatePlaylist={() => createPlaylist("Nouvelle playlist", album.tracks.map(t => t.id))}
                  onViewAlbum={() => {
                    setSelectedArtist(null);
                    setSelectedAlbum(`${album.name}-${artist.name}`);
                  }}
                  onViewArtist={() => {}}
                  onUploadToCloudinary={() => uploadAlbum(album.tracks)}
                  canUploadToCloudinary={canUploadToCloudinary && album.tracks.some(t => t.filePath)}
                  onUploadToNexus={() => uploadAlbumToNexus(album.tracks)}
                  canUploadToNexus={canUploadToNexus && album.tracks.some(t => t.filePath)}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="group relative">
                        <button
                          onClick={() => {
                            setSelectedArtist(null);
                            setSelectedAlbum(`${album.name}-${artist.name}`);
                          }}
                          className="w-full p-4 rounded-xl text-left transition-all duration-200 ease-out hover:bg-card/50 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                        >
                          <div className="aspect-square rounded-lg overflow-hidden mb-3 relative shadow-lg">
                            {album.coverUrl ? (
                              <img
                                src={getCoverUrl(album.coverUrl)}
                                alt={album.name}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
                                <Disc3 className="w-10 h-10 text-primary/50" />
          </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out">
                              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg">
                                <Play className="w-6 h-6 text-primary-foreground fill-current ml-0.5" />
        </div>
                            </div>
                          </div>
                          <p className="text-sm font-medium truncate text-foreground">{album.name}</p>
                          <p className="text-xs text-muted-foreground/70">{album.tracks.length} titres</p>
                        </button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-sm font-medium">{album.name}</div>
                      <div className="text-xs text-muted-foreground">{artist.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {album.tracks.length} titre{album.tracks.length > 1 ? "s" : ""}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </AlbumContextMenu>
              ))}
            </div>
          </div>
        )}

        {/* Track list */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Tous les titres</h2>
          <div className="bg-card/30 backdrop-blur-sm rounded-xl border border-border/30 relative">
            <div className="overflow-y-auto max-h-[calc(100vh-400px)]">
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/50">
                  <tr className="border-b border-border/30">
                    <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground w-12">#</th>
                    <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground">Titre</th>
                    <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden md:table-cell">Album</th>
                    <th className="px-4 py-3 text-right text-xs font-display uppercase tracking-widest text-muted-foreground">Durée</th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {artist.tracks.map((track, idx) => {
                    const actualIndex = tracks.findIndex(t => t.id === track.id);
                    const isCurrentTrack = currentTrackIndex === actualIndex;

                    return (
                      <tr
                        key={`artist-track-${track.id}-${idx}`}
                        ref={isCurrentTrack ? currentTrackRef : null}
                        onClick={() => onTrackSelect(actualIndex)}
                        className={cn(
                          "group cursor-pointer transition-all duration-200",
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
                                <span className="text-sm text-muted-foreground group-hover:hidden">{track.trackNumber || idx + 1}</span>
                                <Play className="w-4 h-4 text-foreground hidden group-hover:block fill-current" />
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <TrackContextMenu
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
                                  onUploadToNexus={() => uploadTrackToNexus?.(track)}
                                  canUploadToNexus={canUploadToNexus && !!track.filePath}
                                  isUploadingToNexus={getNexusTrackProgress?.(track.id)?.status === 'uploading'}
                                >
                                  <div className="flex items-center gap-2">
                                    <p className={cn("text-sm font-medium", isCurrentTrack ? "text-primary" : "text-foreground")}>
                                      {track.title}
                                    </p>
                                    {isUploaded(track.id) && (
                                      <UploadIndicator provider={getUploadedProvider(track.id) || undefined} size="sm" />
                                    )}
                                  </div>
                                </TrackContextMenu>
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
                        <td className="px-4 py-3 hidden md:table-cell">
                          <p className="text-sm text-muted-foreground truncate">{track.album}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-muted-foreground font-mono">{formatTime(track.duration)}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <TrackContextMenu
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
                            onUploadToNexus={() => uploadTrackToNexus?.(track)}
                            canUploadToNexus={canUploadToNexus && !!track.filePath}
                            isUploadingToNexus={getNexusTrackProgress?.(track.id)?.status === 'uploading'}
                          >
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                  }}
                                  className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                  aria-label="Options"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-sm">Options</div>
                              </TooltipContent>
                            </Tooltip>
                          </TrackContextMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Albums View
  if (viewMode === "albums" && !selectedAlbum) {
    return (
      <div className="h-full flex flex-col animate-in fade-in duration-200">
        <div className="px-6 pt-4">
          <PageHeader
            title={title}
            subtitle={`${filteredAndSortedAlbums.length} album${filteredAndSortedAlbums.length > 1 ? "s" : ""} • ${tracks.length} titre${tracks.length > 1 ? "s" : ""}`}
            rightContent={
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setAlbumsViewMode(albumsViewMode === "grid" ? "list" : "grid")}
                      className="h-9 w-9"
                    >
                      {albumsViewMode === "grid" ? (
                        <List className="h-4 w-4" />
                      ) : (
                        <Grid className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {albumsViewMode === "grid" ? "Vue liste" : "Vue grille"}
                  </TooltipContent>
                </Tooltip>
              </div>
            }
          />
        </div>

        {/* Filters and Search */}
        <div className="px-6 py-4 border-b bg-muted/30 space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un album..."
                  value={albumsSearchQuery}
                  onChange={(e) => setAlbumsSearchQuery(e.target.value)}
                  className="pl-9"
                />
                {albumsSearchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                    onClick={() => setAlbumsSearchQuery("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Artist Filter */}
            <div className="w-[180px]">
              <Select
                value={albumsFilterArtist || "__all__"}
                onValueChange={(value) => setAlbumsFilterArtist(value === "__all__" ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Artiste" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tous les artistes</SelectItem>
                  {uniqueAlbumArtists.map((artist) => (
                    <SelectItem key={artist} value={artist}>
                      {artist}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort */}
            <div className="w-[180px]">
              <Select
                value={albumsSortBy}
                onValueChange={(value) => setAlbumsSortBy(value as "name" | "artist" | "year" | "tracks")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Trier par" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nom</SelectItem>
                  <SelectItem value="artist">Artiste</SelectItem>
                  <SelectItem value="year">Année</SelectItem>
                  <SelectItem value="tracks">Nombre de titres</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort Order */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setAlbumsSortOrder(albumsSortOrder === "asc" ? "desc" : "asc")}
                  className="h-9 w-9"
                >
                  {albumsSortOrder === "asc" ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {albumsSortOrder === "asc" ? "Ordre croissant" : "Ordre décroissant"}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Badges */}
          {(albumsSearchQuery || albumsFilterArtist) && (
            <div className="flex items-center gap-2 flex-wrap">
              {albumsSearchQuery && (
                <Badge variant="secondary" className="gap-1">
                  Recherche: {albumsSearchQuery}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => setAlbumsSearchQuery("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {albumsFilterArtist && (
                <Badge variant="secondary" className="gap-1">
                  Artiste: {albumsFilterArtist}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => setAlbumsFilterArtist(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Albums Content */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {loading ? (
            albumsViewMode === "grid" ? (
              <AlbumGridSkeleton />
            ) : (
              <AlbumTableSkeleton />
            )
          ) : filteredAndSortedAlbums.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <Disc3 className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun album trouvé</h3>
              <p className="text-sm text-muted-foreground">
                {albumsSearchQuery || albumsFilterArtist
                  ? "Essayez de modifier vos filtres de recherche"
                  : "Aucun album dans votre bibliothèque"}
              </p>
            </div>
          ) : albumsViewMode === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredAndSortedAlbums.map((album) => (
            <AlbumContextMenu
              key={`${album.name}-${album.artist}`}
              album={album}
              playlists={playlists}
              onPlay={() => {
                const firstTrack = album.tracks[0];
                const idx = tracks.findIndex(t => t.id === firstTrack.id);
                if (idx !== -1) onTrackSelect(idx);
              }}
              onShuffle={() => {
                const shuffled = [...album.tracks].sort(() => Math.random() - 0.5);
                const idx = tracks.findIndex(t => t.id === shuffled[0].id);
                if (idx !== -1) onTrackSelect(idx);
              }}
              onAddToQueue={() => {
                if (onAddToQueue) {
                  album.tracks.forEach(track => onAddToQueue(track));
                }
              }}
              onAddToPlaylist={(playlistId) => {
                if (onAddToPlaylist) {
                  album.tracks.forEach(track => onAddToPlaylist(playlistId, track));
                }
              }}
              onCreatePlaylist={() => createPlaylist("Nouvelle playlist", album.tracks.map(t => t.id))}
              onViewAlbum={() => setSelectedAlbum(`${album.name}-${album.artist}`)}
              onViewArtist={() => setSelectedArtist(album.artist)}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="group relative">
                    <button
                      onClick={() => setSelectedAlbum(`${album.name}-${album.artist}`)}
                      className="w-full p-4 rounded-xl text-left transition-all duration-200 ease-out hover:bg-card/50 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                    >
                  <div className="aspect-square rounded-lg overflow-hidden mb-3 relative shadow-lg">
                            {album.coverUrl ? (
                              <img
                                src={getCoverUrl(album.coverUrl)}
                                alt={album.name}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
                                <Disc3 className="w-10 h-10 text-primary/50" />
                              </div>
                            )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out">
                      <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg">
                        <Play className="w-6 h-6 text-primary-foreground fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-medium truncate text-foreground">{album.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{album.artist}</p>
                  <p className="text-xs text-muted-foreground/70">{album.tracks.length} titres</p>
                    </button>
                    <button
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background text-muted-foreground hover:text-foreground"
                          aria-label="Plus d'options"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm font-medium">{album.name}</div>
                  <div className="text-xs text-muted-foreground">{album.artist}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {album.tracks.length} titre{album.tracks.length > 1 ? "s" : ""}
                      </div>
                </TooltipContent>
              </Tooltip>
            </AlbumContextMenu>
          ))}
        </div>
          ) : (
            <div className="bg-card/30 backdrop-blur-sm rounded-xl border border-border/30 overflow-hidden">
              <div className="overflow-y-auto max-h-[calc(100vh-400px)]">
                <table className="w-full">
                  <thead className="sticky top-0 z-10 bg-muted/50 backdrop-blur-sm">
                    <tr className="border-b border-border/30">
                      <th className="px-4 py-2.5 text-left text-xs font-display uppercase tracking-widest text-muted-foreground">
                        Album
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                        Artiste
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden lg:table-cell">
                        Année
                      </th>
                      <th className="px-4 py-2.5 text-right text-xs font-display uppercase tracking-widest text-muted-foreground">
                        Titres
                      </th>
                      <th className="px-4 py-2.5 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedAlbums.map((album) => {
                      const handlePlay = () => {
                        const firstTrack = album.tracks[0];
                        const idx = tracks.findIndex(t => t.id === firstTrack.id);
                        if (idx !== -1) onTrackSelect(idx);
                      };

                      return (
                        <AlbumContextMenu
                          key={`${album.name}-${album.artist}`}
                          album={album}
                          playlists={playlists}
                          onPlay={handlePlay}
                          onShuffle={() => {
                            const shuffled = [...album.tracks].sort(() => Math.random() - 0.5);
                            const idx = tracks.findIndex(t => t.id === shuffled[0].id);
                            if (idx !== -1) onTrackSelect(idx);
                          }}
                          onAddToQueue={() => {
                            if (onAddToQueue) {
                              album.tracks.forEach(track => onAddToQueue(track));
                            }
                          }}
                          onAddToPlaylist={(playlistId) => {
                            if (onAddToPlaylist) {
                              album.tracks.forEach(track => onAddToPlaylist(playlistId, track));
                            }
                          }}
                          onCreatePlaylist={() => createPlaylist("Nouvelle playlist", album.tracks.map(t => t.id))}
                          onViewAlbum={() => setSelectedAlbum(`${album.name}-${album.artist}`)}
                          onViewArtist={() => setSelectedArtist(album.artist)}
                          onUploadToCloudinary={() => uploadAlbum(album.tracks)}
                          canUploadToCloudinary={canUploadToCloudinary && album.tracks.some(t => t.filePath)}
                          onUploadToNexus={() => uploadAlbumToNexus(album.tracks)}
                          canUploadToNexus={canUploadToNexus && album.tracks.some(t => t.filePath)}
                        >
                          <tr
                            onClick={() => setSelectedAlbum(`${album.name}-${album.artist}`)}
                            className="group cursor-pointer transition-all duration-200 ease-out hover:bg-muted/40 active:bg-muted/50"
                          >
                            <td className="px-4 py-3">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-3">
                                    <div className="relative w-12 h-12 rounded overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary/20 to-secondary/20">
                                      {album.coverUrl ? (
                                        <img
                                          src={getCoverUrl(album.coverUrl)}
                                          alt={album.name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <Disc3 className="w-6 h-6 text-primary/50" />
                                        </div>
                                      )}
                                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                                      </div>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium truncate text-foreground">
                                          {album.name}
                                        </p>
                                        {album.tracks.some(t => isUploaded(t.id)) && (
                                          <UploadIndicator 
                                            provider={album.tracks.find(t => isUploaded(t.id)) ? getUploadedProvider(album.tracks.find(t => isUploaded(t.id))!.id) || undefined : undefined} 
                                            size="sm" 
                                          />
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-sm font-medium">{album.name}</div>
                                  <div className="text-xs text-muted-foreground">{album.artist}</div>
                                  {album.year && <div className="text-xs text-muted-foreground mt-1">Année: {album.year}</div>}
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {album.tracks.length} titre{album.tracks.length > 1 ? "s" : ""}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="text-sm text-muted-foreground truncate">{album.artist}</p>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-sm font-medium">{album.artist}</div>
                                </TooltipContent>
                              </Tooltip>
                            </td>
                            <td className="px-4 py-3 hidden lg:table-cell">
                              <p className="text-sm text-muted-foreground">
                                {album.year || "-"}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm text-muted-foreground font-mono">
                                {album.tracks.length}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                    className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                    aria-label="Options"
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-sm">Clic droit pour plus d'options</div>
                                </TooltipContent>
                              </Tooltip>
                            </td>
                          </tr>
                        </AlbumContextMenu>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Artists View
  if (viewMode === "artists") {
    return (
      <div className="h-full flex flex-col animate-in fade-in duration-200">
        <div className="px-6 pt-4">
          <PageHeader
            title={title}
            subtitle={`${filteredAndSortedArtists.length} artiste${filteredAndSortedArtists.length > 1 ? "s" : ""}`}
            rightContent={
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setArtistsViewMode(artistsViewMode === "grid" ? "list" : "grid")}
                      className="h-9 w-9"
                    >
                      {artistsViewMode === "grid" ? (
                        <List className="h-4 w-4" />
                      ) : (
                        <Grid className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {artistsViewMode === "grid" ? "Vue liste" : "Vue grille"}
                  </TooltipContent>
                </Tooltip>
          </div>
            }
          />
        </div>

        {/* Filters and Search */}
        <div className="px-6 py-4 border-b bg-muted/30 space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un artiste..."
                  value={artistsSearchQuery}
                  onChange={(e) => setArtistsSearchQuery(e.target.value)}
                  className="pl-9"
                />
                {artistsSearchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                    onClick={() => setArtistsSearchQuery("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Sort */}
            <div className="w-[180px]">
              <Select
                value={artistsSortBy}
                onValueChange={(value) => setArtistsSortBy(value as "name" | "albums" | "tracks")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Trier par" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nom</SelectItem>
                  <SelectItem value="albums">Nombre d'albums</SelectItem>
                  <SelectItem value="tracks">Nombre de titres</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort Order */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setArtistsSortOrder(artistsSortOrder === "asc" ? "desc" : "asc")}
                  className="h-9 w-9"
                >
                  {artistsSortOrder === "asc" ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {artistsSortOrder === "asc" ? "Ordre croissant" : "Ordre décroissant"}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Badges */}
          {artistsSearchQuery && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="gap-1">
                Recherche: {artistsSearchQuery}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={() => setArtistsSearchQuery("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            </div>
          )}
        </div>

        {/* Artists Content */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {loading ? (
            artistsViewMode === "grid" ? (
              <AlbumGridSkeleton />
            ) : (
              <ArtistTableSkeleton />
            )
          ) : filteredAndSortedArtists.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <User className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun artiste trouvé</h3>
              <p className="text-sm text-muted-foreground">
                {artistsSearchQuery
                  ? "Essayez de modifier vos filtres de recherche"
                  : "Aucun artiste dans votre bibliothèque"}
              </p>
            </div>
          ) : artistsViewMode === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredAndSortedArtists.map((artist) => {
            const coverUrl = artist.tracks[0]?.coverUrl;
            return (
              <ArtistContextMenu
                key={artist.name}
                artist={artist}
                playlists={playlists}
                onPlay={() => {
                  const firstTrack = artist.tracks[0];
                  const idx = tracks.findIndex(t => t.id === firstTrack.id);
                  if (idx !== -1) onTrackSelect(idx);
                }}
                onShuffle={() => {
                  const shuffled = [...artist.tracks].sort(() => Math.random() - 0.5);
                  const idx = tracks.findIndex(t => t.id === shuffled[0].id);
                  if (idx !== -1) onTrackSelect(idx);
                }}
                onAddToQueue={() => {
                  if (onAddToQueue) {
                    artist.tracks.forEach(track => onAddToQueue(track));
                  }
                }}
                onAddToPlaylist={(playlistId) => {
                  if (onAddToPlaylist) {
                    artist.tracks.forEach(track => onAddToPlaylist(playlistId, track));
                  }
                }}
                onCreatePlaylist={() => createPlaylist("Nouvelle playlist", artist.tracks.map(t => t.id))}
                onViewArtist={() => setSelectedArtist(artist.name)}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="group relative">
                      <button
                            onClick={() => setSelectedArtist(artist.name)}
                        className="w-full p-4 rounded-xl text-left transition-all duration-200 ease-out hover:bg-card/50 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                      >
                    <div className="aspect-square rounded-full overflow-hidden mb-3 relative shadow-lg mx-auto w-32">
                      {coverUrl ? (
                                <img
                                  src={getCoverUrl(coverUrl)}
                                  alt={artist.name}
                                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                          <User className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                          <Play className="w-5 h-5 text-primary-foreground fill-current ml-0.5" />
                        </div>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-center truncate text-foreground">{artist.name}</p>
                    <p className="text-xs text-muted-foreground text-center">
                      {artist.albums.size} albums • {artist.tracks.length} titres
                    </p>
                      </button>
                      <button
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background text-muted-foreground hover:text-foreground"
                            aria-label="Plus d'options"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm font-medium">{artist.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {artist.albums.size} album{artist.albums.size > 1 ? "s" : ""} • {artist.tracks.length} titre{artist.tracks.length > 1 ? "s" : ""}
                        </div>
                  </TooltipContent>
                </Tooltip>
              </ArtistContextMenu>
            );
          })}
        </div>
          ) : (
            <div className="bg-card/30 backdrop-blur-sm rounded-xl border border-border/30 overflow-hidden">
              <div className="overflow-y-auto max-h-[calc(100vh-400px)]">
                <table className="w-full">
                  <thead className="sticky top-0 z-10 bg-muted/50 backdrop-blur-sm">
                    <tr className="border-b border-border/30">
                      <th className="px-4 py-2.5 text-left text-xs font-display uppercase tracking-widest text-muted-foreground">
                        Artiste
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                        Albums
                      </th>
                      <th className="px-4 py-2.5 text-right text-xs font-display uppercase tracking-widest text-muted-foreground">
                        Titres
                      </th>
                      <th className="px-4 py-2.5 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedArtists.map((artist) => {
                      const coverUrl = artist.tracks[0]?.coverUrl;
                      const handlePlay = () => {
                        const firstTrack = artist.tracks[0];
                        const idx = tracks.findIndex(t => t.id === firstTrack.id);
                        if (idx !== -1) onTrackSelect(idx);
                      };

                      return (
                        <ArtistContextMenu
                          key={artist.name}
                          artist={artist}
                          playlists={playlists}
                          onPlay={handlePlay}
                          onShuffle={() => {
                            const shuffled = [...artist.tracks].sort(() => Math.random() - 0.5);
                            const idx = tracks.findIndex(t => t.id === shuffled[0].id);
                            if (idx !== -1) onTrackSelect(idx);
                          }}
                          onAddToQueue={() => {
                            if (onAddToQueue) {
                              artist.tracks.forEach(track => onAddToQueue(track));
                            }
                          }}
                          onAddToPlaylist={(playlistId) => {
                            if (onAddToPlaylist) {
                              artist.tracks.forEach(track => onAddToPlaylist(playlistId, track));
                            }
                          }}
                          onCreatePlaylist={() => createPlaylist("Nouvelle playlist", artist.tracks.map(t => t.id))}
                          onViewArtist={() => setSelectedArtist(artist.name)}
                        >
                          <tr
                            onClick={() => setSelectedArtist(artist.name)}
                            className="group cursor-pointer transition-all duration-200 ease-out hover:bg-muted/40 active:bg-muted/50"
                          >
                            <td className="px-4 py-3">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-3">
                                    <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary/20 to-secondary/20">
                                      {coverUrl ? (
                                        <img
                                          src={getCoverUrl(coverUrl)}
                                          alt={artist.name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <User className="w-6 h-6 text-primary/50" />
                                        </div>
                                      )}
                                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                                        <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                                      </div>
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium truncate text-foreground">
                                        {artist.name}
                                      </p>
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-sm font-medium">{artist.name}</div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {artist.albums.size} album{artist.albums.size > 1 ? "s" : ""} • {artist.tracks.length} titre{artist.tracks.length > 1 ? "s" : ""}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              <span className="text-sm text-muted-foreground">
                                {artist.albums.size}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm text-muted-foreground font-mono">
                                {artist.tracks.length}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                    className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                    aria-label="Options"
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-sm">Clic droit pour plus d'options</div>
                                </TooltipContent>
                              </Tooltip>
                            </td>
                          </tr>
                        </ArtistContextMenu>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Folders View
  if (viewMode === "folders") {
    return (
      <div className="px-6 py-4 space-y-6 animate-in fade-in duration-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold mb-1">{title}</h1>
            <p className="text-muted-foreground">{folders.length} dossiers • {tracks.length} fichiers</p>
          </div>
        </div>

        <div className="space-y-2">
          {folders.map((folder) => (
            <Tooltip key={folder.path}>
              <TooltipTrigger asChild>
                <div
                  className="flex items-center gap-4 p-4 rounded-xl bg-card/30 hover:bg-card/50 transition-colors"
                >
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <FolderOpen className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{folder.path.split(/[/\\]/).pop()}</p>
                <p className="text-xs text-muted-foreground truncate">{folder.path}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{folder.tracks.length} fichiers</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const firstTrack = folder.tracks[0];
                  const idx = tracks.findIndex(t => t.id === firstTrack.id);
                  if (idx !== -1) onTrackSelect(idx);
                }}
              >
                <Play className="w-4 h-4 mr-2" />
                Lire
              </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-sm font-medium">{folder.path.split(/[/\\]/).pop()}</div>
                <div className="text-xs text-muted-foreground">{folder.path}</div>
                <div className="text-xs text-muted-foreground mt-1">{folder.tracks.length} fichier{folder.tracks.length > 1 ? 's' : ''}</div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    );
  }

  // Default Tracks View
  return (
    <div className="h-full flex flex-col animate-in fade-in duration-200">
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-4 space-y-6">
          {/* Header */}
          <PageHeader
            title={title}
            subtitle={`${filteredAndSortedTracks.length} titres • ${formatDuration(totalDuration)}`}
            rightContent={
              showFilters && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30">
                    <SortAsc className="w-4 h-4 text-muted-foreground" />
                    <select
                      value={sortMode}
                      onChange={(e) => setSortMode(e.target.value as SortMode)}
                      className="bg-transparent text-sm text-foreground focus:outline-none cursor-pointer"
                      aria-label="Trier par"
                    >
                      <option value="title">Titre</option>
                      <option value="artist">Artiste</option>
                      <option value="album">Album</option>
                      <option value="duration">Durée</option>
                      {showHistory && <option value="date">Date</option>}
                    </select>
                  </div>

                  <div className="flex rounded-lg bg-muted/30 p-1">
                    <button
                      onClick={() => setDisplayMode("list")}
                      className={cn(
                        "p-2 rounded transition-all duration-200 ease-out active:scale-95",
                        displayMode === "list" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                      )}
                      aria-label="Vue liste"
                    >
                      <List className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDisplayMode("grid")}
                      className={cn(
                        "p-2 rounded transition-all duration-200 ease-out active:scale-95",
                        displayMode === "grid" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                      )}
                      aria-label="Vue grille"
                    >
                      <Grid className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            }
          />

          {/* Actions Bar with Search */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-3 flex-1">
              <Button onClick={() => filteredAndSortedTracks.length > 0 && onTrackSelect(tracks.findIndex(t => t.id === filteredAndSortedTracks[0].id))} className="gap-2">
                <Play className="w-4 h-4 fill-current" />
                Tout lire
              </Button>
              <Button variant="outline" className="gap-2">
                <Shuffle className="w-4 h-4" />
                Aléatoire
              </Button>
              {showHistory && (
                <Button variant="ghost" className="gap-2 text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                  Effacer l'historique
                </Button>
              )}
            </div>
            {/* Search */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Effacer la recherche"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

      {/* Content */}
      {displayMode === "list" ? (
        <div className="bg-card/30 backdrop-blur-sm rounded-xl overflow-hidden border border-border/30 relative">
          <div className="overflow-y-auto max-h-[calc(100vh-400px)]">
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/50">
                <tr className="border-b border-border/30">
                  <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground w-12">#</th>
                  <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground">Titre</th>
                  <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden md:table-cell">Album</th>
                  {showHistory && (
                    <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden lg:table-cell">Écouté</th>
                  )}
                  <th className="px-4 py-3 text-right text-xs font-display uppercase tracking-widest text-muted-foreground">Durée</th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody>
              {filteredAndSortedTracks.map((track: Track, idx: number) => {
                const actualIndex = tracks.findIndex(t => t.id === track.id);
                const isCurrentTrack = currentTrackIndex === actualIndex;
                const tooltipText = `${track.title} - ${track.artist}${track.album ? ` (${track.album})` : ''} - ${formatTime(track.duration)}`;

                return (
                  <tr
                    key={`track-${track.id}-${idx}`}
                    onClick={() => onTrackSelect(actualIndex)}
                    className={cn(
                      "group cursor-pointer transition-all duration-200",
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
                            <span className="text-sm text-muted-foreground group-hover:hidden">{idx + 1}</span>
                            <Play className="w-4 h-4 text-foreground hidden group-hover:block fill-current" />
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <TrackContextMenu
                              track={track}
                              playlists={playlists}
                              isFavorite={isFavorite(track.id)}
                              onPlay={() => onTrackSelect(actualIndex)}
                              onPlayNext={() => {
                                if (onPlayNext) onPlayNext(track);
                              }}
                              onAddToQueue={() => {
                                if (onAddToQueue) onAddToQueue(track);
                              }}
                              onAddToPlaylist={(playlistId) => {
                                if (onAddToPlaylist) onAddToPlaylist(playlistId, track);
                              }}
                              onCreatePlaylist={() => createPlaylist("Nouvelle playlist", [track.id])}
                              onToggleFavorite={() => toggleFavorite(track.id)}
                              onUploadToCloudinary={() => uploadTrack(track)}
                              canUploadToCloudinary={canUploadToCloudinary && !!track.filePath}
                              isUploading={getTrackProgress(track.id)?.status === 'uploading'}
                              onUploadToNexus={() => uploadTrackToNexus(track)}
                              canUploadToNexus={canUploadToNexus && !!track.filePath}
                              isUploadingToNexus={getNexusTrackProgress(track.id)?.status === 'uploading'}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 relative">
                                  <img src={getCoverUrl(track.coverUrl)} alt={track.album} className="w-full h-full object-cover" />
                                  {/* Upload progress overlay */}
                                  {getTrackProgress(track.id) && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                      <div className="text-center">
                                        <Cloud className="w-4 h-4 text-white mb-1 mx-auto" />
                                        <span className="text-[10px] text-white font-medium">
                                          {getTrackProgress(track.id)?.progress || 0}%
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                  {/* Progress bar */}
                                  {getTrackProgress(track.id)?.status === 'uploading' && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-muted/30">
                                      <div 
                                        className="h-full bg-primary transition-all duration-300"
                                        style={{ width: `${getTrackProgress(track.id)?.progress || 0}%` }}
                                      />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                  <p className={cn("text-sm font-medium truncate", isCurrentTrack ? "text-primary" : "text-foreground")}>
                                    {track.title}
                                  </p>
                                    {isUploaded(track.id) && (
                                      <UploadIndicator provider={getUploadedProvider(track.id) || undefined} size="sm" />
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                                </div>
                              </div>
                            </TrackContextMenu>
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
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-sm text-muted-foreground truncate">{track.album}</p>
                    </td>
                    {showHistory && (
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <p className="text-sm text-muted-foreground">
                          {track.lastPlayedAt ? new Date(track.lastPlayedAt).toLocaleDateString() : "-"}
                        </p>
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-muted-foreground font-mono">{formatTime(track.duration)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <TrackContextMenu
                        track={track}
                        playlists={playlists}
                        isFavorite={isFavorite(track.id)}
                        onPlay={() => onTrackSelect(actualIndex)}
                        onPlayNext={() => {
                          if (onPlayNext) onPlayNext(track);
                        }}
                        onAddToQueue={() => {
                          if (onAddToQueue) onAddToQueue(track);
                        }}
                        onAddToPlaylist={(playlistId) => {
                          if (onAddToPlaylist) onAddToPlaylist(playlistId, track);
                        }}
                        onCreatePlaylist={() => createPlaylist("Nouvelle playlist", [track.id])}
                        onToggleFavorite={() => toggleFavorite(track.id)}
                        onUploadToCloudinary={() => uploadTrack(track)}
                        canUploadToCloudinary={canUploadToCloudinary && !!track.filePath}
                        isUploading={getTrackProgress(track.id)?.status === 'uploading'}
                        onUploadToNexus={() => uploadTrackToNexus(track)}
                        canUploadToNexus={canUploadToNexus && !!track.filePath}
                        isUploadingToNexus={getNexusTrackProgress(track.id)?.status === 'uploading'}
                      >
                        <button className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground" aria-label="Plus d'options">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </TrackContextMenu>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredAndSortedTracks.map((track: Track, idx: number) => {
            const actualIndex = tracks.findIndex(t => t.id === track.id);
            const isCurrentTrack = currentTrackIndex === actualIndex;

            return (
              <TrackContextMenu
                key={`track-grid-${track.id}-${idx}`}
                track={track}
                playlists={playlists}
                isFavorite={isFavorite(track.id)}
                onPlay={() => onTrackSelect(actualIndex)}
                onPlayNext={() => {
                  if (onPlayNext) onPlayNext(track);
                }}
                onAddToQueue={() => {
                  if (onAddToQueue) onAddToQueue(track);
                }}
                onAddToPlaylist={(playlistId) => {
                  if (onAddToPlaylist) onAddToPlaylist(playlistId, track);
                }}
                onCreatePlaylist={() => createPlaylist("Nouvelle playlist", [track.id])}
                onToggleFavorite={() => toggleFavorite(track.id)}
                onUploadToCloudinary={() => uploadTrack(track)}
                canUploadToCloudinary={canUploadToCloudinary && !!track.filePath}
                isUploading={getTrackProgress(track.id)?.status === 'uploading'}
                onUploadToBunny={() => uploadTrackToBunny(track)}
                canUploadToBunny={canUploadToBunny && !!track.filePath}
                isUploadingToBunny={getBunnyTrackProgress(track.id)?.status === 'uploading'}
                onUploadToNexus={() => uploadTrackToNexus(track)}
                canUploadToNexus={canUploadToNexus && !!track.filePath}
                isUploadingToNexus={getNexusTrackProgress(track.id)?.status === 'uploading'}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onTrackSelect(actualIndex)}
                      className={cn(
                        "group p-4 rounded-xl text-left transition-all duration-200 hover:bg-card/50 w-full",
                        isCurrentTrack && "ring-2 ring-primary",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                      )}
                    >
                      <div className="aspect-square rounded-lg overflow-hidden mb-3 relative shadow-lg">
                        <img src={getCoverUrl(track.coverUrl)} alt={track.album} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        {/* Upload progress overlay */}
                        {getTrackProgress(track.id) && (
                          <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
                            <div className="text-center">
                              <Cloud className="w-6 h-6 text-white mb-2 mx-auto" />
                              <span className="text-xs text-white font-medium">
                                {getTrackProgress(track.id)?.progress || 0}%
                              </span>
                            </div>
                          </div>
                        )}
                        {/* Progress bar */}
                        {getTrackProgress(track.id)?.status === 'uploading' && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/30 z-10">
                            <div 
                              className="h-full bg-primary transition-all duration-300"
                              style={{ width: `${getTrackProgress(track.id)?.progress || 0}%` }}
                            />
                          </div>
                        )}
                        {/* Play button overlay */}
                        {!getTrackProgress(track.id) && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out">
                            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg">
                              <Play className="w-6 h-6 text-primary-foreground fill-current ml-0.5" />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                      <p className={cn("text-sm font-medium truncate", isCurrentTrack ? "text-primary" : "text-foreground")}>
                        {track.title}
                      </p>
                        {isUploaded(track.id) && (
                          <UploadIndicator provider={getUploadedProvider(track.id) || undefined} size="sm" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                    </button>
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
    </div>
  );
});

LibraryView.displayName = 'LibraryView';
