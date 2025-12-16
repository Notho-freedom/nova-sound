import { useState, useMemo, useCallback } from "react";
import { Plus, Music, ListMusic, Trash2, Edit, Play, Shuffle, X, Search, ArrowLeft, Check } from "lucide-react";
import { Track, Playlist } from "@/types/music";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PlaylistContextMenu } from "@/components/PlaylistContextMenu";
import { TrackGridView } from "@/components/TrackGridView";
import { TrackListView } from "@/components/TrackListView";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";

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
    setShowAddTracksModal(false);
    setSelectedTracksForPlaylist([]);
  };

  const handleRemoveTracks = async () => {
    if (!selectedPlaylistId || selectedTracksForPlaylist.length === 0) return;
    await onRemoveTracksFromPlaylist(selectedPlaylistId, selectedTracksForPlaylist);
    toast.success(`${selectedTracksForPlaylist.length} titre(s) retiré(s)`);
    setShowRemoveTracksModal(false);
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

  // Show create playlist page
  if (pageMode === "create") {
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
          <div className="p-6 space-y-6 max-w-4xl mx-auto">
            <div className="space-y-2">
              <Label htmlFor="playlist-name">Nom de la playlist</Label>
              <Input
                id="playlist-name"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Ma nouvelle playlist"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newPlaylistName.trim()) {
                    handleCreatePlaylist();
                  }
                }}
                className="text-lg"
              />
            </div>

            {uniqueTracks.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>
                    Ajouter des titres ({selectedTracksForPlaylist.length} sélectionné
                    {selectedTracksForPlaylist.length > 1 ? "s" : ""})
                  </Label>
                </div>
                <div className="border rounded-lg">
                  <ScrollArea className="h-[500px]">
                    <div className="p-4 space-y-2">
                      {uniqueTracks.map((track) => (
                        <div
                          key={track.id}
                          onClick={() => {
                            setSelectedTracksForPlaylist((prev) =>
                              prev.includes(track.id)
                                ? prev.filter((id) => id !== track.id)
                                : [...prev, track.id]
                            );
                          }}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                            selectedTracksForPlaylist.includes(track.id)
                              ? "bg-primary/10 border border-primary/30"
                              : "hover:bg-muted/30"
                          )}
                        >
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
                          <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
                            <img
                              src={getCoverUrl(track.coverUrl)}
                              alt={track.album}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{track.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setPageMode("list");
                  setNewPlaylistName("");
                  setSelectedTracksForPlaylist([]);
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

  // Show edit tracks page (add/remove)
  if (pageMode === "edit" && selectedPlaylist) {
    const isRemoving = selectedTracksForPlaylist.length > 0 && 
      selectedTracksForPlaylist.every(id => playlistTracks.some(t => t.id === id));
    const tracksToShow = isRemoving ? playlistTracks : uniqueAvailableTracks;

    return (
      <div className="h-full flex flex-col animate-in fade-in duration-300">
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              onClick={() => {
                setPageMode("list");
                setSelectedTracksForPlaylist([]);
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
          <div className="p-6 space-y-6 max-w-4xl mx-auto">
            <div className="border rounded-lg">
              <ScrollArea className="h-[500px]">
                <div className="p-4 space-y-2">
                  {tracksToShow.map((track) => (
                    <div
                      key={track.id}
                      onClick={() => {
                        setSelectedTracksForPlaylist((prev) =>
                          prev.includes(track.id)
                            ? prev.filter((id) => id !== track.id)
                            : [...prev, track.id]
                        );
                      }}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                        selectedTracksForPlaylist.includes(track.id)
                          ? isRemoving
                            ? "bg-destructive/10 border border-destructive/30"
                            : "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted/30"
                      )}
                    >
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
                      <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
                        <img
                          src={getCoverUrl(track.coverUrl)}
                          alt={track.album}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{track.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setPageMode("list");
                  setSelectedTracksForPlaylist([]);
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
              <Button onClick={() => setShowAddTracksModal(true)}>
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
          <Button onClick={() => setPageMode("create")}>
            <Plus className="w-4 h-4 mr-2" />
            Créer une playlist
          </Button>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-lg bg-muted animate-pulse"
                />
              ))}
            </div>
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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                  >
                    <div
                      onClick={() => setSelectedPlaylistId(playlist.id)}
                      className="group relative aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-secondary/20 cursor-pointer transition-all hover:scale-105 hover:shadow-lg"
                    >
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt={playlist.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music className="w-16 h-16 text-primary/50" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                        <h3 className="font-semibold truncate mb-1">{playlist.name}</h3>
                        <p className="text-sm text-white/80">
                          {playlistTracks.length} titre{playlistTracks.length > 1 ? "s" : ""}
                        </p>
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
