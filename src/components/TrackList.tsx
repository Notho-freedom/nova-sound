import { memo } from "react";
import { Music, Play, Pause, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Track } from "@/types/music";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { UploadIndicator } from "@/components/UploadIndicator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TrackListProps {
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
  uploadTrackToBunny?: (track: Track) => void;
  getBunnyTrackProgress?: (trackId: string) => { status: string; progress: number } | null;
  canUploadToBunny?: boolean;
  uploadTrackToNexus?: (track: Track, target?: "planethoster" | "local") => void;
  getNexusTrackProgress?: (trackId: string) => { status: string; progress: number } | null;
  canUploadToLocal?: boolean;
  canUploadToNexus?: boolean;
  isUploaded?: (trackId: string) => boolean;
  getUploadedProvider?: (trackId: string) => "cloudinary" | "nexus" | "bunny" | "planethoster" | null;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const TrackList = memo(({ 
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
  uploadTrackToBunny,
  getBunnyTrackProgress,
  canUploadToBunny = false,
  uploadTrackToNexus,
  getNexusTrackProgress,
  canUploadToLocal = false,
  canUploadToNexus = false,
  isUploaded,
  getUploadedProvider,
}: TrackListProps) => {
  return (
    <div className="h-full overflow-y-auto space-y-1 pr-2">
      {tracks.map((track, index) => (
        <TrackContextMenu
          key={track.id}
          track={track}
          playlists={playlists}
          isFavorite={isFavorite?.(track.id) || false}
          onPlay={() => onTrackSelect(index)}
          onPlayNext={() => onPlayNext?.(track)}
          onAddToQueue={() => onAddToQueue?.(track)}
          onAddToPlaylist={(playlistId) => onAddToPlaylist?.(playlistId, track)}
          onCreatePlaylist={() => createPlaylist?.("Nouvelle playlist", [track.id])}
          onToggleFavorite={() => toggleFavorite?.(track.id)}
          onUploadToCloudinary={() => uploadTrack?.(track)}
          canUploadToCloudinary={canUploadToCloudinary && !!track.filePath}
          isUploading={getTrackProgress?.(track.id)?.status === 'uploading'}
          onUploadToBunny={() => uploadTrackToBunny?.(track)}
          canUploadToBunny={canUploadToBunny && !!track.filePath}
          isUploadingToBunny={getBunnyTrackProgress?.(track.id)?.status === 'uploading'}
          onUploadToNexus={() => uploadTrackToNexus?.(track, 'planethoster')}
          canUploadToNexus={canUploadToNexus && !!track.filePath}
          isUploadingToNexus={getNexusTrackProgress?.(track.id)?.status === 'uploading'}
          onUploadToLocal={() => uploadTrackToNexus?.(track, 'local')}
          canUploadToLocal={canUploadToLocal && !!track.filePath}
          isUploadingToLocal={getNexusTrackProgress?.(track.id)?.status === 'uploading'}
        >
          <div
            onClick={() => onTrackSelect(index)}
            className={cn(
              "track-item group flex items-center gap-4 relative",
              index === currentTrackIndex && "active"
            )}
          >
            {/* Track number / Play indicator */}
            <div className="w-8 h-8 flex items-center justify-center relative">
              {index === currentTrackIndex && isPlaying ? (
                <div className="flex gap-[2px] items-end h-4">
                  {[1, 2, 3].map((bar) => (
                    <div
                      key={bar}
                      className="w-[3px] bg-primary rounded-full animate-wave"
                      style={{ 
                        height: "100%",
                        animationDelay: `${bar * 0.15}s` 
                      }}
                    />
                  ))}
                </div>
              ) : (
                <>
                  <span className="text-sm text-muted-foreground group-hover:hidden font-display">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <Play 
                    className="w-4 h-4 hidden group-hover:block text-primary" 
                    fill="currentColor"
                  />
                </>
              )}
            </div>
            
            {/* Track info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
              <p className={cn(
                "font-medium truncate transition-colors max-w-xs",
                index === currentTrackIndex ? "text-primary neon-text-cyan" : "text-foreground"
              )}>
                {track.title}
              </p>
                {isUploaded?.(track.id) && (
                  <UploadIndicator provider={getUploadedProvider?.(track.id) || undefined} size="sm" />
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate max-w-xs">
                {track.artist}
              </p>
            </div>
            
            {/* Duration */}
            <span className="text-sm text-muted-foreground font-display">
              {formatDuration(track.duration)}
            </span>

            {/* Options button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onTrackSelect(index)}>
                  <Play className="w-4 h-4 mr-2" />
                  Lecture
                </DropdownMenuItem>
                {toggleFavorite && (
                  <DropdownMenuItem onClick={() => toggleFavorite(track.id)}>
                    <Music className="w-4 h-4 mr-2" />
                    {isFavorite?.(track.id) ? "Retirer des favoris" : "Ajouter aux favoris"}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TrackContextMenu>
      ))}
    </div>
  );
});
