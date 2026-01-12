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
import { HelpButton, HelpIcon } from "@/components/ui/HelpButton";
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
  onNavigateToArtist?: (artistName: string) => void;
  onNavigateToAlbum?: (albumName: string, artistName: string) => void;
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

// Animation variants - simplified for better performance
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.15 } // Removed staggerChildren for perf
  }
};

const itemVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.1 } }
};

// Memoized Album Card Component - simplified animations
const AlbumCard = memo(({ 
  album, 
  onSelect, 
  onPlay,
}: { 
  album: { name: string; artist: string; coverUrl: string; tracks: Track[]; year?: number };
  onSelect: () => void;
  onPlay: () => void;
}) => (
  <div
    className="group relative cursor-pointer transition-transform duration-200 hover:scale-[1.02]"
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
      
      {/* Play button - simplified without heavy animations */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onPlay();
        }}
        className="absolute bottom-3 right-3 w-12 h-12 rounded-full bg-primary shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 hover:scale-110"
      >
        <Play className="w-5 h-5 text-primary-foreground fill-current ml-0.5" />
      </button>
    </div>
    
    <div className="mt-3 px-1">
      <h3 className="font-medium text-sm truncate text-foreground group-hover:text-primary transition-colors">
        {album.name}
      </h3>
      <p className="text-xs text-muted-foreground truncate mt-0.5">
        {album.artist} • {album.tracks.length} titres
      </p>
    </div>
  </div>
));
AlbumCard.displayName = "AlbumCard";

