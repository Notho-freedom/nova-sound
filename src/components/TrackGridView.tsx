import { Play } from "lucide-react";
import { Track } from "@/types/music";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { UploadIndicator } from "@/components/UploadIndicator";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};
import { Cloud } from "lucide-react";

interface TrackGridViewProps {
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onTrackSelect: (index: number) => void;
  onPlayNext?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  onAddToPlaylist?: (playlistId: string, track: Track) => void;
  playlists?: any[];
  isFavorite?: (trackId: string) => boolean;
  toggleFavorite?: (trackId: string) => void;
  createPlaylist?: (name: string, trackIds: string[]) => Promise<any>;
  uploadTrack?: (track: Track) => void;
  getTrackProgress?: (trackId: string) => { status: string; progress: number } | null;
  canUploadToCloudinary?: boolean;
  uploadTrackToNexus?: (track: Track) => void;
  getNexusTrackProgress?: (trackId: string) => { status: string; progress: number } | null;
  canUploadToNexus?: boolean;
  columns?: 2 | 3 | 4 | 5;
  isUploaded?: (trackId: string) => boolean;
  getUploadedProvider?: (trackId: string) => "cloudinary" | "nexus" | "bunny" | "planethoster" | null;
  onNavigateToArtist?: (artist: string) => void;
  onNavigateToAlbum?: (album: string, artist: string) => void;
}

export const TrackGridView = ({
  tracks,
  currentTrackIndex,
  isPlaying,
  onTrackSelect,
  onPlayNext,
  onAddToQueue,
  onAddToPlaylist,
  playlists = [],
  isFavorite,
  toggleFavorite,
  createPlaylist,
  uploadTrack,
  getTrackProgress,
  canUploadToCloudinary = false,
  uploadTrackToNexus,
  getNexusTrackProgress,
  canUploadToNexus = false,
  columns = 5,
  isUploaded,
  getUploadedProvider,
  onNavigateToArtist,
  onNavigateToAlbum,
}: TrackGridViewProps) => {
  const gridCols = {
    2: "grid-cols-2",
    3: "grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
    5: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
  };

  return (
    <div className={cn("grid gap-4", gridCols[columns])}>
      {tracks.map((track) => {
        const actualIndex = tracks.findIndex(t => t.id === track.id);
        const isCurrentTrack = currentTrackIndex === actualIndex;

        return (
          <TrackContextMenu
            key={track.id}
            track={track}
            playlists={playlists}
            isFavorite={isFavorite?.(track.id) || false}
            onPlay={() => onTrackSelect(actualIndex)}
            onPlayNext={() => onPlayNext?.(track)}
            onAddToQueue={() => onAddToQueue?.(track)}
            onAddToPlaylist={(playlistId) => onAddToPlaylist?.(playlistId, track)}
            onCreatePlaylist={() => createPlaylist?.("Nouvelle playlist", [track.id])}
            onToggleFavorite={() => toggleFavorite?.(track.id)}
            onUploadToCloudinary={() => uploadTrack?.(track)}
            canUploadToCloudinary={canUploadToCloudinary && !!track.filePath}
            isUploading={getTrackProgress?.(track.id)?.status === 'uploading'}
            onUploadToNexus={() => uploadTrackToNexus?.(track)}
            canUploadToNexus={canUploadToNexus && !!track.filePath}
            isUploadingToNexus={getNexusTrackProgress?.(track.id)?.status === 'uploading'}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onTrackSelect(actualIndex)}
                  className={cn(
                    "group p-4 rounded-xl text-left transition-all duration-200 ease-out hover:bg-card/50 hover:scale-[1.02] active:scale-[0.98] w-full",
                    isCurrentTrack && "ring-2 ring-primary",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                  )}
                >
              <div className="aspect-square rounded-lg overflow-hidden mb-3 relative shadow-lg">
                <img src={getCoverUrl(track.coverUrl)} alt={track.album} className="w-full h-full object-cover transition-transform duration-200 ease-out group-hover:scale-105" />
                {/* Upload indicator badge */}
                {isUploaded?.(track.id) && (
                  <div className="absolute top-2 right-2 z-20">
                    <UploadIndicator provider={getUploadedProvider?.(track.id) || undefined} size="sm" />
                  </div>
                )}
                {/* Upload progress overlay */}
                {getTrackProgress?.(track.id) && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
                    <div className="text-center">
                      <Cloud className="w-4 h-4 text-white mb-1 mx-auto" />
                      <span className="text-[10px] text-white font-medium">
                        {getTrackProgress(track.id)?.progress || 0}%
                      </span>
                    </div>
                  </div>
                )}
                {/* Progress bar */}
                {getTrackProgress?.(track.id)?.status === 'uploading' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-muted/30">
                    <div 
                      className="h-full bg-primary transition-all duration-200 ease-out"
                      style={{ width: `${getTrackProgress(track.id)?.progress || 0}%` }}
                    />
                  </div>
                )}
                {/* Play overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center shadow-lg",
                    isCurrentTrack && isPlaying ? "bg-primary" : "bg-primary/90"
                  )}>
                    {isCurrentTrack && isPlaying ? (
                      <div className="flex items-center gap-1">
                        <div className="w-1 h-4 bg-white rounded-full animate-wave" />
                        <div className="w-1 h-4 bg-white rounded-full animate-wave" style={{ animationDelay: "0.1s" }} />
                        <div className="w-1 h-4 bg-white rounded-full animate-wave" style={{ animationDelay: "0.2s" }} />
                      </div>
                    ) : (
                      <Play className="w-6 h-6 text-white fill-current ml-0.5" />
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate text-foreground mb-1 flex-1">{track.title}</p>
                {isUploaded?.(track.id) && (
                  <UploadIndicator provider={getUploadedProvider?.(track.id) || undefined} size="sm" />
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">{formatTime(track.duration)}</p>
            </button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-sm font-medium">{track.title}</div>
                <div className="text-xs text-muted-foreground">
                  {onNavigateToArtist ? (
                    <button
                      className="underline hover:text-primary hover:bg-primary/10 rounded px-1 transition-colors focus:outline-none"
                      onClick={e => { e.stopPropagation(); onNavigateToArtist(track.artist); }}
                    >
                      {track.artist}
                    </button>
                  ) : track.artist}
                </div>
                {track.album && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {onNavigateToAlbum ? (
                      <button
                        className="underline hover:text-primary hover:bg-primary/10 rounded px-1 transition-colors focus:outline-none"
                        onClick={e => { e.stopPropagation(); onNavigateToAlbum(track.album, track.artist); }}
                      >
                        {track.album}
                      </button>
                    ) : track.album}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">{formatTime(track.duration)}</div>
              </TooltipContent>
            </Tooltip>
          </TrackContextMenu>
        );
      })}
    </div>
  );
};

