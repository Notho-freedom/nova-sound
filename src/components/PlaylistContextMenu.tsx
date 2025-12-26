import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Play,
  Shuffle,
  Edit,
  Trash2,
  Share2,
  MoreHorizontal,
  ListMusic,
  Cloud,
  Zap,
  Heart,
} from "lucide-react";
import { Playlist } from "@/types/music";

interface PlaylistContextMenuProps {
  playlist: Playlist;
  children: React.ReactNode;
  onPlay: () => void;
  onShuffle: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  onView?: () => void;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  onUploadToCloudinary?: () => void;
  canUploadToCloudinary?: boolean;
  onUploadToNexus?: () => void;
  canUploadToNexus?: boolean;
}

export const PlaylistContextMenu = ({
  playlist,
  children,
  onPlay,
  onShuffle,
  onEdit,
  onDelete,
  onShare,
  onView,
  onToggleFavorite,
  isFavorite = false,
  onUploadToCloudinary,
  canUploadToCloudinary = false,
  onUploadToNexus,
  canUploadToNexus = false,
}: PlaylistContextMenuProps) => {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {onView && (
          <ContextMenuItem onClick={onView}>
            <ListMusic className="w-4 h-4 mr-2" />
            Ouvrir la playlist
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={onPlay}>
          <Play className="w-4 h-4 mr-2" />
          Lire la playlist
        </ContextMenuItem>
        <ContextMenuItem onClick={onShuffle}>
          <Shuffle className="w-4 h-4 mr-2" />
          Lecture aléatoire
        </ContextMenuItem>

        <ContextMenuSeparator />

        {onEdit && (
          <ContextMenuItem onClick={onEdit}>
            <Edit className="w-4 h-4 mr-2" />
            Renommer
          </ContextMenuItem>
        )}
        {onShare && (
          <ContextMenuItem onClick={onShare}>
            <Share2 className="w-4 h-4 mr-2" />
            Partager
          </ContextMenuItem>
        )}
        {onToggleFavorite && (
          <ContextMenuItem onClick={onToggleFavorite}>
            <Heart
              className={`w-4 h-4 mr-2 ${isFavorite ? "fill-red-500 text-red-500" : ""}`}
            />
            {isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          </ContextMenuItem>
        )}

        {(onUploadToCloudinary || onUploadToNexus) && (
          <>
            <ContextMenuSeparator />
            {onUploadToCloudinary && canUploadToCloudinary && (
              <ContextMenuItem onClick={onUploadToCloudinary}>
                <Cloud className="w-4 h-4 mr-2" />
                Uploader la playlist vers Cloudinary
              </ContextMenuItem>
            )}
            {onUploadToNexus && canUploadToNexus && (
              <ContextMenuItem onClick={onUploadToNexus}>
                <Zap className="w-4 h-4 mr-2" />
                Uploader la playlist vers Nexus/Bunny (Pro)
              </ContextMenuItem>
            )}
          </>
        )}

        {onDelete && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};

