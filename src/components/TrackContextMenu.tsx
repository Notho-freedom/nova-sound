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
  ListPlus,
  Heart,
  Share2,
  Disc3,
  User,
  FolderOpen,
  Plus,
  ListMusic,
  Info,
  Trash2,
  Cloud,
  CloudOff,
  Zap,
  Server,
} from "lucide-react";
import { Track, Playlist } from "@/types/music";

interface TrackContextMenuProps {
  track: Track;
  children: React.ReactNode;
  playlists: Playlist[];
  isFavorite: boolean;
  onPlay: () => void;
  onPlayNext: () => void;
  onAddToQueue: () => void;
  onAddToPlaylist: (playlistId: string) => void;
  onCreatePlaylist: () => void;
  onToggleFavorite: () => void;
  onViewAlbum?: () => void;
  onViewArtist?: () => void;
  onShowInFolder?: () => void;
  onShowInfo?: () => void;
  onRemoveFromPlaylist?: () => void;
  onUploadToCloudinary?: () => void;
  canUploadToCloudinary?: boolean;
  isUploading?: boolean;
  onUploadToNexus?: () => void;
  canUploadToNexus?: boolean;
  isUploadingToNexus?: boolean;
}

export const TrackContextMenu = ({
  track,
  children,
  playlists,
  isFavorite,
  onPlay,
  onPlayNext,
  onAddToQueue,
  onAddToPlaylist,
  onCreatePlaylist,
  onToggleFavorite,
  onViewAlbum,
  onViewArtist,
  onShowInFolder,
  onShowInfo,
  onRemoveFromPlaylist,
  onUploadToCloudinary,
  canUploadToCloudinary = false,
  isUploading = false,
  onUploadToNexus,
  canUploadToNexus = false,
  isUploadingToNexus = false,
}: TrackContextMenuProps) => {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={onPlay}>
          <Play className="w-4 h-4 mr-2" />
          Lecture
        </ContextMenuItem>
        <ContextMenuItem onClick={onPlayNext}>
          <ListPlus className="w-4 h-4 mr-2" />
          Lire ensuite
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

        <ContextMenuItem onClick={onToggleFavorite}>
          <Heart
            className={`w-4 h-4 mr-2 ${isFavorite ? "fill-red-500 text-red-500" : ""}`}
          />
          {isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
        </ContextMenuItem>

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

        {(onShowInFolder || onShowInfo) && <ContextMenuSeparator />}

        {onShowInFolder && (
          <ContextMenuItem onClick={onShowInFolder}>
            <FolderOpen className="w-4 h-4 mr-2" />
            Afficher dans le dossier
          </ContextMenuItem>
        )}
        {onShowInfo && (
          <ContextMenuItem onClick={onShowInfo}>
            <Info className="w-4 h-4 mr-2" />
            Propriétés
          </ContextMenuItem>
        )}

        {(onUploadToCloudinary && canUploadToCloudinary) || (onUploadToNexus && canUploadToNexus) ? (
          <>
            <ContextMenuSeparator />
            {onUploadToCloudinary && canUploadToCloudinary && (
              <ContextMenuItem 
                onClick={onUploadToCloudinary}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Cloud className="w-4 h-4 mr-2 animate-pulse" />
                    Upload en cours...
                  </>
                ) : (
                  <>
                    <Cloud className="w-4 h-4 mr-2" />
                    Uploader vers Cloudinary
                  </>
                )}
              </ContextMenuItem>
            )}
            {onUploadToNexus && canUploadToNexus && (
              <ContextMenuItem 
                onClick={onUploadToNexus}
                disabled={isUploadingToNexus}
              >
                {isUploadingToNexus ? (
                  <>
                    <Zap className="w-4 h-4 mr-2 animate-pulse" />
                    Upload vers Bunny...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Uploader vers Nexus/Bunny (Pro)
                  </>
                )}
              </ContextMenuItem>
            )}
          </>
        ) : null}

        {onRemoveFromPlaylist && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={onRemoveFromPlaylist}
              className="text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Retirer de la playlist
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};

