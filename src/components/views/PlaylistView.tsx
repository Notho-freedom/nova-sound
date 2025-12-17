import { useState, useMemo, useCallback } from "react";
import { Plus, Music, ListMusic, Trash2, Edit, Play, Shuffle, X, Search, ArrowLeft, Check, ArrowUpDown, Filter, ChevronUp, ChevronDown, Grid, List } from "lucide-react";
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
import { PageHeader } from "@/components/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";
import { useNexusUpload } from "@/hooks/useNexusUpload";
import { useUploadedStatus } from "@/hooks/useUploadedStatus";
import { useCloudSync } from "@/hooks/useCloudSync";

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

export const PlaylistView = ({
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
  const { uploadPlaylist: uploadPlaylistToNexus, uploadTrack: uploadTrackToNexus, getTrackProgress: getNexusTrackProgress } = useNexusUpload();
  const { cloudinaryConfigured, nexusIsPro, nexusAuthenticated } = useCloudSync();
  const { isUploaded, getUploadedProvider } = useUploadedStatus();
  
  const canUploadToCloudinary = cloudinaryConfigured || nexusIsPro;
  const canUploadToNexus = nexusIsPro && nexusAuthenticated;
  
  // Table state for create/edit pages
  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const [tableSortBy, setTableSortBy] = useState<"title" | "artist" | "album" | "duration">("title");
  const [tableSortOrder, setTableSortOrder] = useState<"asc" | "desc">("asc");
  const [filterArtist, setFilterArtist] = useState<string | null>(null);
  const [filterAlbum, setFilterAlbum] = useState<string | null>(null);

  // Get selected playlist
  const selectedPlaylist = useMemo(() => {
    return playlists.find((p) => p.id === selectedPlaylistId) || null;
  }, [playlists, selectedPlaylistId]);

  // Get tracks for selected playlist
  const playlistTracks = useMemo(() => {
    if (!selectedPlaylist) return [];
    return selectedPlaylist.trackIds
      .map((id) => tracks.find((t) => t.id === id))
      .filter((t): t is Track => !!t);
  }, [selectedPlaylist, tracks]);

  // Filter playlists by search query
  const filteredPlaylists = useMemo(() => {
    if (!searchQuery.trim()) return playlists;
    const query = searchQuery.toLowerCase();
    return playlists.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
    );
  }, [playlists, searchQuery]);

  // Filter tracks for add/remove modals
  const availableTracks = useMemo(() => {
    if (!selectedPlaylist) return tracks;
    return tracks.filter((t) => !selectedPlaylist.trackIds.includes(t.id));
  }, [tracks, selectedPlaylist]);

  // Deduplicate tracks by ID for modals to avoid duplicate keys
  const uniqueTracks = useMemo(() => {
    const seen = new Set<string>();
    return tracks.filter((track) => {
      if (seen.has(track.id)) {
        return false;
      }
      seen.add(track.id);
      return true;
    });
  }, [tracks]);

  const uniqueAvailableTracks = useMemo(() => {
    const seen = new Set<string>();
    return availableTracks.filter((track) => {
      if (seen.has(track.id)) {
        return false;
      }
      seen.add(track.id);
      return true;
    });
  }, [availableTracks]);

  // Get unique artists and albums for filters
  const uniqueArtists = useMemo(() => {
    const artists = new Set<string>();
    uniqueTracks.forEach(track => {
      if (track.artist) artists.add(track.artist);
    });
    return Array.from(artists).sort();
  }, [uniqueTracks]);

  const uniqueAlbums = useMemo(() => {
    const albums = new Set<string>();
    uniqueTracks.forEach(track => {
      if (track.album) albums.add(track.album);
    });
    return Array.from(albums).sort();
  }, [uniqueTracks]);

  // Filtered and sorted tracks for table
  const filteredAndSortedTracks = useMemo(() => {
    let filtered = uniqueTracks;

    // Apply search filter
    if (tableSearchQuery.trim()) {
      const query = tableSearchQuery.toLowerCase();
      filtered = filtered.filter(track =>
        track.title.toLowerCase().includes(query) ||
        track.artist.toLowerCase().includes(query) ||
        track.album.toLowerCase().includes(query)
      );
    }

    // Apply artist filter
    if (filterArtist) {
      filtered = filtered.filter(track => track.artist === filterArtist);
    }

    // Apply album filter
    if (filterAlbum) {
      filtered = filtered.filter(track => track.album === filterAlbum);
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (tableSortBy) {
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "artist":
          comparison = a.artist.localeCompare(b.artist);
          break;
        case "album":
          comparison = a.album.localeCompare(b.album);
          break;
        case "duration":
          comparison = a.duration - b.duration;
          break;
      }
      return tableSortOrder === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [uniqueTracks, tableSearchQuery, filterArtist, filterAlbum, tableSortBy, tableSortOrder]);

  // Filtered tracks for edit page
  const filteredAndSortedEditTracks = useMemo(() => {
    const tracksToFilter = pageMode === "edit" && selectedPlaylist
      ? (selectedTracksForPlaylist.length > 0 && 
         selectedTracksForPlaylist.every(id => playlistTracks.some(t => t.id === id))
         ? playlistTracks 
         : uniqueAvailableTracks)
      : uniqueTracks;

    let filtered = tracksToFilter;

    // Apply search filter
    if (tableSearchQuery.trim()) {
      const query = tableSearchQuery.toLowerCase();
      filtered = filtered.filter(track =>
        track.title.toLowerCase().includes(query) ||
        track.artist.toLowerCase().includes(query) ||
        track.album.toLowerCase().includes(query)
      );
    }

    // Apply artist filter
    if (filterArtist) {
      filtered = filtered.filter(track => track.artist === filterArtist);
    }

    // Apply album filter
    if (filterAlbum) {
      filtered = filtered.filter(track => track.album === filterAlbum);
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (tableSortBy) {
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "artist":
          comparison = a.artist.localeCompare(b.artist);
          break;
        case "album":
          comparison = a.album.localeCompare(b.album);
          break;
        case "duration":
          comparison = a.duration - b.duration;
          break;
      }
      return tableSortOrder === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [pageMode, selectedPlaylist, playlistTracks, uniqueAvailableTracks, uniqueTracks, selectedTracksForPlaylist, tableSearchQuery, filterArtist, filterAlbum, tableSortBy, tableSortOrder]);

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    const playlist = await onCreatePlaylist(newPlaylistName.trim(), selectedTracksForPlaylist);
    if (playlist) {
      toast.success("Playlist créée");
      setPageMode("list");
      setNewPlaylistName("");
      setSelectedTracksForPlaylist([]);
      setSelectedPlaylistId(playlist.id);
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    if (confirm(`Supprimer la playlist "${playlists.find((p) => p.id === id)?.name}" ?`)) {
      await onDeletePlaylist(id);
      toast.success("Playlist supprimée");
      if (selectedPlaylistId === id) {
        setSelectedPlaylistId(null);
      }
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

  const handlePlayPlaylist = (playlistId: string) => {
    const playlist = playlists.find((p) => p.id === playlistId);
    if (playlist && playlist.trackIds.length > 0 && onPlayTracks) {
      onPlayTracks(playlist.trackIds);
    }
  };

  const handleShufflePlaylist = (playlistId: string) => {
    const playlist = playlists.find((p) => p.id === playlistId);
    if (playlist && playlist.trackIds.length > 0 && onShuffleTracks) {
      onShuffleTracks(playlist.trackIds);
    }
  };

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

  // Helper function to toggle sort
  const toggleSort = (column: typeof tableSortBy) => {
    if (tableSortBy === column) {
      setTableSortOrder(tableSortOrder === "asc" ? "desc" : "asc");
    } else {
      setTableSortBy(column);
      setTableSortOrder("asc");
    }
  };

  // Helper function to select/deselect all
  const toggleSelectAll = () => {
    if (selectedTracksForPlaylist.length === filteredAndSortedTracks.length) {
      setSelectedTracksForPlaylist([]);
    } else {
      setSelectedTracksForPlaylist(filteredAndSortedTracks.map(t => t.id));
    }
  };

  // Show create playlist page with advanced table
  if (pageMode === "create") {
    const allSelected = filteredAndSortedTracks.length > 0 && 
      selectedTracksForPlaylist.length === filteredAndSortedTracks.length;
    const someSelected = selectedTracksForPlaylist.length > 0 && !allSelected;

    return (
      <div className="h-full flex flex-col animate-in fade-in duration-300">
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              onClick={() => {
                setPageMode("list");
                setNewPlaylistName("");
                setSelectedTracksForPlaylist([]);
                setTableSearchQuery("");
                setFilterArtist(null);
                setFilterAlbum(null);
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
          </div>
          <PageHeader
            title="Créer une nouvelle playlist"
            subtitle="Donnez un nom à votre playlist et ajoutez des titres"
          />
        </div>
        <div className="flex-1 overflow-auto">
          <div className="p-6 space-y-6">
            {/* Playlist Name Input */}
            <div className="space-y-2">
              <Label htmlFor="playlist-name">Nom de la playlist</Label>
              <Input
                id="playlist-name"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Ma nouvelle playlist"
                autoFocus
                className="text-lg max-w-md"
              />
            </div>

            {/* Filters and Search Bar */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={tableSearchQuery}
                    onChange={(e) => setTableSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Artist Filter */}
                <Select value={filterArtist || "__all__"} onValueChange={(value) => setFilterArtist(value === "__all__" ? null : value)}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Artiste" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tous les artistes</SelectItem>
                    {uniqueArtists.map(artist => (
                      <SelectItem key={artist} value={artist}>{artist}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Album Filter */}
                <Select value={filterAlbum || "__all__"} onValueChange={(value) => setFilterAlbum(value === "__all__" ? null : value)}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Album" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tous les albums</SelectItem>
                    {uniqueAlbums.map(album => (
                      <SelectItem key={album} value={album}>{album}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Clear Filters */}
                {(filterArtist || filterAlbum || tableSearchQuery) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setTableSearchQuery("");
                      setFilterArtist(null);
                      setFilterAlbum(null);
                    }}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Réinitialiser
                  </Button>
                )}
              </div>

              {/* Selection Info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {selectedTracksForPlaylist.length} sélectionné{selectedTracksForPlaylist.length > 1 ? "s" : ""}
                  </Badge>
                  {filteredAndSortedTracks.length !== uniqueTracks.length && (
                    <Badge variant="outline">
                      {filteredAndSortedTracks.length} résultat{filteredAndSortedTracks.length > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                >
                  {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
                </Button>
              </div>
            </div>

            {/* Table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-auto max-h-[calc(100vh-450px)]">
                <table className="w-full">
                  <thead className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                    <tr>
                      <th className="px-4 py-3 text-left w-12 bg-muted/50">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={toggleSelectAll}
                          className={cn(someSelected && "data-[state=checked]:bg-primary/50")}
                        />
                      </th>
                      <th 
                        className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors bg-muted/50"
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
                        className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors bg-muted/50"
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
                        className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors hidden md:table-cell bg-muted/50"
                        onClick={() => toggleSort("album")}
                      >
                        <div className="flex items-center gap-2">
                          Album
                          {tableSortBy === "album" && (
                            tableSortOrder === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-right text-xs font-display uppercase tracking-widest text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors bg-muted/50"
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
                      <tr
                        key={track.id}
                        className={cn(
                          "border-b border-border/30 hover:bg-muted/30 transition-colors",
                          selectedTracksForPlaylist.includes(track.id) && "bg-primary/5"
                        )}
                      >
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedTracksForPlaylist.includes(track.id)}
                            onCheckedChange={() => {
                              setSelectedTracksForPlaylist((prev) =>
                                prev.includes(track.id)
                                  ? prev.filter((id) => id !== track.id)
                                  : [...prev, track.id]
                              );
                            }}
                          />
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
                              <p className="text-sm font-medium truncate">{track.title}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <p className="text-sm text-muted-foreground truncate">{track.album}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-muted-foreground font-mono">{formatDuration(track.duration)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredAndSortedTracks.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  Aucun titre trouvé
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setPageMode("list");
                  setNewPlaylistName("");
                  setSelectedTracksForPlaylist([]);
                  setTableSearchQuery("");
                  setFilterArtist(null);
                  setFilterAlbum(null);
                }}
              >
                Annuler
              </Button>
              <Button
                onClick={handleCreatePlaylist}
                disabled={!newPlaylistName.trim()}
              >
                <Check className="w-4 h-4 mr-2" />
                Créer la playlist
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show edit tracks page (add/remove) with advanced table
  if (pageMode === "edit" && selectedPlaylist) {
    const isRemoving = selectedTracksForPlaylist.length > 0 && 
      selectedTracksForPlaylist.every(id => playlistTracks.some(t => t.id === id));
    
    // Get unique artists and albums for edit page filters
    const editUniqueArtists = useMemo(() => {
      const artists = new Set<string>();
      filteredAndSortedEditTracks.forEach(track => {
        if (track.artist) artists.add(track.artist);
      });
      return Array.from(artists).sort();
    }, [filteredAndSortedEditTracks]);

    const editUniqueAlbums = useMemo(() => {
      const albums = new Set<string>();
      filteredAndSortedEditTracks.forEach(track => {
        if (track.album) albums.add(track.album);
      });
      return Array.from(albums).sort();
    }, [filteredAndSortedEditTracks]);

    const allSelected = filteredAndSortedEditTracks.length > 0 && 
      selectedTracksForPlaylist.length === filteredAndSortedEditTracks.length;
    const someSelected = selectedTracksForPlaylist.length > 0 && !allSelected;

    const toggleSelectAllEdit = () => {
      if (allSelected) {
        setSelectedTracksForPlaylist([]);
      } else {
        setSelectedTracksForPlaylist(filteredAndSortedEditTracks.map(t => t.id));
      }
    };

    return (
      <div className="h-full flex flex-col animate-in fade-in duration-300">
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              onClick={() => {
                setPageMode("list");
                setSelectedTracksForPlaylist([]);
                setTableSearchQuery("");
                setFilterArtist(null);
                setFilterAlbum(null);
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
          </div>
          <PageHeader
            title={isRemoving ? "Retirer des titres" : "Ajouter des titres"}
            subtitle={`${isRemoving ? "Retirer" : "Ajouter"} des titres à "${selectedPlaylist.name}"`}
          />
        </div>
        <div className="flex-1 overflow-auto">
          <div className="p-6 space-y-6">
            {/* Filters and Search Bar */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={tableSearchQuery}
                    onChange={(e) => setTableSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Artist Filter */}
                <Select value={filterArtist || "__all__"} onValueChange={(value) => setFilterArtist(value === "__all__" ? null : value)}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Artiste" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tous les artistes</SelectItem>
                    {editUniqueArtists.map(artist => (
                      <SelectItem key={artist} value={artist}>{artist}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Album Filter */}
                <Select value={filterAlbum || "__all__"} onValueChange={(value) => setFilterAlbum(value === "__all__" ? null : value)}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Album" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tous les albums</SelectItem>
                    {editUniqueAlbums.map(album => (
                      <SelectItem key={album} value={album}>{album}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Clear Filters */}
                {(filterArtist || filterAlbum || tableSearchQuery) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setTableSearchQuery("");
                      setFilterArtist(null);
                      setFilterAlbum(null);
                    }}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Réinitialiser
                  </Button>
                )}
              </div>

              {/* Selection Info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={isRemoving ? "destructive" : "secondary"}>
                    {selectedTracksForPlaylist.length} sélectionné{selectedTracksForPlaylist.length > 1 ? "s" : ""}
                  </Badge>
                  {filteredAndSortedEditTracks.length !== (isRemoving ? playlistTracks.length : uniqueAvailableTracks.length) && (
                    <Badge variant="outline">
                      {filteredAndSortedEditTracks.length} résultat{filteredAndSortedEditTracks.length > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAllEdit}
                >
                  {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
                </Button>
              </div>
            </div>

            {/* Table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-auto max-h-[calc(100vh-450px)]">
                <table className="w-full">
                  <thead className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                    <tr>
                      <th className="px-4 py-3 text-left w-12 bg-muted/50">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={toggleSelectAllEdit}
                          className={cn(someSelected && "data-[state=checked]:bg-primary/50")}
                        />
                      </th>
                      <th 
                        className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors bg-muted/50"
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
                        className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors bg-muted/50"
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
                        className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors hidden md:table-cell bg-muted/50"
                        onClick={() => toggleSort("album")}
                      >
                        <div className="flex items-center gap-2">
                          Album
                          {tableSortBy === "album" && (
                            tableSortOrder === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-right text-xs font-display uppercase tracking-widest text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors bg-muted/50"
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
                    {filteredAndSortedEditTracks.map((track) => (
                      <tr
                        key={track.id}
                        className={cn(
                          "border-b border-border/30 hover:bg-muted/30 transition-colors",
                          selectedTracksForPlaylist.includes(track.id) && (isRemoving ? "bg-destructive/5" : "bg-primary/5")
                        )}
                      >
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedTracksForPlaylist.includes(track.id)}
                            onCheckedChange={() => {
                              setSelectedTracksForPlaylist((prev) =>
                                prev.includes(track.id)
                                  ? prev.filter((id) => id !== track.id)
                                  : [...prev, track.id]
                              );
                            }}
                          />
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
                              <p className="text-sm font-medium truncate">{track.title}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <p className="text-sm text-muted-foreground truncate">{track.album}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-muted-foreground font-mono">{formatDuration(track.duration)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredAndSortedEditTracks.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  Aucun titre trouvé
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setPageMode("list");
                  setSelectedTracksForPlaylist([]);
                  setTableSearchQuery("");
                  setFilterArtist(null);
                  setFilterAlbum(null);
                }}
              >
                Annuler
              </Button>
              <Button
                variant={isRemoving ? "destructive" : "default"}
                onClick={isRemoving ? handleRemoveTracks : handleAddTracks}
                disabled={selectedTracksForPlaylist.length === 0}
              >
                {isRemoving ? (
                  <>
                    <X className="w-4 h-4 mr-2" />
                    Retirer {selectedTracksForPlaylist.length > 0 && `(${selectedTracksForPlaylist.length})`}
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Ajouter {selectedTracksForPlaylist.length > 0 && `(${selectedTracksForPlaylist.length})`}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If a playlist is selected, show its tracks
  if (selectedPlaylist) {
    return (
      <div className="h-full flex flex-col animate-in fade-in duration-300">
        {/* Playlist Header */}
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => setSelectedPlaylistId(null)}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label="Retour aux playlists"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                {editingPlaylistId === selectedPlaylist.id ? (
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
                    className="text-2xl font-bold"
                    autoFocus
                  />
                ) : (
                  <h1 className="text-2xl font-bold font-display">{selectedPlaylist.name}</h1>
                )}
                {editingPlaylistId === selectedPlaylist.id ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveEdit}>
                      Enregistrer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingPlaylistId(null);
                        setEditingPlaylistName("");
                      }}
                    >
                      Annuler
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleEditPlaylist(selectedPlaylist)}
                    className="p-1 hover:bg-muted rounded transition-colors"
                    aria-label="Renommer la playlist"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}
              </div>
              {selectedPlaylist.description && (
                <p className="text-muted-foreground mt-1">{selectedPlaylist.description}</p>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                {playlistTracks.length} titre{playlistTracks.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              onClick={() => handlePlayPlaylist(selectedPlaylist.id)}
              disabled={playlistTracks.length === 0}
            >
              <Play className="w-4 h-4 mr-2" />
              Lire
            </Button>
            <Button
              variant="outline"
              onClick={() => handleShufflePlaylist(selectedPlaylist.id)}
              disabled={playlistTracks.length === 0}
            >
              <Shuffle className="w-4 h-4 mr-2" />
              Mélanger
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedTracksForPlaylist([]);
                setPageMode("edit");
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Ajouter des titres
            </Button>
            {playlistTracks.length > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedTracksForPlaylist(playlistTracks.map((t) => t.id));
                  setPageMode("edit");
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Retirer des titres
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={() => handleDeletePlaylist(selectedPlaylist.id)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer
            </Button>
          </div>
        </div>

        {/* Playlist Tracks */}
        <div className="flex-1 overflow-auto">
          {playlistTracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Music className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Playlist vide</h3>
              <p className="text-muted-foreground mb-4">
                Ajoutez des titres à cette playlist pour commencer.
              </p>
              <Button onClick={() => setPageMode("edit")}>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter des titres
              </Button>
            </div>
          ) : (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      viewMode === "list"
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                    aria-label="Vue liste"
                  >
                    <ListMusic className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      viewMode === "grid"
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                    aria-label="Vue grille"
                  >
                    <Music className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {viewMode === "grid" ? (
                <TrackGridView
                  tracks={playlistTracks}
                  currentTrackIndex={currentTrackIndex}
                  isPlaying={isPlaying}
                  onTrackSelect={(index) => {
                    const track = playlistTracks[index];
                    const realIndex = tracks.findIndex((t) => t.id === track.id);
                    if (realIndex !== -1) onTrackSelect(realIndex);
                  }}
                  onAddToPlaylist={(playlistId, track) => {
                    onAddTracksToPlaylist(playlistId, [track.id]);
                  }}
                  createPlaylist={onCreatePlaylist}
                />
              ) : (
                <TrackListView
                  tracks={playlistTracks}
                  currentTrackIndex={currentTrackIndex}
                  isPlaying={isPlaying}
                  onTrackSelect={(index) => {
                    const track = playlistTracks[index];
                    const realIndex = tracks.findIndex((t) => t.id === track.id);
                    if (realIndex !== -1) onTrackSelect(realIndex);
                  }}
                  onAddToPlaylist={(playlistId, track) => {
                    onAddTracksToPlaylist(playlistId, [track.id]);
                  }}
                  createPlaylist={onCreatePlaylist}
                  showRemoveFromPlaylist
                  onRemoveFromPlaylist={(track) => {
                    onRemoveTracksFromPlaylist(selectedPlaylist.id, [track.id]);
                  }}
                  uploadTrack={uploadTrack}
                  getTrackProgress={(trackId) => getTrackProgress(trackId) ?? null}
                  canUploadToCloudinary={canUploadToCloudinary}
                  uploadTrackToNexus={uploadTrackToNexus}
                  getNexusTrackProgress={(trackId) => getNexusTrackProgress(trackId) ?? null}
                  canUploadToNexus={canUploadToNexus}
                  isUploaded={isUploaded}
                  getUploadedProvider={getUploadedProvider}
                />
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show playlists grid/list
  return (
    <div className="h-full flex flex-col animate-in fade-in duration-300">
      {/* Header */}
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold font-display mb-1">Playlists</h1>
            <p className="text-muted-foreground">
              {playlists.length} playlist{playlists.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex rounded-lg bg-muted/30 p-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "p-2 rounded transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
                      viewMode === "grid"
                        ? "bg-primary/20 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-label="Vue grille"
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">Vue grille</div>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "p-2 rounded transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
                      viewMode === "list"
                        ? "bg-primary/20 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-label="Vue liste"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">Vue liste</div>
                </TooltipContent>
              </Tooltip>
            </div>
            <Button onClick={() => setPageMode("create")}>
              <Plus className="w-4 h-4 mr-2" />
              Créer une playlist
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une playlist..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Playlists Grid */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {loading ? (
            viewMode === "grid" ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="aspect-[3/4] rounded-lg bg-muted animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="h-16 rounded-lg bg-muted animate-pulse"
                  />
                ))}
              </div>
            )
          ) : filteredPlaylists.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-center">
              <Music className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? "Aucune playlist trouvée" : "Aucune playlist"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? "Essayez une autre recherche"
                  : "Créez votre première playlist pour commencer"}
              </p>
              {!searchQuery && (
                <Button onClick={() => setPageMode("create")}>
                  <Plus className="w-4 h-4 mr-2" />
                  Créer une playlist
                </Button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              {filteredPlaylists.map((playlist) => {
                const playlistTracks = playlist.trackIds
                  .map((id) => tracks.find((t) => t.id === id))
                  .filter((t): t is Track => !!t);
                const coverUrl =
                  playlistTracks.length > 0
                    ? getCoverUrl(playlistTracks[0].coverUrl)
                    : undefined;

                return (
                  <PlaylistContextMenu
                    key={playlist.id}
                    playlist={playlist}
                    onPlay={() => handlePlayPlaylist(playlist.id)}
                    onShuffle={() => handleShufflePlaylist(playlist.id)}
                    onEdit={() => handleEditPlaylist(playlist)}
                    onDelete={() => handleDeletePlaylist(playlist.id)}
                    onView={() => setSelectedPlaylistId(playlist.id)}
                    onUploadToCloudinary={() => {
                      const playlistTracks = playlist.trackIds
                        .map((id) => tracks.find((t) => t.id === id))
                        .filter((t): t is Track => !!t);
                      uploadPlaylist(playlistTracks);
                    }}
                    canUploadToCloudinary={canUploadToCloudinary && playlist.trackIds.some(id => tracks.find(t => t.id === id)?.filePath)}
                    onUploadToNexus={() => {
                      const playlistTracks = playlist.trackIds
                        .map((id) => tracks.find((t) => t.id === id))
                        .filter((t): t is Track => !!t);
                      uploadPlaylistToNexus(playlistTracks);
                    }}
                    canUploadToNexus={canUploadToNexus && playlist.trackIds.some(id => tracks.find(t => t.id === id)?.filePath)}
                  >
                    <div
                      onClick={() => setSelectedPlaylistId(playlist.id)}
                      className="group relative aspect-[3/4] rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-secondary/20 cursor-pointer transition-all hover:scale-105 hover:shadow-lg"
                    >
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt={playlist.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music className="w-10 h-10 text-primary/50" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                        <h3 className="font-semibold truncate mb-0.5 text-sm">{playlist.name}</h3>
                        <p className="text-xs text-white/80">
                          {playlistTracks.length} titre{playlistTracks.length > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  </PlaylistContextMenu>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPlaylists.map((playlist) => {
                const playlistTracks = playlist.trackIds
                  .map((id) => tracks.find((t) => t.id === id))
                  .filter((t): t is Track => !!t);
                const coverUrl =
                  playlistTracks.length > 0
                    ? getCoverUrl(playlistTracks[0].coverUrl)
                    : undefined;

                return (
                  <PlaylistContextMenu
                    key={playlist.id}
                    playlist={playlist}
                    onPlay={() => handlePlayPlaylist(playlist.id)}
                    onShuffle={() => handleShufflePlaylist(playlist.id)}
                    onEdit={() => handleEditPlaylist(playlist)}
                    onDelete={() => handleDeletePlaylist(playlist.id)}
                    onView={() => setSelectedPlaylistId(playlist.id)}
                    onUploadToCloudinary={() => {
                      const playlistTracks = playlist.trackIds
                        .map((id) => tracks.find((t) => t.id === id))
                        .filter((t): t is Track => !!t);
                      uploadPlaylist(playlistTracks);
                    }}
                    canUploadToCloudinary={canUploadToCloudinary && playlist.trackIds.some(id => tracks.find(t => t.id === id)?.filePath)}
                    onUploadToNexus={() => {
                      const playlistTracks = playlist.trackIds
                        .map((id) => tracks.find((t) => t.id === id))
                        .filter((t): t is Track => !!t);
                      uploadPlaylistToNexus(playlistTracks);
                    }}
                    canUploadToNexus={canUploadToNexus && playlist.trackIds.some(id => tracks.find(t => t.id === id)?.filePath)}
                  >
                    <div
                      onClick={() => setSelectedPlaylistId(playlist.id)}
                      className="group flex items-center gap-4 p-3 rounded-lg bg-card/30 hover:bg-card/50 border border-border/30 cursor-pointer transition-all"
                    >
                      <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary/20 to-secondary/20">
                        {coverUrl ? (
                          <img
                            src={coverUrl}
                            alt={playlist.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Music className="w-6 h-6 text-primary/50" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate mb-0.5">{playlist.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {playlistTracks.length} titre{playlistTracks.length > 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayPlaylist(playlist.id);
                          }}
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </PlaylistContextMenu>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