// Modern Artist Card Component - optimized with minimal animations
const ArtistCard = memo(({ 
  artist, 
  onSelect, 
  onPlay,
  variant = "default"
}: { 
  artist: { name: string; tracks: Track[]; albums: Set<string> };
  onSelect: () => void;
  onPlay: () => void;
  delay?: number; // Kept for backwards compatibility but ignored
  variant?: "default" | "featured" | "compact";
}) => {
  const coverUrl = artist.tracks[0]?.coverUrl;
  const totalDuration = artist.tracks.reduce((sum, t) => sum + t.duration, 0);
  const hours = Math.floor(totalDuration / 3600);
  const mins = Math.floor((totalDuration % 3600) / 60);
  const durationText = hours > 0 ? `${hours}h ${mins}min` : `${mins} min`;
  
  // Featured variant - larger card for top artists (simplified)
  if (variant === "featured") {
    return (
      <div
        className="group relative cursor-pointer transition-transform duration-200 hover:-translate-y-2"
        onClick={onSelect}
      >
        <div className="relative aspect-[3/4] rounded-2xl overflow-hidden">
          {coverUrl ? (
            <img
              src={getCoverUrl(coverUrl)}
              alt={artist.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/40 via-secondary/30 to-accent/40 flex items-center justify-center">
              <User className="w-20 h-20 text-white/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <h3 className="font-display text-2xl font-bold text-white mb-1 drop-shadow-lg">
              {artist.name}
            </h3>
            <p className="text-white/70 text-sm mb-3">
              {artist.albums.size} album{artist.albums.size > 1 ? "s" : ""} • {artist.tracks.length} titres
            </p>
            <button
              className="w-12 h-12 rounded-full bg-primary shadow-xl shadow-primary/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110"
              onClick={(e) => { e.stopPropagation(); onPlay(); }}
            >
              <Play className="w-5 h-5 text-primary-foreground fill-current ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Compact variant for list view (simplified)
  if (variant === "compact") {
    return (
      <div
        className="group flex items-center gap-4 p-3 rounded-xl cursor-pointer hover:bg-card/50 transition-all duration-150 hover:translate-x-1"
        onClick={onSelect}
      >
        <div className="relative w-14 h-14 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-transparent group-hover:ring-primary/30 transition-all">
          {coverUrl ? (
            <img src={getCoverUrl(coverUrl)} alt={artist.name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center">
              <User className="w-6 h-6 text-primary/50" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">{artist.name}</h3>
          <p className="text-xs text-muted-foreground">{artist.tracks.length} titres</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
          className="w-9 h-9 rounded-full bg-primary/10 hover:bg-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
        >
          <Play className="w-4 h-4 text-primary group-hover:text-primary-foreground fill-current ml-0.5" />
        </button>
      </div>
    );
  }

  // Default variant - modern circular card (simplified)
  return (
    <div
      className="group relative cursor-pointer transition-transform duration-200 hover:-translate-y-1.5"
      onClick={onSelect}
    >
      {/* Glow effect */}
      <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-primary/20 via-secondary/20 to-accent/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative">
        <div className="aspect-square rounded-full overflow-hidden bg-gradient-to-br from-primary/30 to-accent/30 shadow-lg group-hover:shadow-2xl transition-all duration-500 ring-2 ring-white/10 group-hover:ring-primary/40">
          {coverUrl ? (
            <img
              src={getCoverUrl(coverUrl)}
              alt={artist.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-500/30 via-fuchsia-500/20 to-pink-500/30">
              <User className="w-12 h-12 text-white/50" />
            </div>
          )}
          
          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
            <motion.button
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                onPlay();
              }}
              className="w-14 h-14 rounded-full bg-primary shadow-xl shadow-primary/40 flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform duration-300"
            >
              <Play className="w-6 h-6 text-primary-foreground fill-current ml-0.5" />
            </motion.button>
          </div>
        </div>
      </div>
      
      <div className="mt-4 text-center px-1">
        <h3 className="font-semibold text-sm truncate text-foreground group-hover:text-primary transition-colors">
          {artist.name}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {artist.albums.size} album{artist.albums.size > 1 ? "s" : ""} • {artist.tracks.length} titres
        </p>
      </div>
    </div>
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
  onNavigateToArtist,
  onNavigateToAlbum,
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

  // Get random cover images for visual display
  const randomCovers = useMemo(() => {
    const coversWithImages = tracks.filter(t => t.coverUrl);
    return coversWithImages.sort(() => Math.random() - 0.5);
  }, [tracks]);

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
          icon={<Library className="w-10 h-10 text-primary" />}
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
    // Get featured albums (most tracks) - only take top 6
    const featuredAlbums = [...filteredAndSortedAlbums]
      .sort((a, b) => b.tracks.length - a.tracks.length)
      .slice(0, 6);
    const remainingAlbums = filteredAndSortedAlbums.filter(
      a => !featuredAlbums.find(f => f.name === a.name && f.artist === a.artist)
    );

    return (
      <div className="min-h-full pb-8">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 via-purple-500/10 to-pink-500/20" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-400/10 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
          
          <div className="relative px-6 pt-8 pb-16">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
              <div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 mb-3"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <Disc3 className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                    Discographie
                  </span>
                </motion.div>
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="font-display text-5xl md:text-6xl font-bold"
                >
                  {title}
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-muted-foreground mt-2 text-lg"
                >
                  {filteredAndSortedAlbums.length} album{filteredAndSortedAlbums.length > 1 ? "s" : ""} • {artists.length} artistes • {tracks.length} titres
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-3"
              >
                <Button onClick={handlePlayAll} size="lg" className="gap-2 shadow-lg shadow-primary/30">
                  <Play className="w-5 h-5 fill-current" />
                  Tout lire
                </Button>
                <Button onClick={handleShuffleAll} variant="outline" size="lg" className="gap-2 backdrop-blur-sm">
                  <Shuffle className="w-5 h-5" />
                  Aléatoire
                </Button>
              </motion.div>
            </div>

            {/* Featured Albums */}
            {featuredAlbums.length > 0 && !albumsSearchQuery && !albumsFilterArtist && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  Albums populaires
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {featuredAlbums.map((album, idx) => (
                    <motion.div
                      key={`featured-${album.name}-${album.artist}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + idx * 0.1 }}
                      whileHover={{ scale: 1.03, y: -4 }}
                      onClick={() => setSelectedAlbum(`${album.name}-${album.artist}`)}
                      className="group cursor-pointer"
                    >
                      <div className="relative aspect-square rounded-2xl overflow-hidden shadow-xl group-hover:shadow-2xl transition-all">
                        {album.coverUrl ? (
                          <img src={getCoverUrl(album.coverUrl)} alt={album.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center">
                            <Disc3 className="w-12 h-12 text-white/50" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg">
                            <Play className="w-5 h-5 text-primary-foreground fill-current ml-0.5" />
                          </div>
                        </div>
                      </div>
                      <p className="mt-2 text-sm font-medium truncate">{album.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{album.artist}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="px-6 -mt-8">
          {/* Toolbar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap items-center gap-4 mb-8 p-4 rounded-2xl bg-card/50 backdrop-blur-xl border border-border/30"
          >
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={albumsSearchQuery}
                  onChange={(e) => setAlbumsSearchQuery(e.target.value)}
                  placeholder="Rechercher un album..."
                  className="pl-10 bg-background/50 border-border/50"
                />
                {albumsSearchQuery && (
                  <button
                    onClick={() => setAlbumsSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title="Effacer la recherche"
                    aria-label="Effacer la recherche"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <Select value={albumsFilterArtist || "__all__"} onValueChange={(v) => setAlbumsFilterArtist(v === "__all__" ? null : v)}>
              <SelectTrigger className="w-[180px] bg-background/50">
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
              <SelectTrigger className="w-[140px] bg-background/50">
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
              className="bg-background/50"
            >
              {albumsSortOrder === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
              <Button
                variant={albumsViewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setAlbumsViewMode("grid")}
                className="h-8 w-8"
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={albumsViewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setAlbumsViewMode("list")}
                className="h-8 w-8"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>

          {/* Active Filters */}
          {(albumsSearchQuery || albumsFilterArtist) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="flex flex-wrap gap-2 mb-6"
            >
              {albumsSearchQuery && (
                <Badge variant="secondary" className="gap-1 px-3 py-1">
                  Recherche: {albumsSearchQuery}
                  <button onClick={() => setAlbumsSearchQuery("")} className="ml-1 hover:text-destructive" title="Supprimer le filtre" aria-label="Supprimer le filtre de recherche">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {albumsFilterArtist && (
                <Badge variant="secondary" className="gap-1 px-3 py-1">
                  Artiste: {albumsFilterArtist}
                  <button onClick={() => setAlbumsFilterArtist(null)} className="ml-1 hover:text-destructive" title="Supprimer le filtre" aria-label="Supprimer le filtre artiste">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
            </motion.div>
          )}

          {/* All Albums Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              Tous les albums
              <span className="text-sm font-normal text-muted-foreground">
                ({albumsSearchQuery || albumsFilterArtist ? filteredAndSortedAlbums.length : remainingAlbums.length})
              </span>
            </h2>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
            >
              <AnimatePresence mode="popLayout">
                {(albumsSearchQuery || albumsFilterArtist ? filteredAndSortedAlbums : remainingAlbums).map((album, idx) => (
                  <AlbumCard
                    key={`${album.name}-${album.artist}`}
                    album={album}
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
          </motion.div>

          {(albumsSearchQuery || albumsFilterArtist ? filteredAndSortedAlbums : remainingAlbums).length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Disc3 className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">Aucun album trouvé</h3>
              <p className="text-muted-foreground text-sm max-w-md">
                {albumsSearchQuery || albumsFilterArtist
                  ? "Essayez de modifier vos termes de recherche"
                  : "Ajoutez de la musique à votre bibliothèque pour voir vos albums"}
              </p>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  // Artists View
  if (viewMode === "artists") {
    // Get top artists (most tracks) - only take top 4
    const topArtists = [...filteredAndSortedArtists]
      .sort((a, b) => b.tracks.length - a.tracks.length)
      .slice(0, 4);
    const remainingArtists = filteredAndSortedArtists.filter(
      a => !topArtists.find(t => t.name === a.name)
    );

    return (
      <div className="min-h-full pb-8">
        {/* Hero Section with gradient background */}
        <div className="relative overflow-hidden">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-fuchsia-500/10 to-pink-500/20" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-400/10 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
          
          <div className="relative px-6 pt-8 pb-16">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
              <div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 mb-3"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                    Collection
                  </span>
                </motion.div>
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="font-display text-5xl md:text-6xl font-bold bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text"
                >
                  {title}
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-muted-foreground mt-2 text-lg"
                >
                  {filteredAndSortedArtists.length} artiste{filteredAndSortedArtists.length > 1 ? "s" : ""} • {albums.length} albums • {tracks.length} titres
                </motion.p>
              </div>

              {/* Actions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-3"
              >
                <Button onClick={handlePlayAll} size="lg" className="gap-2 shadow-lg shadow-primary/30">
                  <Play className="w-5 h-5 fill-current" />
                  Tout lire
                </Button>
                <Button onClick={handleShuffleAll} variant="outline" size="lg" className="gap-2 backdrop-blur-sm">
                  <Shuffle className="w-5 h-5" />
                  Aléatoire
                </Button>
              </motion.div>
            </div>

            {/* Featured Artists - Top 4 */}
            {topArtists.length > 0 && !artistsSearchQuery && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  Artistes vedettes
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {topArtists.map((artist, idx) => (
                    <ArtistCard
                      key={artist.name}
                      artist={artist}
                      variant="featured"
                      delay={idx * 0.1}
                      onSelect={() => {
                        if (onNavigateToArtist) {
                          onNavigateToArtist(artist.name);
                        } else {
                          setSelectedArtist(artist.name);
                        }
                      }}
                      onPlay={() => {
                        const firstTrack = artist.tracks[0];
                        const idx = tracks.findIndex(t => t.id === firstTrack.id);
                        if (idx !== -1) onTrackSelect(idx);
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="px-6 -mt-8">
          {/* Toolbar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap items-center gap-4 mb-8 p-4 rounded-2xl bg-card/50 backdrop-blur-xl border border-border/30"
          >
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={artistsSearchQuery}
                  onChange={(e) => setArtistsSearchQuery(e.target.value)}
                  placeholder="Rechercher un artiste..."
                  className="pl-10 bg-background/50 border-border/50"
                />
                {artistsSearchQuery && (
                  <button
                    onClick={() => setArtistsSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title="Effacer la recherche"
                    aria-label="Effacer la recherche"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <Select value={artistsSortBy} onValueChange={(v) => setArtistsSortBy(v as typeof artistsSortBy)}>
              <SelectTrigger className="w-[140px] bg-background/50">
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
              className="bg-background/50"
            >
              {artistsSortOrder === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
              <Button
                variant={artistsViewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setArtistsViewMode("grid")}
                className="h-8 w-8"
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={artistsViewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setArtistsViewMode("list")}
                className="h-8 w-8"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>

          {/* All Artists Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              Tous les artistes
              <span className="text-sm font-normal text-muted-foreground">
                ({artistsSearchQuery ? filteredAndSortedArtists.length : remainingArtists.length})
              </span>
            </h2>

            {/* Grid View */}
            {artistsViewMode === "grid" && (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
              >
                <AnimatePresence mode="popLayout">
                  {(artistsSearchQuery ? filteredAndSortedArtists : remainingArtists).map((artist, idx) => (
                    <ArtistCard
                      key={artist.name}
                      artist={artist}
                      delay={Math.min(idx * 0.02, 0.3)}
                      onSelect={() => {
                        if (onNavigateToArtist) {
                          onNavigateToArtist(artist.name);
                        } else {
                          setSelectedArtist(artist.name);
                        }
                      }}
                      onPlay={() => {
                        const firstTrack = artist.tracks[0];
                        const idx = tracks.findIndex(t => t.id === firstTrack.id);
                        if (idx !== -1) onTrackSelect(idx);
                      }}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}

            {/* List View */}
            {artistsViewMode === "list" && (
              <div className="space-y-1 bg-card/30 backdrop-blur-sm rounded-2xl border border-border/30 p-2">
                <AnimatePresence mode="popLayout">
                  {(artistsSearchQuery ? filteredAndSortedArtists : remainingArtists).map((artist, idx) => (
                    <ArtistCard
                      key={artist.name}
                      artist={artist}
                      variant="compact"
                      delay={Math.min(idx * 0.015, 0.2)}
                      onSelect={() => {
                        if (onNavigateToArtist) {
                          onNavigateToArtist(artist.name);
                        } else {
                          setSelectedArtist(artist.name);
                        }
                      }}
                      onPlay={() => {
                        const firstTrack = artist.tracks[0];
                        const idx = tracks.findIndex(t => t.id === firstTrack.id);
                        if (idx !== -1) onTrackSelect(idx);
                      }}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>

          {(artistsSearchQuery ? filteredAndSortedArtists : remainingArtists).length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <User className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">Aucun artiste trouvé</h3>
              <p className="text-muted-foreground text-sm max-w-md">
                {artistsSearchQuery 
                  ? "Essayez de modifier vos termes de recherche" 
                  : "Ajoutez de la musique à votre bibliothèque pour voir vos artistes"}
              </p>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  // Folders View
  if (viewMode === "folders") {
    const totalFolderTracks = folders.reduce((acc, f) => acc + f.tracks.length, 0);
    const totalDur = folders.reduce((acc, f) => acc + f.tracks.reduce((a, t) => a + t.duration, 0), 0);

    return (
      <div className="min-h-full pb-8 relative">
        {/* Animated Background Orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ 
              x: [0, 100, 0], 
              y: [0, -50, 0],
              scale: [1, 1.2, 1]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-20 -left-32 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl"
          />
          <motion.div
            animate={{ 
              x: [0, -80, 0], 
              y: [0, 60, 0],
              scale: [1, 0.9, 1]
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-40 -right-32 w-80 h-80 bg-orange-500/15 rounded-full blur-3xl"
          />
        </div>

        {/* Hero Section */}
        <div className="relative">
          <div className="px-6 pt-8 pb-12">
            {/* Bento Grid Header */}
            <div className="grid grid-cols-12 gap-4 mb-8">
              {/* Main Title Card */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="col-span-12 md:col-span-8 p-8 rounded-3xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 backdrop-blur-xl relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                
                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <motion.div
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl shadow-amber-500/30"
                    >
                      <FolderOpen className="w-7 h-7 text-white" />
                    </motion.div>
                    <div className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30">
                      <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">Sources Locales</span>
                    </div>
                  </div>
                  
                  <h1 className="font-display text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-foreground via-foreground to-amber-300 bg-clip-text text-transparent">
                    {title}
                  </h1>
                  <p className="text-muted-foreground text-lg">
                    Explorez votre collection musicale locale
                  </p>
                </div>
              </motion.div>

              {/* Stats Cards */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="col-span-6 md:col-span-2 p-6 rounded-3xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 backdrop-blur-xl flex flex-col justify-center items-center text-center group hover:scale-105 transition-transform duration-300"
              >
                <FolderOpen className="w-8 h-8 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-3xl font-bold">{folders.length}</p>
                <p className="text-xs text-muted-foreground">Dossiers</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="col-span-6 md:col-span-2 p-6 rounded-3xl bg-gradient-to-br from-orange-500/20 to-red-500/10 border border-orange-500/20 backdrop-blur-xl flex flex-col justify-center items-center text-center group hover:scale-105 transition-transform duration-300"
              >
                <Music className="w-8 h-8 text-orange-400 mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-3xl font-bold">{totalFolderTracks}</p>
                <p className="text-xs text-muted-foreground">Titres</p>
              </motion.div>
            </div>

            {/* Action Bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-4 mb-8"
            >
              <Button 
                onClick={handlePlayAll} 
                size="lg" 
                className="gap-3 px-8 h-14 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-xl shadow-amber-500/30 transition-all hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/40"
              >
                <Play className="w-6 h-6 fill-current" />
                <span className="font-semibold">Tout lire</span>
              </Button>
              <Button 
                onClick={handleShuffleAll} 
                variant="outline" 
                size="lg" 
                className="gap-3 px-8 h-14 rounded-2xl border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-500/50 transition-all hover:scale-105"
              >
                <Shuffle className="w-5 h-5" />
                <span className="font-semibold">Aléatoire</span>
              </Button>
              <div className="ml-auto text-sm text-muted-foreground">
                <Clock className="w-4 h-4 inline mr-1" />
                {formatDuration(totalDur)}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Folders Grid */}
        <div className="px-6">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {folders.map((folder, idx) => (
              <motion.div
                key={folder.path}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: idx * 0.05, type: "spring", stiffness: 100 }}
                whileHover={{ y: -4 }}
                className="group"
              >
                <div
                  className={cn(
                    "relative rounded-3xl border transition-all duration-300 cursor-pointer overflow-hidden",
                    selectedFolder === folder.path 
                      ? "bg-gradient-to-br from-amber-500/15 to-orange-500/10 border-amber-500/40 shadow-xl shadow-amber-500/10" 
                      : "bg-card/40 backdrop-blur-xl border-border/30 hover:bg-card/60 hover:border-amber-500/30 hover:shadow-lg"
                  )}
                  onClick={() => setSelectedFolder(selectedFolder === folder.path ? null : folder.path)}
                >
                  {/* Glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="relative p-5">
                    <div className="flex items-center gap-4">
                      <motion.div 
                        animate={{ rotate: selectedFolder === folder.path ? 15 : 0 }}
                        className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300",
                          selectedFolder === folder.path 
                            ? "bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30" 
                            : "bg-gradient-to-br from-amber-500/20 to-orange-500/10 group-hover:from-amber-500/30 group-hover:to-orange-500/20"
                        )}
                      >
                        <FolderOpen className={cn(
                          "w-7 h-7 transition-colors",
                          selectedFolder === folder.path ? "text-white" : "text-amber-400"
                        )} />
                      </motion.div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-lg truncate group-hover:text-amber-300 transition-colors">
                          {folder.path.split(/[/\\]/).pop()}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">{folder.path}</p>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-amber-400">{folder.tracks.length}</p>
                          <p className="text-xs text-muted-foreground">titres</p>
                        </div>
                        <motion.div
                          animate={{ rotate: selectedFolder === folder.path ? 90 : 0 }}
                          transition={{ type: "spring", stiffness: 200 }}
                        >
                          <ChevronRight className="w-6 h-6 text-muted-foreground" />
                        </motion.div>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {selectedFolder === folder.path && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="border-t border-amber-500/20 overflow-hidden"
                      >
                        <div className="p-4 bg-background/50 backdrop-blur-sm">
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
                </div>
              </motion.div>
            ))}
          </motion.div>

          {folders.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center">
                  <FolderOpen className="w-12 h-12 text-amber-400/50" />
                </div>
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-3xl bg-amber-500/20 blur-xl"
                />
              </div>
              <h3 className="text-xl font-semibold mb-2">Aucun dossier</h3>
              <p className="text-muted-foreground max-w-sm">
                Ajoutez des dossiers contenant votre musique pour les voir apparaître ici
              </p>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  // Tracks View (default)
  // If no title, render simplified list only (for embedded use in other views)
  if (!title) {
    return (
      <div className="p-4">
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
            onNavigateToArtist={onNavigateToArtist}
            onNavigateToAlbum={onNavigateToAlbum}
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
            onNavigateToArtist={onNavigateToArtist}
            onNavigateToAlbum={onNavigateToAlbum}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-full pb-8 relative">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ 
            x: [0, 50, 0], 
            y: [0, -30, 0],
            rotate: [0, 5, 0]
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-20 -left-20 w-[500px] h-[500px] bg-emerald-500/15 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ 
            x: [0, -40, 0], 
            y: [0, 40, 0],
            rotate: [0, -5, 0]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-60 -right-40 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ 
            x: [0, 30, 0], 
            y: [0, -20, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-20 left-1/3 w-[300px] h-[300px] bg-cyan-500/10 rounded-full blur-3xl"
        />
      </div>

      {/* Hero Section */}
      <div className="relative px-6 pt-8 pb-6">
        {/* Bento Grid Layout */}
        <div className="grid grid-cols-12 gap-4 mb-8">
          {/* Main Hero Card with Album Art Collage */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 100 }}
            className="col-span-12 lg:col-span-7 relative rounded-3xl overflow-hidden border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-background to-teal-500/5 backdrop-blur-xl group min-h-[280px]"
          >
            {/* Album Art Collage Background */}
            <div className="absolute inset-0 grid grid-cols-3 gap-1 opacity-20 group-hover:opacity-30 transition-opacity duration-500">
              {randomCovers.map((track, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="relative overflow-hidden"
                >
                  <img 
                    src={getCoverUrl(track.coverUrl)} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
                </motion.div>
              ))}
            </div>
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-background/60" />
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            {/* Content */}
            <div className="relative p-8 h-full flex flex-col justify-end">
              <div className="flex items-center gap-3 mb-4">
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                  className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-2xl shadow-emerald-500/40"
                >
                  <Music className="w-8 h-8 text-white" />
                </motion.div>
                <div>
                  <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 inline-block mb-1">
                    <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Bibliothèque</span>
                  </div>
                </div>
              </div>
              
              <h1 className="font-display text-5xl md:text-6xl font-bold mb-2 bg-gradient-to-r from-foreground via-foreground to-emerald-300 bg-clip-text text-transparent">
                {title}
              </h1>
              <p className="text-muted-foreground text-lg mb-6 flex items-center gap-2">
                Votre collection musicale complète
                <HelpIcon
                  title="Bibliothèque"
                  description="Organisez votre collection avec différents modes de vue. Triez par titre, artiste ou album. Écoutez aléatoirement ou créez des playlists."
                />
              </p>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-4">
                <Button 
                  onClick={handlePlayAll} 
                  size="lg" 
                  className="gap-3 px-8 h-14 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-xl shadow-emerald-500/30 transition-all hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/40"
                >
                  <Play className="w-6 h-6 fill-current" />
                  <span className="font-semibold">Tout lire</span>
                </Button>
                <Button 
                  onClick={handleShuffleAll} 
                  variant="outline" 
                  size="lg" 
                  className="gap-3 px-8 h-14 rounded-2xl border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all hover:scale-105"
                >
                  <Shuffle className="w-5 h-5" />
                  <span className="font-semibold">Aléatoire</span>
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Stats Cards */}
          <div className="col-span-12 lg:col-span-5 grid grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              whileHover={{ scale: 1.03, y: -4 }}
              className="p-6 rounded-3xl bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-transparent border border-emerald-500/20 backdrop-blur-xl relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <Music className="w-10 h-10 text-emerald-400 mb-3" />
              <p className="text-4xl font-bold">{tracks.length.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Titres</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              whileHover={{ scale: 1.03, y: -4 }}
              className="p-6 rounded-3xl bg-gradient-to-br from-purple-500/20 via-purple-500/10 to-transparent border border-purple-500/20 backdrop-blur-xl relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <Disc3 className="w-10 h-10 text-purple-400 mb-3" />
              <p className="text-4xl font-bold">{albums.length.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Albums</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              whileHover={{ scale: 1.03, y: -4 }}
              className="p-6 rounded-3xl bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-transparent border border-blue-500/20 backdrop-blur-xl relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <User className="w-10 h-10 text-blue-400 mb-3" />
              <p className="text-4xl font-bold">{artists.length.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Artistes</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              whileHover={{ scale: 1.03, y: -4 }}
              className="p-6 rounded-3xl bg-gradient-to-br from-orange-500/20 via-orange-500/10 to-transparent border border-orange-500/20 backdrop-blur-xl relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <Clock className="w-10 h-10 text-orange-400 mb-3" />
              <p className="text-4xl font-bold">{formatDuration(totalDuration)}</p>
              <p className="text-sm text-muted-foreground">Durée totale</p>
            </motion.div>
          </div>
        </div>

        {/* Modern Toolbar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap items-center gap-4 p-4 rounded-2xl bg-card/40 backdrop-blur-2xl border border-border/30 shadow-xl"
        >
          {/* Search Input */}
          <div className="flex-1 min-w-[250px] relative group">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 opacity-0 group-focus-within:opacity-100 blur transition-opacity" />
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-emerald-400 transition-colors" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher dans votre bibliothèque..."
                className="pl-12 h-12 bg-background/50 border-border/50 rounded-xl focus:border-emerald-500/50 focus:ring-emerald-500/20 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted/50 transition-colors"
                  title="Effacer la recherche"
                  aria-label="Effacer la recherche"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Sort Select */}
          <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
            <SelectTrigger className="w-[160px] h-12 bg-background/50 border-border/50 rounded-xl">
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

          {/* View Toggle */}
          <div className="flex items-center gap-1 p-1.5 rounded-xl bg-muted/50 border border-border/30">
            <Button
              variant={displayMode === "grid" ? "default" : "ghost"}
              size="icon"
              onClick={() => setDisplayMode("grid")}
              className={cn(
                "h-9 w-9 rounded-lg transition-all",
                displayMode === "grid" && "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30"
              )}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={displayMode === "list" ? "default" : "ghost"}
              size="icon"
              onClick={() => setDisplayMode("list")}
              className={cn(
                "h-9 w-9 rounded-lg transition-all",
                displayMode === "list" && "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30"
              )}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>

        {/* Active Filters */}
        {searchQuery && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="flex flex-wrap gap-2 mt-4"
          >
            <Badge className="gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30 transition-colors">
              <Search className="w-3 h-3" />
              {searchQuery}
              <button 
                onClick={() => setSearchQuery("")} 
                className="ml-1 hover:text-white transition-colors"
                title="Supprimer le filtre" 
                aria-label="Supprimer le filtre de recherche"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          </motion.div>
        )}
      </div>

      {/* Track List/Grid */}
      <div className="px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="rounded-3xl bg-card/30 backdrop-blur-xl border border-border/30 overflow-hidden shadow-2xl">
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
                onNavigateToArtist={onNavigateToArtist}
                onNavigateToAlbum={onNavigateToAlbum}
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
                onNavigateToArtist={onNavigateToArtist}
                onNavigateToAlbum={onNavigateToAlbum}
              />
            )}
          </div>
        </motion.div>

        {filteredAndSortedTracks.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 flex items-center justify-center">
                <Music className="w-12 h-12 text-emerald-400/50" />
              </div>
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-3xl bg-emerald-500/20 blur-xl"
              />
            </div>
            <h3 className="text-xl font-semibold mb-2">Aucun titre trouvé</h3>
            <p className="text-muted-foreground max-w-sm">
              {searchQuery
                ? "Essayez de modifier vos termes de recherche"
                : "Ajoutez de la musique à votre bibliothèque"}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
});

LibraryView.displayName = "LibraryView";
