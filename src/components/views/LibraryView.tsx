import { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
} from "lucide-react";
import { Track } from "@/types/music";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useNexusUpload } from "@/hooks/useNexusUpload";
import { useCloudSync } from "@/hooks/useCloudSync";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useFavorites } from "@/hooks/useFavorites";

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

export const LibraryView = ({
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
}: LibraryViewProps) => {
  const [displayMode, setDisplayMode] = useState<DisplayMode>("list");
  const [sortMode, setSortMode] = useState<SortMode>("title");
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const currentTrackRef = useRef<HTMLTableRowElement>(null);
  
  // Cloudinary upload
  const { uploadTrack, getTrackProgress } = useCloudinaryUpload();
  // Nexus/Bunny upload (Pro only)
  const { uploadTrack: uploadTrackToNexus, getTrackProgress: getNexusTrackProgress } = useNexusUpload();
  const { cloudinaryConfigured, nexusIsPro, nexusAuthenticated } = useCloudSync();
  const playlistsResult = usePlaylists();
  const { isFavorite, toggleFavorite } = useFavorites();
  
  // Ensure playlists is always an array
  const playlists = playlistsResult?.playlists ?? [];
  const createPlaylist = playlistsResult?.createPlaylist ?? (async () => null);
  
  const canUploadToCloudinary = cloudinaryConfigured || nexusIsPro;
  const canUploadToNexus = nexusIsPro && nexusAuthenticated;

  const [searchQuery, setSearchQuery] = useState("");

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
    let filtered = uniqueTracks;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = uniqueTracks.filter(track =>
        track.title.toLowerCase().includes(query) ||
        track.artist.toLowerCase().includes(query) ||
        track.album.toLowerCase().includes(query)
      );
    }
    
    // Apply sorting
    return [...filtered].sort((a, b) => {
      switch (sortMode) {
        case "title":
          return a.title.localeCompare(b.title);
        case "artist":
          return a.artist.localeCompare(b.artist);
        case "album":
          return a.album.localeCompare(b.album);
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

  // Render empty state
  if (tracks.length === 0) {
    return (
      <div className="p-6 h-full flex flex-col items-center justify-center text-center animate-in fade-in duration-300">
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
      <div className="p-6 space-y-6 animate-in fade-in slide-in-from-right duration-300">
        <button onClick={handleBack} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
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
                </tr>
              </thead>
              <tbody>
              {album.tracks.map((track, idx) => {
                const actualIndex = tracks.findIndex(t => t.id === track.id);
                const isCurrentTrack = currentTrackIndex === actualIndex;

                return (
                  <tr
                    key={track.id}
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
                      <p className={cn("text-sm font-medium", isCurrentTrack ? "text-primary" : "text-foreground")}>
                        {track.title}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-muted-foreground font-mono">{formatTime(track.duration)}</span>
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

  // Albums Grid View
  if (viewMode === "albums" && !selectedAlbum) {
    return (
      <div className="p-6 space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold mb-1">{title}</h1>
            <p className="text-muted-foreground">{albums.length} albums • {tracks.length} titres</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {albums.map((album) => (
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
              <div className="group relative">
                <button
                  onClick={() => setSelectedAlbum(`${album.name}-${album.artist}`)}
                  className="w-full p-4 rounded-xl text-left transition-all duration-200 hover:bg-card/50"
                >
                  <div className="aspect-square rounded-lg overflow-hidden mb-3 relative shadow-lg">
                    <img src={getCoverUrl(album.coverUrl)} alt={album.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
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
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background text-muted-foreground hover:text-foreground"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </AlbumContextMenu>
          ))}
        </div>
      </div>
    );
  }

  // Artists Grid View
  if (viewMode === "artists") {
    return (
      <div className="p-6 space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold mb-1">{title}</h1>
            <p className="text-muted-foreground">{artists.length} artistes</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {artists.map((artist) => {
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
                <div className="group relative">
                  <button
                    onClick={() => {
                      const firstTrack = artist.tracks[0];
                      const idx = tracks.findIndex(t => t.id === firstTrack.id);
                      if (idx !== -1) onTrackSelect(idx);
                    }}
                    className="w-full p-4 rounded-xl text-left transition-all duration-200 hover:bg-card/50"
                  >
                    <div className="aspect-square rounded-full overflow-hidden mb-3 relative shadow-lg mx-auto w-32">
                      {coverUrl ? (
                        <img src={getCoverUrl(coverUrl)} alt={artist.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
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
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background text-muted-foreground hover:text-foreground"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </ArtistContextMenu>
            );
          })}
        </div>
      </div>
    );
  }

  // Folders View
  if (viewMode === "folders") {
    return (
      <div className="p-6 space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold mb-1">{title}</h1>
            <p className="text-muted-foreground">{folders.length} dossiers • {tracks.length} fichiers</p>
          </div>
        </div>

        <div className="space-y-2">
          {folders.map((folder) => (
            <div
              key={folder.path}
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
          ))}
        </div>
      </div>
    );
  }

  // Default Tracks View
  return (
    <div className="h-full flex flex-col animate-in fade-in duration-300">
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
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
                        "p-2 rounded transition-colors",
                        displayMode === "list" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <List className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDisplayMode("grid")}
                      className={cn(
                        "p-2 rounded transition-colors",
                        displayMode === "grid" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                      )}
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
              {filteredAndSortedTracks.map((track, idx) => {
                const actualIndex = tracks.findIndex(t => t.id === track.id);
                const isCurrentTrack = currentTrackIndex === actualIndex;

                return (
                  <tr
                    key={track.id}
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
                          <div className="min-w-0">
                            <p className={cn("text-sm font-medium truncate", isCurrentTrack ? "text-primary" : "text-foreground")}>
                              {track.title}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                          </div>
                        </div>
                      </TrackContextMenu>
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
                        <button className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
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
          {filteredAndSortedTracks.map((track) => {
            const actualIndex = tracks.findIndex(t => t.id === track.id);
            const isCurrentTrack = currentTrackIndex === actualIndex;

            return (
              <TrackContextMenu
                key={track.id}
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
              >
                <button
                  onClick={() => onTrackSelect(actualIndex)}
                  className={cn(
                    "group p-4 rounded-xl text-left transition-all duration-200 hover:bg-card/50 w-full",
                    isCurrentTrack && "ring-2 ring-primary"
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
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg">
                          <Play className="w-6 h-6 text-primary-foreground fill-current ml-0.5" />
                        </div>
                      </div>
                    )}
                  </div>
                  <p className={cn("text-sm font-medium truncate", isCurrentTrack ? "text-primary" : "text-foreground")}>
                    {track.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                </button>
              </TrackContextMenu>
            );
          })}
        </div>
      )}
        </div>
      </div>
    </div>
  );
};
