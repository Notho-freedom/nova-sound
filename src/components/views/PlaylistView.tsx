import { useState, useMemo, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Music, 
  ListMusic, 
  Trash2, 
  Edit, 
  Play, 
  Shuffle, 
  X, 
  Search, 
  ArrowLeft, 
  Check, 
  ChevronUp, 
  ChevronDown, 
  Grid, 
  List,
  Filter,
  Heart,
  Clock,
  Sparkles,
  MoreHorizontal,
} from "lucide-react";
import { Track, Playlist } from "@/types/music";
import { cn } from "@/lib/utils";
import { getCoverUrl, formatDuration } from "@/lib/audio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PlaylistContextMenu } from "@/components/PlaylistContextMenu";
import { TrackGridView } from "@/components/TrackGridView";
import { TrackListView } from "@/components/TrackListView";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";
import { useBunnyUpload } from "@/hooks/useBunnyUpload";
import { useNexusUpload } from "@/hooks/useNexusUpload";
import { useUploadedStatus } from "@/hooks/useUploadedStatus";
import { useCloudSync } from "@/hooks/useCloudSync";
import { AlbumGridSkeleton, TrackTableSkeleton } from "@/components/ui/skeletons";
import { PageContainer, PageHero, EmptyState, GlassCard } from "@/components/ui/PageLayout";
import { SearchBar, FilterChip, ViewToggle, Toolbar } from "@/components/ui/SearchFilter";

interface PlaylistViewProps {
  tracks: Track[];
  playlists: Playlist[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onTrackSelect: (index: number) => void;
  onPlayTracks?: (trackIds: string[]) => void;
  onShuffleTracks?: (trackIds: string[]) => void;
  onCreatePlaylist: (name: string, trackIds?: string[]) => Promise<Playlist | null>;
  onUpdatePlaylist: (id: string, data: Partial<Playlist>) => Promise<Playlist | null>;
  onDeletePlaylist: (id: string) => Promise<void>;
  onAddTracksToPlaylist: (playlistId: string, trackIds: string[]) => Promise<void>;
  onRemoveTracksFromPlaylist: (playlistId: string, trackIds: string[]) => Promise<void>;
  loading?: boolean;
}

type ViewMode = "grid" | "list";
type PageMode = "list" | "create" | "detail" | "edit";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1 }
};

const gradientPalette = [
  "from-fuchsia-500/25 via-purple-500/20 to-indigo-500/30",
  "from-amber-500/25 via-orange-500/15 to-rose-500/25",
  "from-emerald-500/20 via-teal-500/15 to-cyan-500/25",
  "from-blue-500/25 via-indigo-500/20 to-slate-500/25",
  "from-pink-500/25 via-rose-500/15 to-red-500/25",
  "from-lime-500/25 via-emerald-500/15 to-teal-500/25",
];

const hashString = (value: string) =>
  value.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

const pickGradient = (seed: string) => {
  const index = Math.abs(hashString(seed)) % gradientPalette.length;
  return gradientPalette[index];
};

