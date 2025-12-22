import { useState, useMemo, useEffect, useRef, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Play, 
  Grid, 
  List, 
  Music, 
  Disc3, 
  User, 
  FolderOpen, 
  Clock,
  Heart,
  MoreHorizontal,
  Shuffle,
  Cloud,
  ListMusic,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Library,
  Filter,
} from "lucide-react";
import { Track } from "@/types/music";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { TrackListView } from "@/components/TrackListView";
import { TrackGridView } from "@/components/TrackGridView";
import { AlbumContextMenu } from "@/components/AlbumContextMenu";
import { ArtistContextMenu } from "@/components/ArtistContextMenu";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";
import { useBunnyUpload } from "@/hooks/useBunnyUpload";
import { useNexusUpload } from "@/hooks/useNexusUpload";
import { useUploadedStatus } from "@/hooks/useUploadedStatus";
import { useCloudSync } from "@/hooks/useCloudSync";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useFavorites } from "@/hooks/useFavorites";
import { UploadIndicator } from "@/components/UploadIndicator";
import { AlbumGridSkeleton, TrackGridSkeleton, TrackTableSkeleton } from "@/components/ui/skeletons";
import { PageContainer, PageHero, EmptyState, GlassCard } from "@/components/ui/PageLayout";
import { SearchBar, FilterChip, ViewToggle, Toolbar } from "@/components/ui/SearchFilter";
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

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

