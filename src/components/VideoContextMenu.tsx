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
  Pause,
  ListPlus,
  Heart,
  Share2,
  FolderOpen,
  Plus,
  Info,
  Trash2,
  Cloud,
  Zap,
  Server,
  Clock,
  Star,
  Download,
  ExternalLink,
  Copy,
  Film,
  Bookmark,
  BookmarkCheck,
  Eye,
  EyeOff,
  Tag,
  RotateCcw,
  Subtitles,
  Volume2,
  Crown,
} from "lucide-react";
import type { Video } from "@/types/music";
import { openProUploadCta } from "@/lib/pro-upload-cta";

interface VideoContextMenuProps {
  video: Video;
  children: React.ReactNode;
  isFavorite?: boolean;
  isInWatchlist?: boolean;
  hasWatchProgress?: boolean;
  onPlay?: () => void;
  onPlayFromStart?: () => void;
  onResume?: () => void;
  onToggleFavorite?: () => void;
  onToggleWatchlist?: () => void;
  onMarkAsWatched?: () => void;
  onMarkAsUnwatched?: () => void;
  onViewDetails?: () => void;
  onShowInFolder?: () => void;
  onCopyPath?: () => void;
  onShare?: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
  onEditMetadata?: () => void;
  onAddTag?: () => void;
  onUploadToCloudinary?: () => void;
  canUploadToCloudinary?: boolean;
  isUploadingToCloudinary?: boolean;
  onUploadToBunny?: () => void;
  canUploadToBunny?: boolean;
  isUploadingToBunny?: boolean;
  onUploadToNexus?: () => void;
  canUploadToNexus?: boolean;
  isUploadingToNexus?: boolean;
  isAuthenticated?: boolean;
  onManageSubtitles?: () => void;
  onSelectAudioTrack?: () => void;
  onRate?: (rating: number) => void;
}