// Memoized Playlist Card
const PlaylistCard = memo(({ 
  playlist, 
  tracks,
  onSelect, 
  onPlay,
  onShuffle,
  onEdit,
  onDelete,
  canUpload,
  onUpload,
}: { 
  playlist: Playlist;
  tracks: Track[];
  onSelect: () => void;
  onPlay: () => void;
  onShuffle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canUpload?: boolean;
  onUpload?: () => void;
}) => {
  const playlistTracks = useMemo(() => 
    playlist.trackIds
      .map((id) => tracks.find((t) => t.id === id))
      .filter((t): t is Track => !!t),
    [playlist.trackIds, tracks]
  );
  
  const coverUrl = playlistTracks[0]?.coverUrl ? getCoverUrl(playlistTracks[0].coverUrl) : null;
  const totalDuration = playlistTracks.reduce((acc, t) => acc + t.duration, 0);
  const gradient = pickGradient(`${playlist.id}-${playlist.name}`);
  
  return (
    <PlaylistContextMenu
      playlist={playlist}
      onPlay={onPlay}
      onShuffle={onShuffle}
      onEdit={onEdit}
      onDelete={onDelete}
      onView={onSelect}
      onUploadToCloudinary={onUpload}
      canUploadToCloudinary={canUpload}
    >
      <motion.div
        variants={itemVariants}
        whileHover={{ scale: 1.025, y: -6 }}
        whileTap={{ scale: 0.98 }}
        onClick={onSelect}
        className="group relative cursor-pointer"
      >
        <div className="relative aspect-square rounded-2xl overflow-hidden border border-white/5 bg-gradient-to-br shadow-xl transition-all duration-500 group-hover:shadow-2xl group-hover:border-white/10"
          style={{ boxShadow: "0 25px 60px -35px rgba(0,0,0,0.6)" }}
        >
          <div className={cn("absolute inset-0 bg-gradient-to-br", gradient)} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.12),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.08),transparent_25%)]" aria-hidden="true" />

          {coverUrl && (
            <img
              src={coverUrl}
              alt={playlist.name}
              className="absolute inset-0 w-full h-full object-cover opacity-45 group-hover:opacity-60 transition-opacity duration-500"
              loading="lazy"
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

          <motion.button
            initial={{ scale: 0.85, opacity: 0 }}
            whileHover={{ scale: 1.05, opacity: 1 }}
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            className="absolute bottom-4 right-4 w-12 h-12 rounded-full bg-white/90 text-black shadow-2xl flex items-center justify-center backdrop-blur-md"
          >
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </motion.button>

          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-center gap-2 text-white/80 text-xs font-semibold uppercase tracking-[0.12em]">
              <span className="px-2 py-1 rounded-full bg-white/10 border border-white/20">Playlist</span>
              <span className="px-2 py-1 rounded-full bg-black/30 backdrop-blur">{playlistTracks.length} titres</span>
            </div>
            <h3 className="mt-3 text-lg font-display font-bold text-white drop-shadow-sm line-clamp-2">
              {playlist.name}
            </h3>
            <p className="text-xs text-white/70 mt-1 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/40 backdrop-blur border border-white/10">
                <Clock className="w-3 h-3" />
                {formatDuration(totalDuration)}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 border border-white/20">
                <Shuffle className="w-3 h-3" />
                Mix prêt
              </span>
            </p>
          </div>
        </div>
      </motion.div>
    </PlaylistContextMenu>
  );
});
PlaylistCard.displayName = "PlaylistCard";

// Stat Card
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

