import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Music, ListMusic, Check } from "lucide-react";
import { Track, Playlist } from "@/types/music";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";

interface CreatePlaylistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatePlaylist: (name: string, trackIds: string[]) => Promise<void>;
  tracks?: Track[];
  preSelectedTrackIds?: string[];
}

export const CreatePlaylistModal = ({
  open,
  onOpenChange,
  onCreatePlaylist,
  tracks = [],
  preSelectedTrackIds = [],
}: CreatePlaylistModalProps) => {
  const [name, setName] = useState("");
  const [selectedTracks, setSelectedTracks] = useState<string[]>(preSelectedTrackIds);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onCreatePlaylist(name.trim(), selectedTracks);
      setName("");
      setSelectedTracks([]);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const toggleTrack = (trackId: string) => {
    setSelectedTracks((prev) =>
      prev.includes(trackId)
        ? prev.filter((id) => id !== trackId)
        : [...prev, trackId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Nouvelle Playlist
          </DialogTitle>
          <DialogDescription>
            Créez une nouvelle playlist et ajoutez des titres.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom de la playlist</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ma nouvelle playlist"
              autoFocus
            />
          </div>

          {tracks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Ajouter des titres ({selectedTracks.length} sélectionnés)</Label>
                {selectedTracks.length > 0 && (
                  <button
                    onClick={() => setSelectedTracks([])}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Tout désélectionner
                  </button>
                )}
              </div>
              <ScrollArea className="h-[300px] rounded-lg border border-border/50">
                <div className="p-2 space-y-1">
                  {tracks.map((track) => (
                    <div
                      key={track.id}
                      onClick={() => toggleTrack(track.id)}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                        selectedTracks.includes(track.id)
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted/30"
                      )}
                    >
                      <Checkbox
                        checked={selectedTracks.includes(track.id)}
                        onCheckedChange={() => toggleTrack(track.id)}
                      />
                      <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
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
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || loading}>
            {loading ? "Création..." : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface AddToPlaylistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playlists: Playlist[];
  trackIds: string[];
  onAddToPlaylist: (playlistId: string, trackIds: string[]) => Promise<void>;
  onCreateNew: () => void;
}

export const AddToPlaylistModal = ({
  open,
  onOpenChange,
  playlists,
  trackIds,
  onAddToPlaylist,
  onCreateNew,
}: AddToPlaylistModalProps) => {
  const [loading, setLoading] = useState<string | null>(null);

  const handleAdd = async (playlistId: string) => {
    setLoading(playlistId);
    try {
      await onAddToPlaylist(playlistId, trackIds);
      onOpenChange(false);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListMusic className="w-5 h-5 text-primary" />
            Ajouter à une playlist
          </DialogTitle>
          <DialogDescription>
            Sélectionnez une playlist ou créez-en une nouvelle.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <button
            onClick={onCreateNew}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-medium">Créer une nouvelle playlist</span>
          </button>

          {playlists.length > 0 && (
            <div className="mt-4 space-y-2">
              <Label className="text-muted-foreground">Playlists existantes</Label>
              <ScrollArea className="h-[250px]">
                <div className="space-y-1 pr-4">
                  {playlists.map((playlist) => (
                    <button
                      key={playlist.id}
                      onClick={() => handleAdd(playlist.id)}
                      disabled={loading !== null}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
                        "hover:bg-muted/30 disabled:opacity-50"
                      )}
                    >
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                        <Music className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium">{playlist.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {playlist.trackIds.length} titres
                        </p>
                      </div>
                      {loading === playlist.id && (
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {playlists.length === 0 && (
            <div className="mt-4 text-center py-8 text-muted-foreground">
              <ListMusic className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aucune playlist existante</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