export const VideoContextMenu = ({
  video,
  children,
  isFavorite = false,
  isInWatchlist = false,
  hasWatchProgress = false,
  onPlay,
  onPlayFromStart,
  onResume,
  onToggleFavorite,
  onToggleWatchlist,
  onMarkAsWatched,
  onMarkAsUnwatched,
  onViewDetails,
  onShowInFolder,
  onCopyPath,
  onShare,
  onDownload,
  onDelete,
  onEditMetadata,
  onAddTag,
  onUploadToCloudinary,
  canUploadToCloudinary = false,
  isUploadingToCloudinary = false,
  onUploadToBunny,
  canUploadToBunny = false,
  isUploadingToBunny = false,
  onUploadToNexus,
  canUploadToNexus = false,
  isUploadingToNexus = false,
  isAuthenticated = false,
  onManageSubtitles,
  onSelectAudioTrack,
  onRate,
}: VideoContextMenuProps) => {
  const uploadsEnabled = isAuthenticated === true;
  const hasLocalFile = !!video.filePath;
  const allowCta = uploadsEnabled && hasLocalFile;
  const watchProgress = video.watchProgress;
  const progressPercent = watchProgress ? Math.round(watchProgress.percentage) : 0;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        {/* Play Actions */}
        <ContextMenuItem onClick={onPlay}>
          <Play className="w-4 h-4 mr-2" />
          Lire
        </ContextMenuItem>
        
        {hasWatchProgress && watchProgress && !watchProgress.completed && (
          <ContextMenuItem onClick={onResume}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reprendre à {Math.floor(watchProgress.currentTime / 60)}:{String(Math.floor(watchProgress.currentTime % 60)).padStart(2, '0')} ({progressPercent}%)
          </ContextMenuItem>
        )}
        
        {hasWatchProgress && (
          <ContextMenuItem onClick={onPlayFromStart}>
            <Play className="w-4 h-4 mr-2" />
            Lire depuis le début
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        {/* Watchlist & Favorites */}
        <ContextMenuItem onClick={onToggleWatchlist}>
          {isInWatchlist ? (
            <>
              <BookmarkCheck className="w-4 h-4 mr-2 text-primary" />
              Retirer de Ma liste
            </>
          ) : (
            <>
              <Bookmark className="w-4 h-4 mr-2" />
              Ajouter à Ma liste
            </>
          )}
        </ContextMenuItem>

        <ContextMenuItem onClick={onToggleFavorite}>
          <Heart className={`w-4 h-4 mr-2 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
          {isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Watch Status */}
        <ContextMenuItem onClick={onMarkAsWatched}>
          <Eye className="w-4 h-4 mr-2" />
          Marquer comme vu
        </ContextMenuItem>
        
        <ContextMenuItem onClick={onMarkAsUnwatched}>
          <EyeOff className="w-4 h-4 mr-2" />
          Marquer comme non vu
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Rating */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Star className="w-4 h-4 mr-2" />
            Noter
            {video.userRating && (
              <span className="ml-auto text-xs text-muted-foreground">
                {video.userRating}/10
              </span>
            )}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
              <ContextMenuItem key={rating} onClick={() => onRate?.(rating)}>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.ceil(rating / 2) }).map((_, i) => (
                    <Star 
                      key={i} 
                      className={`w-3 h-3 ${video.userRating === rating ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground'}`} 
                    />
                  ))}
                  <span className="ml-2">{rating}/10</span>
                </div>
              </ContextMenuItem>
            ))}
            {video.userRating && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => onRate?.(0)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer la note
                </ContextMenuItem>
              </>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        {/* Media Options */}
        {video.subtitles && video.subtitles.length > 0 && (
          <ContextMenuItem onClick={onManageSubtitles}>
            <Subtitles className="w-4 h-4 mr-2" />
            Sous-titres ({video.subtitles.length})
          </ContextMenuItem>
        )}

        {video.audioTracks && video.audioTracks.length > 1 && (
          <ContextMenuItem onClick={onSelectAudioTrack}>
            <Volume2 className="w-4 h-4 mr-2" />
            Piste audio ({video.audioTracks.length})
          </ContextMenuItem>
        )}

        {/* Details & Metadata */}
        <ContextMenuItem onClick={onViewDetails}>
          <Info className="w-4 h-4 mr-2" />
          Voir les détails
        </ContextMenuItem>

        <ContextMenuItem onClick={onEditMetadata}>
          <Tag className="w-4 h-4 mr-2" />
          Modifier les métadonnées
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Cloud Upload */}
        {(onUploadToCloudinary || onUploadToBunny || onUploadToNexus) && (
          <>
            <ContextMenuSeparator />
            {onUploadToCloudinary && (
              <ContextMenuItem
                onClick={allowCta ? (canUploadToCloudinary ? onUploadToCloudinary : () => openProUploadCta({ server: "cloudinary" })) : undefined}
                disabled={isUploadingToCloudinary || !allowCta}
              >
                {isUploadingToCloudinary ? (
                  <>
                    <Cloud className="w-4 h-4 mr-2 animate-pulse" />
                    Upload en cours...
                  </>
                ) : (
                  <>
                    <Cloud className="w-4 h-4 mr-2 text-purple-500" />
                    Uploader vers Cloudinary (Serveur 0)
                    <Crown className="w-3.5 h-3.5 ml-1 text-amber-400" />
                  </>
                )}
              </ContextMenuItem>
            )}
            {onUploadToBunny && (
              <ContextMenuItem
                onClick={allowCta ? (canUploadToBunny ? onUploadToBunny : () => openProUploadCta({ server: "bunny" })) : undefined}
                disabled={isUploadingToBunny || !allowCta}
              >
                {isUploadingToBunny ? (
                  <>
                    <Zap className="w-4 h-4 mr-2 animate-pulse" />
                    Upload vers Bunny...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2 text-blue-500" />
                    Uploader vers Bunny (Serveur 1)
                    <Crown className="w-3.5 h-3.5 ml-1 text-amber-400" />
                  </>
                )}
              </ContextMenuItem>
            )}
            {onUploadToNexus && (
              <ContextMenuItem
                onClick={allowCta ? (canUploadToNexus ? onUploadToNexus : () => openProUploadCta({ server: "planethoster" })) : undefined}
                disabled={isUploadingToNexus || !allowCta}
              >
                {isUploadingToNexus ? (
                  <>
                    <Server className="w-4 h-4 mr-2 animate-pulse" />
                    Upload vers Nexus...
                  </>
                ) : (
                  <>
                    <Server className="w-4 h-4 mr-2 text-green-500" />
                    Uploader vers PlanetHoster (Serveur 2)
                    <Crown className="w-3.5 h-3.5 ml-1 text-amber-400" />
                  </>
                )}
              </ContextMenuItem>
            )}
          </>
        )}

        {/* Cloud Status */}
        {video.cloudStatus?.isUploaded && (
          <>
            <ContextMenuItem disabled>
              <Zap className="w-4 h-4 mr-2 text-green-500" />
              Uploadé sur {video.cloudStatus.provider}
            </ContextMenuItem>
            {video.cloudStatus.cloudUrl && (
              <ContextMenuItem onClick={() => window.open(video.cloudStatus!.cloudUrl, '_blank')}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Ouvrir le lien cloud
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
          </>
        )}

        {/* File Actions */}
        <ContextMenuItem onClick={onShowInFolder}>
          <FolderOpen className="w-4 h-4 mr-2" />
          Afficher dans le dossier
        </ContextMenuItem>

        <ContextMenuItem onClick={onCopyPath}>
          <Copy className="w-4 h-4 mr-2" />
          Copier le chemin
        </ContextMenuItem>

        <ContextMenuItem onClick={onShare}>
          <Share2 className="w-4 h-4 mr-2" />
          Partager
        </ContextMenuItem>

        {video.cloudStatus?.cloudUrl && (
          <ContextMenuItem onClick={() => window.open(video.cloudStatus!.cloudUrl, '_blank')}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Ouvrir le lien cloud
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        {/* Danger Zone */}
        <ContextMenuItem onClick={onDelete} className="text-destructive">
          <Trash2 className="w-4 h-4 mr-2" />
          Supprimer de la bibliothèque
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default VideoContextMenu;