export const PlaylistView = memo(({
  tracks,
  playlists,
  currentTrackIndex,
  isPlaying,
  onTrackSelect,
  onPlayTracks,
  onShuffleTracks,
  onCreatePlaylist,
  onUpdatePlaylist,
  onDeletePlaylist,
  onAddTracksToPlaylist,
  onRemoveTracksFromPlaylist,
  loading = false,
}: PlaylistViewProps) => {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [pageMode, setPageMode] = useState<PageMode>("list");
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [selectedTracksForPlaylist, setSelectedTracksForPlaylist] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [editingPlaylistName, setEditingPlaylistName] = useState("");
  
  // Upload hooks
  const { uploadPlaylist, uploadTrack, getTrackProgress } = useCloudinaryUpload();
  const { uploadPlaylist: uploadPlaylistToBunny, getTrackProgress: getBunnyTrackProgress } = useBunnyUpload();
  const { uploadPlaylist: uploadPlaylistToNexus, uploadTrack: uploadTrackToNexus, getTrackProgress: getNexusTrackProgress } = useNexusUpload();
  const { cloudinaryConfigured, nexusIsPro, nexusAuthenticated } = useCloudSync();
  const { isUploaded, getUploadedProvider } = useUploadedStatus();
  
  const canUploadToCloudinary = cloudinaryConfigured && !nexusIsPro;
  const canUploadToNexus = nexusIsPro && nexusAuthenticated;
  
  // Table state
  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const [tableSortBy, setTableSortBy] = useState<"title" | "artist" | "album" | "duration">("title");
  const [tableSortOrder, setTableSortOrder] = useState<"asc" | "desc">("asc");
  const [filterArtist, setFilterArtist] = useState<string | null>(null);
  const [filterAlbum, setFilterAlbum] = useState<string | null>(null);

  // Get selected playlist
  const selectedPlaylist = useMemo(() => 
    playlists.find((p) => p.id === selectedPlaylistId) || null,
    [playlists, selectedPlaylistId]
  );

  // Get tracks for selected playlist
  const playlistTracks = useMemo(() => {
    if (!selectedPlaylist) return [];
    return selectedPlaylist.trackIds
      .map((id) => tracks.find((t) => t.id === id))
      .filter((t): t is Track => !!t);
  }, [selectedPlaylist, tracks]);

  // Filter playlists
  const filteredPlaylists = useMemo(() => {
    if (!searchQuery.trim()) return playlists;
    const query = searchQuery.toLowerCase();
    return playlists.filter(
      (p) => p.name.toLowerCase().includes(query) || p.description?.toLowerCase().includes(query)
    );
  }, [playlists, searchQuery]);

  // Available tracks (not in current playlist)
  const availableTracks = useMemo(() => {
    if (!selectedPlaylist) return tracks;
    return tracks.filter((t) => !selectedPlaylist.trackIds.includes(t.id));
  }, [tracks, selectedPlaylist]);

  // Unique tracks
  const uniqueTracks = useMemo(() => {
    const seen = new Set<string>();
    return tracks.filter((track) => {
      if (seen.has(track.id)) return false;
      seen.add(track.id);
      return true;
    });
  }, [tracks]);

  const uniqueAvailableTracks = useMemo(() => {
    const seen = new Set<string>();
    return availableTracks.filter((track) => {
      if (seen.has(track.id)) return false;
      seen.add(track.id);
      return true;
    });
  }, [availableTracks]);

  // Unique artists and albums
  const uniqueArtists = useMemo(() => {
    const artists = new Set<string>();
    uniqueTracks.forEach(track => track.artist && artists.add(track.artist));
    return Array.from(artists).sort();
  }, [uniqueTracks]);

  const uniqueAlbums = useMemo(() => {
    const albums = new Set<string>();
    uniqueTracks.forEach(track => track.album && albums.add(track.album));
    return Array.from(albums).sort();
  }, [uniqueTracks]);

  // Filtered and sorted tracks
  const filteredAndSortedTracks = useMemo(() => {
    let filtered = uniqueTracks;

    if (tableSearchQuery.trim()) {
      const query = tableSearchQuery.toLowerCase();
      filtered = filtered.filter(track =>
        track.title.toLowerCase().includes(query) ||
        track.artist.toLowerCase().includes(query) ||
        track.album.toLowerCase().includes(query)
      );
    }

    if (filterArtist) filtered = filtered.filter(track => track.artist === filterArtist);
    if (filterAlbum) filtered = filtered.filter(track => track.album === filterAlbum);

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (tableSortBy) {
        case "title": comparison = a.title.localeCompare(b.title); break;
        case "artist": comparison = a.artist.localeCompare(b.artist); break;
        case "album": comparison = a.album.localeCompare(b.album); break;
        case "duration": comparison = a.duration - b.duration; break;
      }
      return tableSortOrder === "asc" ? comparison : -comparison;
    });
  }, [uniqueTracks, tableSearchQuery, filterArtist, filterAlbum, tableSortBy, tableSortOrder]);

  // Stats
  const totalTracks = useMemo(() => 
    playlists.reduce((acc, p) => acc + p.trackIds.length, 0),
    [playlists]
  );

  // Handlers
  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    const playlist = await onCreatePlaylist(newPlaylistName.trim(), selectedTracksForPlaylist);
    if (playlist) {
      toast.success("Playlist créée avec succès");
      setPageMode("list");
      setNewPlaylistName("");
      setSelectedTracksForPlaylist([]);
      setSelectedPlaylistId(playlist.id);
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    const playlist = playlists.find((p) => p.id === id);
    if (confirm(`Supprimer la playlist "${playlist?.name}" ?`)) {
      await onDeletePlaylist(id);
      toast.success("Playlist supprimée");
      if (selectedPlaylistId === id) setSelectedPlaylistId(null);
    }
  };

  const handleAddTracks = async () => {
    if (!selectedPlaylistId || selectedTracksForPlaylist.length === 0) return;
    await onAddTracksToPlaylist(selectedPlaylistId, selectedTracksForPlaylist);
    toast.success(`${selectedTracksForPlaylist.length} titre(s) ajouté(s)`);
    setPageMode("detail");
    setSelectedTracksForPlaylist([]);
  };

  const handleRemoveTracks = async () => {
    if (!selectedPlaylistId || selectedTracksForPlaylist.length === 0) return;
    await onRemoveTracksFromPlaylist(selectedPlaylistId, selectedTracksForPlaylist);
    toast.success(`${selectedTracksForPlaylist.length} titre(s) retiré(s)`);
    setSelectedTracksForPlaylist([]);
  };

  const handlePlayPlaylist = useCallback((playlistId: string) => {
    const playlist = playlists.find((p) => p.id === playlistId);
    if (playlist && playlist.trackIds.length > 0 && onPlayTracks) {
      onPlayTracks(playlist.trackIds);
    }
  }, [playlists, onPlayTracks]);

  const handleShufflePlaylist = useCallback((playlistId: string) => {
    const playlist = playlists.find((p) => p.id === playlistId);
    if (playlist && playlist.trackIds.length > 0 && onShuffleTracks) {
      onShuffleTracks(playlist.trackIds);
    }
  }, [playlists, onShuffleTracks]);

  const handleEditPlaylist = (playlist: Playlist) => {
    setEditingPlaylistId(playlist.id);
    setEditingPlaylistName(playlist.name);
  };

  const handleSaveEdit = async () => {
    if (!editingPlaylistId || !editingPlaylistName.trim()) return;
    await onUpdatePlaylist(editingPlaylistId, { name: editingPlaylistName.trim() });
    toast.success("Playlist renommée");
    setEditingPlaylistId(null);
    setEditingPlaylistName("");
  };

  const toggleSort = (column: typeof tableSortBy) => {
    if (tableSortBy === column) {
      setTableSortOrder(tableSortOrder === "asc" ? "desc" : "asc");
    } else {
      setTableSortBy(column);
      setTableSortOrder("asc");
    }
  };

  const toggleSelectAll = () => {
    if (selectedTracksForPlaylist.length === filteredAndSortedTracks.length) {
      setSelectedTracksForPlaylist([]);
    } else {
      setSelectedTracksForPlaylist(filteredAndSortedTracks.map(t => t.id));
    }
  };

  const resetFilters = () => {
    setTableSearchQuery("");
    setFilterArtist(null);
    setFilterAlbum(null);
  };

  // Create Playlist Page
  if (pageMode === "create") {
    const allSelected = filteredAndSortedTracks.length > 0 && 
      selectedTracksForPlaylist.length === filteredAndSortedTracks.length;

    return (
      <PageContainer>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-slate-900 via-background to-black/60 shadow-lg p-5">
            <div className="absolute -left-10 -top-10 h-40 w-40 bg-fuchsia-500/15 blur-3xl" aria-hidden="true" />
            <div className="absolute right-0 top-0 h-32 w-32 bg-cyan-400/15 blur-3xl" aria-hidden="true" />
            <div className="relative flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setPageMode("list");
                  setNewPlaylistName("");
                  setSelectedTracksForPlaylist([]);
                  resetFilters();
                }}
                className="bg-white/5 text-white border border-white/10"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold font-display text-white">Nouvelle playlist</h1>
                <p className="text-sm text-white/70">Assemblez un set ultra-moderne en quelques clics</p>
              </div>
              <Badge variant="secondary" className="ml-auto bg-white/10 text-white border-white/20">Mode création</Badge>
            </div>
          </div>

          {/* Playlist Name */}
          <GlassCard className="p-6">
            <Label htmlFor="playlist-name" className="text-sm font-medium mb-2 block">
              Nom de la playlist
            </Label>
            <Input
              id="playlist-name"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="Ma nouvelle playlist"
              autoFocus
              className="text-lg max-w-md"
            />
          </GlassCard>

          {/* Track Selection */}
          <GlassCard className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Sélectionner des titres</h2>
              <Badge variant="secondary">
                {selectedTracksForPlaylist.length} sélectionné{selectedTracksForPlaylist.length > 1 ? "s" : ""}
              </Badge>
            </div>

            {/* Filters */}
            <Toolbar>
              <SearchBar
                value={tableSearchQuery}
                onChange={setTableSearchQuery}
                placeholder="Rechercher..."
              />
              
              <Select value={filterArtist || "__all__"} onValueChange={(v) => setFilterArtist(v === "__all__" ? null : v)}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Artiste" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tous</SelectItem>
                  {uniqueArtists.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterAlbum || "__all__"} onValueChange={(v) => setFilterAlbum(v === "__all__" ? null : v)}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Album" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tous</SelectItem>
                  {uniqueAlbums.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>

              {(filterArtist || filterAlbum || tableSearchQuery) && (
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  <X className="w-4 h-4 mr-1" />
                  Réinitialiser
                </Button>
              )}

              <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
              </Button>
            </Toolbar>

            {/* Track Table */}
            <ScrollArea className="h-[400px] rounded-lg border border-border/30">
              <table className="w-full">
                <thead className="sticky top-0 bg-background/95 backdrop-blur-md z-10">
                  <tr className="border-b border-border/30">
                    <th className="px-4 py-3 w-12">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleSelectAll}
                      />
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground"
                      onClick={() => toggleSort("title")}
                    >
                      <div className="flex items-center gap-2">
                        Titre
                        {tableSortBy === "title" && (
                          tableSortOrder === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground"
                      onClick={() => toggleSort("artist")}
                    >
                      <div className="flex items-center gap-2">
                        Artiste
                        {tableSortBy === "artist" && (
                          tableSortOrder === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-right text-xs font-display uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground hidden md:table-cell"
                      onClick={() => toggleSort("duration")}
                    >
                      <div className="flex items-center justify-end gap-2">
                        Durée
                        {tableSortBy === "duration" && (
                          tableSortOrder === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedTracks.map((track) => (
                    <motion.tr
                      key={track.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={cn(
                        "border-b border-border/20 hover:bg-muted/30 transition-colors cursor-pointer",
                        selectedTracksForPlaylist.includes(track.id) && "bg-primary/10"
                      )}
                      onClick={() => {
                        setSelectedTracksForPlaylist(prev =>
                          prev.includes(track.id)
                            ? prev.filter(id => id !== track.id)
                            : [...prev, track.id]
                        );
                      }}
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedTracksForPlaylist.includes(track.id)}
                          onCheckedChange={() => {
                            setSelectedTracksForPlaylist(prev =>
                              prev.includes(track.id)
                                ? prev.filter(id => id !== track.id)
                                : [...prev, track.id]
                            );
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted/30">
                            <img
                              src={getCoverUrl(track.coverUrl)}
                              alt={track.album}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                          <p className="font-medium text-sm truncate">{track.title}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground truncate">{track.artist}</td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground font-mono hidden md:table-cell">
                        {formatDuration(track.duration)}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {filteredAndSortedTracks.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  Aucun titre trouvé
                </div>
              )}
            </ScrollArea>
          </GlassCard>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setPageMode("list");
                setNewPlaylistName("");
                setSelectedTracksForPlaylist([]);
                resetFilters();
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreatePlaylist}
              disabled={!newPlaylistName.trim()}
              className="gap-2"
            >
              <Check className="w-4 h-4" />
              Créer la playlist
            </Button>
          </div>
        </motion.div>
      </PageContainer>
    );
  }

  // Edit Tracks Page
  if (pageMode === "edit" && selectedPlaylist) {
    const isRemoving = selectedTracksForPlaylist.length > 0 && 
      selectedTracksForPlaylist.every(id => playlistTracks.some(t => t.id === id));
    
    const tracksToShow = isRemoving ? playlistTracks : uniqueAvailableTracks;
    
    let filteredEditTracks = tracksToShow;
    if (tableSearchQuery.trim()) {
      const query = tableSearchQuery.toLowerCase();
      filteredEditTracks = filteredEditTracks.filter(track =>
        track.title.toLowerCase().includes(query) ||
        track.artist.toLowerCase().includes(query)
      );
    }

    const allSelected = filteredEditTracks.length > 0 && 
      selectedTracksForPlaylist.length === filteredEditTracks.length;

    return (
      <PageContainer>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-slate-900 via-background to-black/60 shadow-lg p-5">
            <div className="absolute -left-10 -top-10 h-40 w-40 bg-emerald-500/15 blur-3xl" aria-hidden="true" />
            <div className="absolute right-0 top-0 h-32 w-32 bg-indigo-400/15 blur-3xl" aria-hidden="true" />
            <div className="relative flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setPageMode("detail");
                  setSelectedTracksForPlaylist([]);
                  resetFilters();
                }}
                className="bg-white/5 text-white border border-white/10"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold font-display text-white">
                  {isRemoving ? "Retirer des titres" : "Ajouter des titres"}
                </h1>
                <p className="text-sm text-white/70">{selectedPlaylist.name}</p>
              </div>
              <Badge variant="secondary" className="ml-auto bg-white/10 text-white border-white/20">
                {isRemoving ? "Nettoyage" : "Enrichissement"}
              </Badge>
            </div>
          </div>

          <GlassCard className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant={isRemoving ? "destructive" : "secondary"}>
                {selectedTracksForPlaylist.length} sélectionné{selectedTracksForPlaylist.length > 1 ? "s" : ""}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => {
                if (allSelected) {
                  setSelectedTracksForPlaylist([]);
                } else {
                  setSelectedTracksForPlaylist(filteredEditTracks.map(t => t.id));
                }
              }}>
                {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
              </Button>
            </div>

            <SearchBar
              value={tableSearchQuery}
              onChange={setTableSearchQuery}
              placeholder="Rechercher..."
            />

            <ScrollArea className="h-[400px] rounded-lg border border-border/30">
              <table className="w-full">
                <thead className="sticky top-0 bg-background/95 backdrop-blur-md z-10">
                  <tr className="border-b border-border/30">
                    <th className="px-4 py-3 w-12">
                      <Checkbox checked={allSelected} onCheckedChange={() => {
                        if (allSelected) {
                          setSelectedTracksForPlaylist([]);
                        } else {
                          setSelectedTracksForPlaylist(filteredEditTracks.map(t => t.id));
                        }
                      }} />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground">Titre</th>
                    <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground">Artiste</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEditTracks.map((track) => (
                    <tr
                      key={track.id}
                      className={cn(
                        "border-b border-border/20 hover:bg-muted/30 transition-colors cursor-pointer",
                        selectedTracksForPlaylist.includes(track.id) && (isRemoving ? "bg-destructive/10" : "bg-primary/10")
                      )}
                      onClick={() => {
                        setSelectedTracksForPlaylist(prev =>
                          prev.includes(track.id)
                            ? prev.filter(id => id !== track.id)
                            : [...prev, track.id]
                        );
                      }}
                    >
                      <td className="px-4 py-3">
                        <Checkbox checked={selectedTracksForPlaylist.includes(track.id)} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden">
                            <img src={getCoverUrl(track.coverUrl)} alt="" className="w-full h-full object-cover" />
                          </div>
                          <p className="font-medium text-sm truncate">{track.title}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{track.artist}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </GlassCard>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => {
              setPageMode("detail");
              setSelectedTracksForPlaylist([]);
              resetFilters();
            }}>
              Annuler
            </Button>
            <Button
              variant={isRemoving ? "destructive" : "default"}
              onClick={isRemoving ? handleRemoveTracks : handleAddTracks}
              disabled={selectedTracksForPlaylist.length === 0}
              className="gap-2"
            >
              {isRemoving ? <Trash2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {isRemoving ? "Retirer" : "Ajouter"}
            </Button>
          </div>
        </motion.div>
      </PageContainer>
    );
  }

  // Playlist Detail View
  if (selectedPlaylist) {
    const heroCover = playlistTracks[0]?.coverUrl ? getCoverUrl(playlistTracks[0].coverUrl) : null;
    return (
      <PageContainer>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-slate-900 via-background to-black/70 shadow-2xl">
            <div className="absolute inset-0 opacity-60" aria-hidden="true">
              <div className="absolute -left-12 -top-16 h-48 w-48 bg-fuchsia-500/15 blur-3xl" />
              <div className="absolute right-0 top-10 h-56 w-56 bg-cyan-400/15 blur-3xl" />
              <div className="absolute -right-8 bottom-0 h-48 w-48 bg-amber-400/15 blur-3xl" />
            </div>
            <div className="relative p-6 md:p-8 space-y-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex items-start gap-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedPlaylistId(null)}
                    className="bg-white/5 text-white border border-white/10"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <div className="relative w-28 h-28 rounded-2xl overflow-hidden border border-white/10 bg-white/5">
                    {heroCover ? (
                      <img src={heroCover} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/70">
                        <ListMusic className="w-10 h-10" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-transparent to-black/40" />
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  {editingPlaylistId === selectedPlaylist.id ? (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <Input
                        value={editingPlaylistName}
                        onChange={(e) => setEditingPlaylistName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit();
                          if (e.key === "Escape") {
                            setEditingPlaylistId(null);
                            setEditingPlaylistName("");
                          }
                        }}
                        className="text-xl font-bold max-w-md bg-white/5 border-white/20 text-white"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveEdit}>Enregistrer</Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          setEditingPlaylistId(null);
                          setEditingPlaylistName("");
                        }}>
                          Annuler
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <h1 className="text-3xl font-display font-bold text-white drop-shadow-sm">{selectedPlaylist.name}</h1>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditPlaylist(selectedPlaylist)}
                        className="text-white hover:bg-white/10"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  {selectedPlaylist.description && (
                    <p className="text-sm text-white/70">{selectedPlaylist.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 text-sm text-white/80">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20">
                      <Music className="w-4 h-4" />
                      {playlistTracks.length} titre{playlistTracks.length > 1 ? "s" : ""}
                    </span>
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20">
                      <Clock className="w-4 h-4" />
                      {formatDuration(playlistTracks.reduce((a, t) => a + t.duration, 0))}
                    </span>
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20">
                      <Sparkles className="w-4 h-4" />
                      Mode immersif
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => handlePlayPlaylist(selectedPlaylist.id)} disabled={playlistTracks.length === 0} className="gap-2 shadow-lg">
                  <Play className="w-4 h-4 fill-current" />
                  Lecture
                </Button>
                <Button variant="outline" onClick={() => handleShufflePlaylist(selectedPlaylist.id)} disabled={playlistTracks.length === 0} className="gap-2 bg-white/5 border-white/20 text-white hover:bg-white/10">
                  <Shuffle className="w-4 h-4" />
                  Mélanger
                </Button>
                <Button variant="outline" onClick={() => {
                  setSelectedTracksForPlaylist([]);
                  setPageMode("edit");
                }} className="gap-2 bg-white/5 border-white/20 text-white hover:bg-white/10">
                  <Plus className="w-4 h-4" />
                  Ajouter
                </Button>
                {playlistTracks.length > 0 && (
                  <Button variant="outline" onClick={() => {
                    setSelectedTracksForPlaylist(playlistTracks.map(t => t.id));
                    setPageMode("edit");
                  }} className="gap-2 bg-white/5 border-white/20 text-white hover:bg-white/10">
                    <X className="w-4 h-4" />
                    Retirer
                  </Button>
                )}
                <Button variant="destructive" onClick={() => handleDeletePlaylist(selectedPlaylist.id)} className="gap-2">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Tracks */}
          <GlassCard className="overflow-hidden">
            {playlistTracks.length === 0 ? (
              <EmptyState
                icon={<Music className="w-10 h-10 text-primary" />}
                title="Playlist vide"
                description="Ajoutez des titres pour commencer"
                action={
                  <Button onClick={() => setPageMode("edit")} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Ajouter des titres
                  </Button>
                }
              />
            ) : (
              <>
                <div className="p-4 border-b border-border/30">
                  <ViewToggle view={viewMode} onViewChange={setViewMode} />
                </div>
                <div className="p-4">
                  {viewMode === "grid" ? (
                    <TrackGridView
                      tracks={playlistTracks}
                      currentTrackIndex={currentTrackIndex}
                      isPlaying={isPlaying}
                      onTrackSelect={(idx) => {
                        const track = playlistTracks[idx];
                        const realIdx = tracks.findIndex(t => t.id === track.id);
                        if (realIdx !== -1) onTrackSelect(realIdx);
                      }}
                      onAddToPlaylist={(pId, track) => onAddTracksToPlaylist(pId, [track.id])}
                      createPlaylist={onCreatePlaylist}
                    />
                  ) : (
                    <TrackListView
                      tracks={playlistTracks}
                      currentTrackIndex={currentTrackIndex}
                      isPlaying={isPlaying}
                      onTrackSelect={(idx) => {
                        const track = playlistTracks[idx];
                        const realIdx = tracks.findIndex(t => t.id === track.id);
                        if (realIdx !== -1) onTrackSelect(realIdx);
                      }}
                      onAddToPlaylist={(pId, track) => onAddTracksToPlaylist(pId, [track.id])}
                      createPlaylist={onCreatePlaylist}
                      showRemoveFromPlaylist
                      onRemoveFromPlaylist={(track) => onRemoveTracksFromPlaylist(selectedPlaylist.id, [track.id])}
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
                </div>
              </>
            )}
          </GlassCard>
        </motion.div>
      </PageContainer>
    );
  }

  // Playlists List (Main View)
  return (
    <PageContainer>
      <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-br from-slate-900 via-background to-slate-900/60 shadow-2xl mb-8">
        <div className="absolute inset-0 opacity-50" aria-hidden="true">
          <div className="absolute -left-10 -top-20 h-64 w-64 bg-fuchsia-500/20 blur-3xl" />
          <div className="absolute right-10 top-10 h-52 w-52 bg-cyan-400/15 blur-3xl" />
          <div className="absolute -right-10 bottom-0 h-72 w-72 bg-amber-400/10 blur-3xl" />
        </div>
        <div className="relative p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs uppercase tracking-[0.15em] text-white/80">
                <Sparkles className="w-4 h-4" />
                Mixs sur-mesure
              </div>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-white drop-shadow-sm">Playlists</h1>
              <p className="text-sm text-white/70">
                {`${playlists.length} playlist${playlists.length > 1 ? "s" : ""} • ${totalTracks} titres en rotation`}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="secondary" className="bg-white/10 text-white border-white/20">Smart order</Badge>
                <Badge variant="secondary" className="bg-white/10 text-white border-white/20">Sync cloud</Badge>
                <Badge variant="secondary" className="bg-white/10 text-white border-white/20">Hi-fi ready</Badge>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                className="bg-white/5 text-white border-white/20 hover:bg-white/10"
                onClick={() => setSearchQuery("")}
              >
                <Filter className="w-4 h-4 mr-2" />
                Nettoyer les filtres
              </Button>
              <Button onClick={() => setPageMode("create")} className="gap-2 shadow-lg">
                <Plus className="w-4 h-4" />
                Nouvelle playlist
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard icon={ListMusic} label="Playlists" value={playlists.length} color="bg-white/5 text-white" />
            <StatCard icon={Music} label="Titres" value={totalTracks} color="bg-white/5 text-white" />
            <StatCard icon={Heart} label="Favoris" value={playlists.filter(p => p.trackIds.length > 5).length} color="bg-white/5 text-white" />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <Toolbar className="mb-6">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Rechercher une playlist..."
        />
        <div className="flex items-center gap-2">
          <ViewToggle view={viewMode} onViewChange={setViewMode} />
          <Badge variant="outline" className="border-dashed border-primary/40 text-primary bg-primary/5">Vue dynamique</Badge>
        </div>
      </Toolbar>

      {/* Loading */}
      {loading ? (
        viewMode === "grid" ? <AlbumGridSkeleton count={12} /> : <TrackTableSkeleton count={8} />
      ) : filteredPlaylists.length === 0 ? (
        <EmptyState
          icon={<ListMusic className="w-10 h-10 text-primary" />}
          title={searchQuery ? "Aucune playlist trouvée" : "Aucune playlist"}
          description={searchQuery ? "Essayez une autre recherche" : "Créez votre première playlist"}
          action={
            !searchQuery && (
              <Button onClick={() => setPageMode("create")} className="gap-2">
                <Plus className="w-4 h-4" />
                Créer une playlist
              </Button>
            )
          }
        />
      ) : viewMode === "grid" ? (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {filteredPlaylists.map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                tracks={tracks}
                onSelect={() => setSelectedPlaylistId(playlist.id)}
                onPlay={() => handlePlayPlaylist(playlist.id)}
                onShuffle={() => handleShufflePlaylist(playlist.id)}
                onEdit={() => handleEditPlaylist(playlist)}
                onDelete={() => handleDeletePlaylist(playlist.id)}
                canUpload={canUploadToCloudinary}
                onUpload={() => {
                  const pTracks = playlist.trackIds
                    .map(id => tracks.find(t => t.id === id))
                    .filter((t): t is Track => !!t);
                  uploadPlaylist(pTracks);
                }}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-2"
        >
          {filteredPlaylists.map((playlist) => {
            const pTracks = playlist.trackIds
              .map(id => tracks.find(t => t.id === id))
              .filter((t): t is Track => !!t);
            const coverUrl = pTracks[0]?.coverUrl ? getCoverUrl(pTracks[0].coverUrl) : null;

            return (
              <motion.div
                key={playlist.id}
                variants={itemVariants}
                whileHover={{ x: 4 }}
              >
                <PlaylistContextMenu
                  playlist={playlist}
                  onPlay={() => handlePlayPlaylist(playlist.id)}
                  onShuffle={() => handleShufflePlaylist(playlist.id)}
                  onEdit={() => handleEditPlaylist(playlist)}
                  onDelete={() => handleDeletePlaylist(playlist.id)}
                  onView={() => setSelectedPlaylistId(playlist.id)}
                >
                  <GlassCard
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setSelectedPlaylistId(playlist.id)}
                  >
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-secondary/20 flex-shrink-0">
                      {coverUrl ? (
                        <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ListMusic className="w-6 h-6 text-primary/50" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{playlist.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {pTracks.length} titre{pTracks.length > 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayPlaylist(playlist.id);
                        }}
                      >
                        <Play className="w-4 h-4 fill-current" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShufflePlaylist(playlist.id);
                        }}
                      >
                        <Shuffle className="w-4 h-4" />
                      </Button>
                    </div>
                  </GlassCard>
                </PlaylistContextMenu>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </PageContainer>
  );
});

PlaylistView.displayName = "PlaylistView";
