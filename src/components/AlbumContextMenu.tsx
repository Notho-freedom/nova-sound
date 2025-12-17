import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Play,
  Shuffle,
  ListPlus,
  Plus,
  ListMusic,
  Disc3,
  MoreHorizontal,
  Heart,
  User,
  Cloud,
  Zap,
} from "lucide-react";
import { Playlist, Track } from "@/types/music";

interface AlbumContextMenuProps {
  album: {
    name: string;
    artist: string;
    tracks: Track[];
    coverUrl?: string;
  };
  children: React.ReactNode;
  playlists: Playlist[];
  onPlay: () => void;
  onShuffle: () => void;
  onAddToQueue: () => void;
  onAddToPlaylist: (playlistId: string) => void;
  onCreatePlaylist: () => void;
  onViewAlbum?: () => void;
  onViewArtist?: () => void;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  onUploadToCloudinary?: () => void;
  canUploadToCloudinary?: boolean;
  onUploadToNexus?: () => void;
  canUploadToNexus?: boolean;
}

export const AlbumContextMenu = ({
  album,
  children,
  playlists,
  onPlay,
  onShuffle,
  onAddToQueue,
  onAddToPlaylist,
  onCreatePlaylist,
  onViewAlbum,
  onViewArtist,
  onToggleFavorite,
  isFavorite = false,
}: AlbumContextMenuProps) => {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={onPlay}>
          <Play className="w-4 h-4 mr-2" />
          Lire l'album
        </ContextMenuItem>
        <ContextMenuItem onClick={onShuffle}>
          <Shuffle className="w-4 h-4 mr-2" />
          Lecture aléatoire
        </ContextMenuItem>
        <ContextMenuItem onClick={onAddToQueue}>
          <ListPlus className="w-4 h-4 mr-2" />
          Ajouter à la file
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <ListMusic className="w-4 h-4 mr-2" />
            Ajouter à une playlist
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem onClick={onCreatePlaylist}>
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle playlist
            </ContextMenuItem>
            {playlists.length > 0 && <ContextMenuSeparator />}
            {playlists.map((playlist) => (
              <ContextMenuItem
                key={playlist.id}
                onClick={() => onAddToPlaylist(playlist.id)}
              >
                <ListMusic className="w-4 h-4 mr-2" />
                {playlist.name}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        {onToggleFavorite && (
          <ContextMenuItem onClick={onToggleFavorite}>
            <Heart
              className={`w-4 h-4 mr-2 ${isFavorite ? "fill-red-500 text-red-500" : ""}`}
            />
            {isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        {onViewAlbum && (
          <ContextMenuItem onClick={onViewAlbum}>
            <Disc3 className="w-4 h-4 mr-2" />
            Voir l'album
          </ContextMenuItem>
        )}
        {onViewArtist && (
          <ContextMenuItem onClick={onViewArtist}>
            <User className="w-4 h-4 mr-2" />
            Voir l'artiste
          </ContextMenuItem>
        )}

        {(onUploadToCloudinary || onUploadToNexus) && (
          <>
            <ContextMenuSeparator />
            {onUploadToCloudinary && canUploadToCloudinary && (
              <ContextMenuItem onClick={onUploadToCloudinary}>
                <Cloud className="w-4 h-4 mr-2" />
                Uploader l'album vers Cloudinary
              </ContextMenuItem>
            )}
            {onUploadToNexus && canUploadToNexus && (
              <ContextMenuItem onClick={onUploadToNexus}>
                <Zap className="w-4 h-4 mr-2" />
                Uploader l'album vers Nexus/Bunny (Pro)
              </ContextMenuItem>
            )}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};