// Memoized Album Card Component
const AlbumCard = memo(({ 
  album, 
  onSelect, 
  onPlay,
  delay = 0
}: { 
  album: { name: string; artist: string; coverUrl: string; tracks: Track[]; year?: number };
  onSelect: () => void;
  onPlay: () => void;
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay, duration: 0.3 }}
    whileHover={{ scale: 1.03 }}
    whileTap={{ scale: 0.98 }}
    className="group relative cursor-pointer"
    onClick={onSelect}
  >
    <div className="aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 to-secondary/20 shadow-lg group-hover:shadow-xl transition-all duration-300">
      {album.coverUrl ? (
        <img
          src={getCoverUrl(album.coverUrl)}
          alt={album.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Disc3 className="w-12 h-12 text-primary/40" />
        </div>
      )}
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300" />
      
      {/* Play button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        whileHover={{ scale: 1.1 }}
        onClick={(e) => {
          e.stopPropagation();
          onPlay();
        }}
        className="absolute bottom-3 right-3 w-12 h-12 rounded-full bg-primary shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300"
      >
        <Play className="w-5 h-5 text-primary-foreground fill-current ml-0.5" />
      </motion.button>
    </div>
    
    <div className="mt-3 px-1">
      <h3 className="font-medium text-sm truncate text-foreground group-hover:text-primary transition-colors">
        {album.name}
      </h3>
      <p className="text-xs text-muted-foreground truncate mt-0.5">
        {album.artist} • {album.tracks.length} titres
      </p>
    </div>
  </motion.div>
));
AlbumCard.displayName = "AlbumCard";

// Memoized Artist Card Component
const ArtistCard = memo(({ 
  artist, 
  onSelect, 
  onPlay,
  delay = 0
}: { 
  artist: { name: string; tracks: Track[]; albums: Set<string> };
  onSelect: () => void;
  onPlay: () => void;
  delay?: number;
}) => {
  const coverUrl = artist.tracks[0]?.coverUrl;
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.3 }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      className="group relative cursor-pointer"
      onClick={onSelect}
    >
      <div className="aspect-square rounded-full overflow-hidden bg-gradient-to-br from-primary/30 to-accent/30 shadow-lg group-hover:shadow-xl transition-all duration-300 ring-4 ring-transparent group-hover:ring-primary/20">
        {coverUrl ? (
          <img
            src={getCoverUrl(coverUrl)}
            alt={artist.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="w-12 h-12 text-primary/40" />
          </div>
        )}
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <motion.button
            whileHover={{ scale: 1.1 }}
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            className="w-14 h-14 rounded-full bg-primary shadow-lg flex items-center justify-center"
          >
            <Play className="w-6 h-6 text-primary-foreground fill-current ml-0.5" />
          </motion.button>
        </div>
      </div>
      
      <div className="mt-3 text-center">
        <h3 className="font-medium text-sm truncate text-foreground group-hover:text-primary transition-colors">
          {artist.name}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {artist.albums.size} album{artist.albums.size > 1 ? "s" : ""} • {artist.tracks.length} titres
        </p>
      </div>
    </motion.div>
  );
});
ArtistCard.displayName = "ArtistCard";

// Stat Card Component
const StatCard = memo(({ icon: Icon, label, value, color }: { 
  icon: typeof Music; 
  label: string; 
  value: string | number;
  color: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex items-center gap-3 p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-border/30"
  >
    <div className={cn("p-2.5 rounded-lg", color)}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-2xl font-bold font-display">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  </motion.div>
));
StatCard.displayName = "StatCard";

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
  
  // Upload hooks
  const { uploadTrack, uploadAlbum, getTrackProgress } = useCloudinaryUpload();
  const { uploadTrack: uploadTrackToBunny, uploadAlbum: uploadAlbumToBunny, getTrackProgress: getBunnyTrackProgress } = useBunnyUpload();
  const { uploadTrack: uploadTrackToNexus, uploadAlbum: uploadAlbumToNexus, getTrackProgress: getNexusTrackProgress } = useNexusUpload();
  const { cloudinaryConfigured, nexusIsPro, nexusAuthenticated } = useCloudSync();
  const playlistsResult = usePlaylists();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isUploaded, getUploadedProvider } = useUploadedStatus();
  
  const playlists = playlistsResult?.playlists ?? [];
  const createPlaylist = playlistsResult?.createPlaylist ?? (async () => null);
  
  const canUploadToCloudinary = cloudinaryConfigured && !nexusIsPro;
  const canUploadToBunny = nexusIsPro && nexusAuthenticated;
  const canUploadToNexus = nexusIsPro && nexusAuthenticated;

  const [searchQuery, setSearchQuery] = useState("");

  // YouTube playlists state
  const [youtubePlaylists, setYoutubePlaylists] = useState<Array<{ id: string; title: string; videoCount: number; tracks: Track[] }>>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);

  // Utility function to remove duplicates
  const getUniqueTracks = useCallback((trackList: Track[]): Track[] => {
    const seen = new Set<string>();
    return trackList.filter(track => {
      if (seen.has(track.id)) return false;
      seen.add(track.id);
      return true;
    });
  }, []);

  const filteredAndSortedTracks = useMemo(() => {
    const uniqueTracks = getUniqueTracks(tracks);
    
    if (searchQuery.trim()) {
      try {
        const { searchAndSortTracks } = require('@/lib/search-utils');
        return searchAndSortTracks(uniqueTracks, searchQuery, sortMode);
      } catch {
        const query = searchQuery.toLowerCase();
        const filtered = uniqueTracks.filter(track =>
          track.title.toLowerCase().includes(query) ||
          track.artist.toLowerCase().includes(query) ||
          track.album.toLowerCase().includes(query)
        );
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
    
    const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
    return [...uniqueTracks].sort((a, b) => {
      switch (sortMode) {
        case "title": return collator.compare(a.title, b.title);
        case "artist": return collator.compare(a.artist, b.artist);
        case "album": return collator.compare(a.album, b.album);
        case "duration": return b.duration - a.duration;
        case "date": return (b.addedAt || "").localeCompare(a.addedAt || "");
        default: return 0;
      }
    });
  }, [tracks, sortMode, searchQuery, getUniqueTracks]);

  const albums = useMemo(() => groupByAlbum(tracks), [tracks]);
  const artists = useMemo(() => groupByArtist(tracks), [tracks]);
  const folders = useMemo(() => groupByFolder(tracks), [tracks]);

  // Filtered and sorted albums
  const filteredAndSortedAlbums = useMemo(() => {
    let filtered = albums;

    if (albumsSearchQuery.trim()) {
      const query = albumsSearchQuery.toLowerCase();
      filtered = filtered.filter(album =>
        album.name.toLowerCase().includes(query) ||
        album.artist.toLowerCase().includes(query)
      );
    }

    if (albumsFilterArtist) {
      filtered = filtered.filter(album => album.artist === albumsFilterArtist);
    }

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (albumsSortBy) {
        case "name": comparison = a.name.localeCompare(b.name); break;
        case "artist": comparison = a.artist.localeCompare(b.artist); break;
        case "year": comparison = (a.year || 0) - (b.year || 0); break;
        case "tracks": comparison = a.tracks.length - b.tracks.length; break;
      }
      return albumsSortOrder === "asc" ? comparison : -comparison;
    });
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

    if (artistsSearchQuery.trim()) {
      const query = artistsSearchQuery.toLowerCase();
      filtered = filtered.filter(artist => artist.name.toLowerCase().includes(query));
    }

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (artistsSortBy) {
        case "name": comparison = a.name.localeCompare(b.name); break;
        case "albums": comparison = a.albums.size - b.albums.size; break;
        case "tracks": comparison = a.tracks.length - b.tracks.length; break;
      }
      return artistsSortOrder === "asc" ? comparison : -comparison;
    });
  }, [artists, artistsSearchQuery, artistsSortBy, artistsSortOrder]);

  const totalDuration = tracks.reduce((acc, track) => acc + track.duration, 0);

  // Handle initial album selection
  useEffect(() => {
    if (initialSelectedAlbum && viewMode === "albums") {
      setSelectedAlbum(initialSelectedAlbum);
    }
  }, [initialSelectedAlbum, viewMode]);

  // Scroll to current track
  useEffect(() => {
    if (selectedAlbum && currentTrackRef.current) {
      setTimeout(() => {
        currentTrackRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [selectedAlbum, currentTrackIndex]);

  const handleBack = () => {
    setSelectedAlbum(null);
    setSelectedArtist(null);
    setSelectedFolder(null);
  };

  const handlePlayAll = useCallback(() => {
    if (filteredAndSortedTracks.length > 0) {
      const idx = tracks.findIndex(t => t.id === filteredAndSortedTracks[0].id);
      if (idx !== -1) onTrackSelect(idx);
    }
  }, [filteredAndSortedTracks, tracks, onTrackSelect]);

  const handleShuffleAll = useCallback(() => {
    const shuffled = [...filteredAndSortedTracks].sort(() => Math.random() - 0.5);
    if (shuffled.length > 0) {
      const idx = tracks.findIndex(t => t.id === shuffled[0].id);
      if (idx !== -1) onTrackSelect(idx);
    }
  }, [filteredAndSortedTracks, tracks, onTrackSelect]);

  // Loading state
  if (loading) {
    return (
      <PageContainer className="animate-pulse">
        <div className="h-48 bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-muted/30 rounded-xl" />
          ))}
        </div>
        {viewMode === "albums" && <AlbumGridSkeleton count={12} />}
        {viewMode === "tracks" && displayMode === "grid" && <TrackGridSkeleton count={20} />}
        {viewMode === "tracks" && displayMode === "list" && <TrackTableSkeleton count={15} />}
      </PageContainer>
    );
  }

  // Empty state
  if (tracks.length === 0) {
    return (
      <PageContainer>
        <EmptyState
          icon={Library}
          title={emptyMessage}
          description={
            viewMode === "tracks" ? "Ajoutez des fichiers audio pour voir votre bibliothèque." :
            viewMode === "albums" ? "Les albums apparaîtront ici une fois la musique ajoutée." :
            viewMode === "artists" ? "Les artistes apparaîtront ici une fois la musique ajoutée." :
            "Les dossiers scannés apparaîtront ici."
          }
        />
      </PageContainer>
    );
  }

  // Album Detail View
  if (selectedAlbum) {
    const album = albums.find(a => `${a.name}-${a.artist}` === selectedAlbum);
    if (!album) return null;

    return (
      <PageContainer>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-6"
        >
          {/* Back button */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={handleBack}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ChevronRight className="w-4 h-4 rotate-180 transition-transform group-hover:-translate-x-1" />
            Retour aux albums
          </motion.button>

          {/* Album Header */}
          <div className="flex flex-col md:flex-row gap-6">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-48 h-48 md:w-56 md:h-56 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 mx-auto md:mx-0"
            >
              <img src={getCoverUrl(album.coverUrl)} alt={album.name} className="w-full h-full object-cover" />
            </motion.div>
            
            <div className="flex flex-col justify-end text-center md:text-left">
              <Badge variant="secondary" className="w-fit mx-auto md:mx-0 mb-2">Album</Badge>
              <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">{album.name}</h1>
              <p className="text-lg text-muted-foreground mb-4">{album.artist}</p>
              
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-sm text-muted-foreground mb-4">
                {album.year && <Badge variant="outline">{album.year}</Badge>}
                <span className="flex items-center gap-1">
                  <Music className="w-4 h-4" />
                  {album.tracks.length} titres
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDuration(album.tracks.reduce((a, t) => a + t.duration, 0))}
                </span>
              </div>
              
              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <Button 
                  onClick={() => {
                    const firstTrack = album.tracks[0];
                    const idx = tracks.findIndex(t => t.id === firstTrack.id);
                    if (idx !== -1) onTrackSelect(idx);
                  }} 
                  className="gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Lecture
                </Button>
                <Button 
                  variant="outline" 
                  className="gap-2" 
                  onClick={() => {
                    const shuffled = [...album.tracks].sort(() => Math.random() - 0.5);
                    const idx = tracks.findIndex(t => t.id === shuffled[0].id);
                    if (idx !== -1) onTrackSelect(idx);
                  }}
                >
                  <Shuffle className="w-4 h-4" />
                  Aléatoire
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => album.tracks.forEach(track => toggleFavorite(track.id))}
                >
                  <Heart className={cn("w-4 h-4", album.tracks.some(t => isFavorite(t.id)) && "fill-red-500 text-red-500")} />
                </Button>
              </div>
            </div>
          </div>

          {/* Track list */}
          <GlassCard className="overflow-hidden">
            <ScrollArea className="max-h-[calc(100vh-450px)]">
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur-md">
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

                    return (
                      <motion.tr
                        key={`album-track-${track.id}-${idx}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
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
                                <div className="w-1 h-4 bg-primary rounded-full animate-pulse" />
                                <div className="w-1 h-4 bg-primary rounded-full animate-pulse" style={{ animationDelay: "0.1s" }} />
                                <div className="w-1 h-4 bg-primary rounded-full animate-pulse" style={{ animationDelay: "0.2s" }} />
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
                          <div className="flex items-center gap-2">
                            <p className={cn("text-sm font-medium", isCurrentTrack ? "text-primary" : "text-foreground")}>
                              {track.title}
                            </p>
                            {isUploaded(track.id) && (
                              <UploadIndicator provider={getUploadedProvider(track.id) || undefined} size="sm" />
                            )}
                          </div>
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
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </TrackContextMenu>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>
          </GlassCard>
        </motion.div>
      </PageContainer>
    );
  }

  // Artist Detail View
  if (viewMode === "artists" && selectedArtist) {
    const artist = artists.find(a => a.name === selectedArtist);
    if (!artist) return null;

    const artistAlbums = (() => {
      const albumsMap = new Map<string, { name: string; coverUrl: string; tracks: Track[] }>();
      artist.tracks.forEach(track => {
        if (!albumsMap.has(track.album)) {
          albumsMap.set(track.album, { name: track.album, coverUrl: track.coverUrl, tracks: [] });
        }
        albumsMap.get(track.album)!.tracks.push(track);
      });
      return Array.from(albumsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    })();

    return (
      <PageContainer>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-8"
        >
          {/* Back button */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setSelectedArtist(null)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ChevronRight className="w-4 h-4 rotate-180 transition-transform group-hover:-translate-x-1" />
            Retour aux artistes
          </motion.button>

          {/* Artist Header */}
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-end">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-48 h-48 rounded-full overflow-hidden shadow-2xl bg-gradient-to-br from-primary/30 to-accent/30 ring-4 ring-primary/20"
            >
              {artist.tracks[0]?.coverUrl ? (
                <img src={getCoverUrl(artist.tracks[0].coverUrl)} alt={artist.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-20 h-20 text-primary/40" />
                </div>
              )}
            </motion.div>
            
            <div className="text-center md:text-left">
              <Badge variant="secondary" className="mb-2">Artiste</Badge>
              <h1 className="font-display text-4xl font-bold mb-4">{artist.name}</h1>
              
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-muted-foreground mb-4">
                <span className="flex items-center gap-1">
                  <Disc3 className="w-4 h-4" />
                  {artist.albums.size} album{artist.albums.size > 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1">
                  <Music className="w-4 h-4" />
                  {artist.tracks.length} titres
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDuration(artist.tracks.reduce((a, t) => a + t.duration, 0))}
                </span>
              </div>
              
              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
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
              </div>
            </div>
          </div>

          {/* Albums Section */}
          {artistAlbums.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Disc3 className="w-5 h-5 text-primary" />
                Albums
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {artistAlbums.map((album, idx) => (
                  <motion.div
                    key={album.name}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ scale: 1.03 }}
                    onClick={() => {
                      setSelectedArtist(null);
                      setSelectedAlbum(`${album.name}-${artist.name}`);
                    }}
                    className="group cursor-pointer"
                  >
                    <div className="aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 to-secondary/20 shadow-md group-hover:shadow-xl transition-all">
                      {album.coverUrl ? (
                        <img src={getCoverUrl(album.coverUrl)} alt={album.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Disc3 className="w-10 h-10 text-primary/40" />
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-medium truncate">{album.name}</p>
                    <p className="text-xs text-muted-foreground">{album.tracks.length} titres</p>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* All Tracks */}
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Music className="w-5 h-5 text-primary" />
              Tous les titres
            </h2>
            <GlassCard>
              <TrackListView
                tracks={artist.tracks}
                currentTrackIndex={currentTrackIndex}
                isPlaying={isPlaying}
                onTrackSelect={(idx) => {
                  const track = artist.tracks[idx];
                  const realIdx = tracks.findIndex(t => t.id === track.id);
                  if (realIdx !== -1) onTrackSelect(realIdx);
                }}
                onAddToPlaylist={onAddToPlaylist}
                createPlaylist={createPlaylist}
                uploadTrack={uploadTrack}
                getTrackProgress={(id) => getTrackProgress(id) ?? null}
                canUploadToCloudinary={canUploadToCloudinary}
                uploadTrackToNexus={uploadTrackToNexus}
                getNexusTrackProgress={(id) => getNexusTrackProgress(id) ?? null}
                canUploadToNexus={canUploadToNexus}
                isUploaded={isUploaded}
                getUploadedProvider={getUploadedProvider}
              />
            </GlassCard>
          </section>
        </motion.div>
      </PageContainer>
    );
  }

  // Albums View
  if (viewMode === "albums") {
    return (
      <PageContainer>
        {/* Hero Section */}
        <PageHero
          title={title}
          subtitle={`${filteredAndSortedAlbums.length} album${filteredAndSortedAlbums.length > 1 ? "s" : ""} • ${tracks.length} titres`}
          icon={Disc3}
          gradient="from-indigo-500/20 via-purple-500/10 to-pink-500/20"
          actions={
            <div className="flex items-center gap-2">
              <Button onClick={handlePlayAll} size="sm" className="gap-2">
                <Play className="w-4 h-4 fill-current" />
                Tout lire
              </Button>
              <Button onClick={handleShuffleAll} variant="outline" size="sm" className="gap-2">
                <Shuffle className="w-4 h-4" />
              </Button>
            </div>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Disc3} label="Albums" value={albums.length} color="bg-purple-500/20 text-purple-400" />
          <StatCard icon={User} label="Artistes" value={artists.length} color="bg-blue-500/20 text-blue-400" />
          <StatCard icon={Music} label="Titres" value={tracks.length} color="bg-green-500/20 text-green-400" />
          <StatCard icon={Clock} label="Durée totale" value={formatDuration(totalDuration)} color="bg-orange-500/20 text-orange-400" />
        </div>

        {/* Toolbar */}
        <Toolbar className="mb-6">
          <SearchBar
            value={albumsSearchQuery}
            onChange={setAlbumsSearchQuery}
            placeholder="Rechercher un album..."
          />
          
          <Select value={albumsFilterArtist || "__all__"} onValueChange={(v) => setAlbumsFilterArtist(v === "__all__" ? null : v)}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Artiste" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tous les artistes</SelectItem>
              {uniqueAlbumArtists.map((artist) => (
                <SelectItem key={artist} value={artist}>{artist}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={albumsSortBy} onValueChange={(v) => setAlbumsSortBy(v as typeof albumsSortBy)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Trier par" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nom</SelectItem>
              <SelectItem value="artist">Artiste</SelectItem>
              <SelectItem value="year">Année</SelectItem>
              <SelectItem value="tracks">Titres</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setAlbumsSortOrder(o => o === "asc" ? "desc" : "asc")}
          >
            {albumsSortOrder === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>

          <ViewToggle value={albumsViewMode} onChange={setAlbumsViewMode} />
        </Toolbar>

        {/* Active Filters */}
        {(albumsSearchQuery || albumsFilterArtist) && (
          <div className="flex flex-wrap gap-2 mb-6">
            {albumsSearchQuery && (
              <FilterChip onRemove={() => setAlbumsSearchQuery("")}>
                Recherche: {albumsSearchQuery}
              </FilterChip>
            )}
            {albumsFilterArtist && (
              <FilterChip onRemove={() => setAlbumsFilterArtist(null)}>
                Artiste: {albumsFilterArtist}
              </FilterChip>
            )}
          </div>
        )}

        {/* Albums Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {filteredAndSortedAlbums.map((album, idx) => (
              <AlbumCard
                key={`${album.name}-${album.artist}`}
                album={album}
                delay={idx * 0.02}
                onSelect={() => setSelectedAlbum(`${album.name}-${album.artist}`)}
                onPlay={() => {
                  const firstTrack = album.tracks[0];
                  const idx = tracks.findIndex(t => t.id === firstTrack.id);
                  if (idx !== -1) onTrackSelect(idx);
                }}
              />
            ))}
          </AnimatePresence>
        </motion.div>

        {filteredAndSortedAlbums.length === 0 && (
          <EmptyState
            icon={Disc3}
            title="Aucun album trouvé"
            description="Essayez de modifier vos filtres de recherche"
          />
        )}
      </PageContainer>
    );
  }

  // Artists View
  if (viewMode === "artists") {
    return (
      <PageContainer>
        <PageHero
          title={title}
          subtitle={`${filteredAndSortedArtists.length} artiste${filteredAndSortedArtists.length > 1 ? "s" : ""}`}
          icon={User}
          gradient="from-blue-500/20 via-cyan-500/10 to-teal-500/20"
          actions={
            <div className="flex items-center gap-2">
              <Button onClick={handlePlayAll} size="sm" className="gap-2">
                <Play className="w-4 h-4 fill-current" />
                Tout lire
              </Button>
              <Button onClick={handleShuffleAll} variant="outline" size="sm" className="gap-2">
                <Shuffle className="w-4 h-4" />
              </Button>
            </div>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={User} label="Artistes" value={artists.length} color="bg-blue-500/20 text-blue-400" />
          <StatCard icon={Disc3} label="Albums" value={albums.length} color="bg-purple-500/20 text-purple-400" />
          <StatCard icon={Music} label="Titres" value={tracks.length} color="bg-green-500/20 text-green-400" />
          <StatCard icon={Clock} label="Durée totale" value={formatDuration(totalDuration)} color="bg-orange-500/20 text-orange-400" />
        </div>

        {/* Toolbar */}
        <Toolbar className="mb-6">
          <SearchBar
            value={artistsSearchQuery}
            onChange={setArtistsSearchQuery}
            placeholder="Rechercher un artiste..."
          />

          <Select value={artistsSortBy} onValueChange={(v) => setArtistsSortBy(v as typeof artistsSortBy)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Trier par" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nom</SelectItem>
              <SelectItem value="albums">Albums</SelectItem>
              <SelectItem value="tracks">Titres</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setArtistsSortOrder(o => o === "asc" ? "desc" : "asc")}
          >
            {artistsSortOrder === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>

          <ViewToggle value={artistsViewMode} onChange={setArtistsViewMode} />
        </Toolbar>

        {/* Artists Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-6"
        >
          <AnimatePresence mode="popLayout">
            {filteredAndSortedArtists.map((artist, idx) => (
              <ArtistCard
                key={artist.name}
                artist={artist}
                delay={idx * 0.02}
                onSelect={() => setSelectedArtist(artist.name)}
                onPlay={() => {
                  const firstTrack = artist.tracks[0];
                  const idx = tracks.findIndex(t => t.id === firstTrack.id);
                  if (idx !== -1) onTrackSelect(idx);
                }}
              />
            ))}
          </AnimatePresence>
        </motion.div>

        {filteredAndSortedArtists.length === 0 && (
          <EmptyState
            icon={User}
            title="Aucun artiste trouvé"
            description="Essayez de modifier vos filtres de recherche"
          />
        )}
      </PageContainer>
    );
  }

  // Folders View
  if (viewMode === "folders") {
    return (
      <PageContainer>
        <PageHero
          title={title}
          subtitle={`${folders.length} dossier${folders.length > 1 ? "s" : ""} • ${tracks.length} titres`}
          icon={FolderOpen}
          gradient="from-amber-500/20 via-orange-500/10 to-red-500/20"
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-4"
        >
          {folders.map((folder, idx) => (
            <motion.div
              key={folder.path}
              variants={itemVariants}
              transition={{ delay: idx * 0.05 }}
            >
              <GlassCard
                className={cn(
                  "cursor-pointer transition-all hover:ring-2 hover:ring-primary/30",
                  selectedFolder === folder.path && "ring-2 ring-primary"
                )}
                onClick={() => setSelectedFolder(selectedFolder === folder.path ? null : folder.path)}
              >
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/20">
                      <FolderOpen className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="font-medium">{folder.path.split(/[/\\]/).pop()}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-md">{folder.path}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{folder.tracks.length} titres</Badge>
                    <ChevronRight className={cn(
                      "w-5 h-5 text-muted-foreground transition-transform",
                      selectedFolder === folder.path && "rotate-90"
                    )} />
                  </div>
                </div>

                <AnimatePresence>
                  {selectedFolder === folder.path && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border/30 overflow-hidden"
                    >
                      <div className="p-4">
                        <TrackListView
                          tracks={folder.tracks}
                          currentTrackIndex={currentTrackIndex}
                          isPlaying={isPlaying}
                          onTrackSelect={(idx) => {
                            const track = folder.tracks[idx];
                            const realIdx = tracks.findIndex(t => t.id === track.id);
                            if (realIdx !== -1) onTrackSelect(realIdx);
                          }}
                          onAddToPlaylist={onAddToPlaylist}
                          createPlaylist={createPlaylist}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>
      </PageContainer>
    );
  }

  // Tracks View (default)
  return (
    <PageContainer>
      <PageHero
        title={title}
        subtitle={`${filteredAndSortedTracks.length} titre${filteredAndSortedTracks.length > 1 ? "s" : ""} • ${formatDuration(totalDuration)}`}
        icon={Music}
        gradient="from-emerald-500/20 via-green-500/10 to-teal-500/20"
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={handlePlayAll} size="sm" className="gap-2">
              <Play className="w-4 h-4 fill-current" />
              Tout lire
            </Button>
            <Button onClick={handleShuffleAll} variant="outline" size="sm" className="gap-2">
              <Shuffle className="w-4 h-4" />
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Music} label="Titres" value={tracks.length} color="bg-green-500/20 text-green-400" />
        <StatCard icon={Disc3} label="Albums" value={albums.length} color="bg-purple-500/20 text-purple-400" />
        <StatCard icon={User} label="Artistes" value={artists.length} color="bg-blue-500/20 text-blue-400" />
        <StatCard icon={Clock} label="Durée totale" value={formatDuration(totalDuration)} color="bg-orange-500/20 text-orange-400" />
      </div>

      {/* Toolbar */}
      <Toolbar className="mb-6">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Rechercher un titre, artiste ou album..."
        />

        <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Trier par" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="title">Titre</SelectItem>
            <SelectItem value="artist">Artiste</SelectItem>
            <SelectItem value="album">Album</SelectItem>
            <SelectItem value="duration">Durée</SelectItem>
            <SelectItem value="date">Date d'ajout</SelectItem>
          </SelectContent>
        </Select>

        <ViewToggle value={displayMode} onChange={setDisplayMode} />
      </Toolbar>

      {/* Active Filters */}
      {searchQuery && (
        <div className="flex flex-wrap gap-2 mb-6">
          <FilterChip onRemove={() => setSearchQuery("")}>
            Recherche: {searchQuery}
          </FilterChip>
        </div>
      )}

      {/* Track List/Grid */}
      <GlassCard className="overflow-hidden">
        {displayMode === "grid" ? (
          <TrackGridView
            tracks={filteredAndSortedTracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={(idx) => {
              const track = filteredAndSortedTracks[idx];
              const realIdx = tracks.findIndex(t => t.id === track.id);
              if (realIdx !== -1) onTrackSelect(realIdx);
            }}
            onAddToPlaylist={onAddToPlaylist}
            createPlaylist={createPlaylist}
          />
        ) : (
          <TrackListView
            tracks={filteredAndSortedTracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={(idx) => {
              const track = filteredAndSortedTracks[idx];
              const realIdx = tracks.findIndex(t => t.id === track.id);
              if (realIdx !== -1) onTrackSelect(realIdx);
            }}
            onAddToPlaylist={onAddToPlaylist}
            createPlaylist={createPlaylist}
            uploadTrack={uploadTrack}
            getTrackProgress={(id) => getTrackProgress(id) ?? null}
            canUploadToCloudinary={canUploadToCloudinary}
            uploadTrackToNexus={uploadTrackToNexus}
            getNexusTrackProgress={(id) => getNexusTrackProgress(id) ?? null}
            canUploadToNexus={canUploadToNexus}
            isUploaded={isUploaded}
            getUploadedProvider={getUploadedProvider}
          />
        )}
      </GlassCard>

      {filteredAndSortedTracks.length === 0 && (
        <EmptyState
          icon={Music}
          title="Aucun titre trouvé"
          description="Essayez de modifier vos filtres de recherche"
        />
      )}
    </PageContainer>
  );
});

LibraryView.displayName = "LibraryView";
