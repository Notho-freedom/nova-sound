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
  HardDrive,
  Crown,
} from "lucide-react";
import { Track, Playlist } from "@/types/music";
import { openProUploadCta } from "@/lib/pro-upload-cta";

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
  onUploadToBunny?: () => void;
  canUploadToBunny?: boolean;
  isUploadingToBunny?: boolean;
  onUploadToNexus?: () => void;
  canUploadToNexus?: boolean;
  isUploadingToNexus?: boolean;
  onUploadToLocal?: () => void;
  canUploadToLocal?: boolean;
  isUploadingToLocal?: boolean;
  // New optional upload state helpers
  // Accept either a boolean (already-evaluated) or a function that can be called with a trackId
  isUploaded?: boolean | ((trackId: string) => boolean);
  getUploadedProvider?: (trackId: string) => "cloudinary" | "nexus" | "bunny" | "planethoster" | null;
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
  onUploadToBunny,
  canUploadToBunny = false,
  isUploadingToBunny = false,
  onUploadToNexus,
  canUploadToNexus = false,
  isUploadingToNexus = false,
  onUploadToLocal,
  canUploadToLocal = false,
  isUploadingToLocal = false,
  isUploaded,
  getUploadedProvider,
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

        <ContextMenuItem onClick={() => {
          try {
            // Cache la track YouTube pour la rendre persistante si besoin
            if (track.mediaSource === 'youtube') {
              // Importer dynamiquement pour éviter d'alourdir le bundle
              import('@/lib/youtube-track-cache').then(({ cacheYouTubeTrack }) => {
                try { cacheYouTubeTrack(track); } catch (e) { /* ignore */ }
              }).catch(() => {});
            }
          } catch (e) {
            // Ignore les erreurs de cache
          }
          onToggleFavorite();
        }}>
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

        {onUploadToCloudinary || onUploadToBunny || onUploadToNexus || onUploadToLocal ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <Cloud className="w-4 h-4 mr-2" />
                Uploader
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-56">
                {onUploadToCloudinary && (
                  <ContextMenuItem 
                    onClick={canUploadToCloudinary ? onUploadToCloudinary : () => openProUploadCta({ server: "cloudinary" })}
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
                        Cloudinary (Serveur 0)
                        <Crown className="w-3.5 h-3.5 ml-1 text-amber-400" />
                      </>
                    )}
                  </ContextMenuItem>
                )}
                {onUploadToBunny && (
                  <ContextMenuItem 
                    onClick={canUploadToBunny ? onUploadToBunny : () => openProUploadCta({ server: "bunny" })}
                    disabled={isUploadingToBunny}
                  >
                    {isUploadingToBunny ? (
                      <>
                        <Zap className="w-4 h-4 mr-2 animate-pulse" />
                        Upload vers Bunny...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Bunny (Serveur 1)
                        <Crown className="w-3.5 h-3.5 ml-1 text-amber-400" />
                      </>
                    )}
                  </ContextMenuItem>
                )}
                {onUploadToNexus && (
                  <>
                    <ContextMenuItem 
                      onClick={canUploadToNexus ? onUploadToNexus : () => openProUploadCta({ server: "planethoster" })}
                      disabled={isUploadingToNexus}
                    >
                      {isUploadingToNexus ? (
                        <>
                          <Server className="w-4 h-4 mr-2 animate-pulse" />
                          Upload vers PlanetHoster...
                        </>
                      ) : (
                        <>
                          <Server className="w-4 h-4 mr-2" />
                          PlanetHoster (Serveur 2)
                          <Crown className="w-3.5 h-3.5 ml-1 text-amber-400" />
                        </>
                      )}
                    </ContextMenuItem>
                  </>
                )}
                {onUploadToLocal && (
                  <ContextMenuItem 
                    onClick={onUploadToLocal}
                    disabled={isUploadingToLocal || !canUploadToLocal}
                  >
                    {isUploadingToLocal ? (
                      <>
                        <HardDrive className="w-4 h-4 mr-2 animate-pulse" />
                        Upload local...
                      </>
                    ) : (
                      <>
                        <HardDrive className="w-4 h-4 mr-2" />
                        Local (Serveur 3) — stockage local
                      </>
                    )}
                  </ContextMenuItem>
                )}
              </ContextMenuSubContent>
            </ContextMenuSub>
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

