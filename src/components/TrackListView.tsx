import { memo } from "react";
import { Play, MoreHorizontal } from "lucide-react";
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

interface TrackListViewProps {
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
  showHistory?: boolean;
  showAlbum?: boolean;
  showTrackNumber?: boolean;
  showRemoveFromPlaylist?: boolean;
  onRemoveFromPlaylist?: (track: Track) => void;
  isUploaded?: (trackId: string) => boolean;
  getUploadedProvider?: (trackId: string) => "cloudinary" | "nexus" | "bunny" | "planethoster" | null;
}

export const TrackListView = memo(({
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
  showHistory = false,
  showAlbum = true,
  showTrackNumber = false,
  showRemoveFromPlaylist = false,
  onRemoveFromPlaylist,
  isUploaded,
  getUploadedProvider,
}: TrackListViewProps) => {
  return (
    <div className="bg-card/30 backdrop-blur-sm rounded-xl border border-border/30 overflow-hidden relative">
      <div className="overflow-y-auto max-h-[calc(100vh-400px)]">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/50">
            <tr className="border-b border-border/30">
              <th className="px-4 py-2.5 text-left text-xs font-display uppercase tracking-widest text-muted-foreground w-12">
                {showTrackNumber ? "#" : ""}
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-display uppercase tracking-widest text-muted-foreground">
                Titre
              </th>
              {showAlbum && (
                <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                  Album
                </th>
              )}
              {showHistory && (
                <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden lg:table-cell">
                  Écouté
                </th>
              )}
              <th className="px-4 py-2.5 text-right text-xs font-display uppercase tracking-widest text-muted-foreground">
                Durée
              </th>
              <th className="px-4 py-2.5 w-12"></th>
            </tr>
          </thead>
          <tbody>
          {tracks.map((track, idx) => {
            const actualIndex = tracks.findIndex(t => t.id === track.id);
            const isCurrentTrack = currentTrackIndex === actualIndex;
            const tooltipText = `${track.title} - ${track.artist}${track.album ? ` (${track.album})` : ''} - ${formatTime(track.duration)}`;

            return (
              <tr
                key={track.id}
                onClick={() => onTrackSelect(actualIndex)}
                className={cn(
                  "group cursor-pointer transition-all duration-200 ease-out",
                  isCurrentTrack ? "bg-primary/10" : "hover:bg-muted/40 active:bg-muted/50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                )}
              >
                <td className="px-4 py-2.5">
                  <div className="w-6 flex items-center justify-center">
                    {isCurrentTrack && isPlaying ? (
                      <div className="flex items-center gap-0.5">
                        <div className="w-1 h-4 bg-primary rounded-full animate-wave" />
                        <div className="w-1 h-4 bg-primary rounded-full animate-wave" style={{ animationDelay: "0.1s" }} />
                        <div className="w-1 h-4 bg-primary rounded-full animate-wave" style={{ animationDelay: "0.2s" }} />
                      </div>
                    ) : (
                      <>
                        {showTrackNumber && (
                          <span className="text-sm text-muted-foreground group-hover:hidden">
                            {track.trackNumber || idx + 1}
                          </span>
                        )}
                        <Play className="w-4 h-4 text-foreground hidden group-hover:block fill-current" />
                      </>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <TrackContextMenu
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
                          onRemoveFromPlaylist={showRemoveFromPlaylist ? () => onRemoveFromPlaylist?.(track) : undefined}
                        >
                          <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 relative">
                        <img src={getCoverUrl(track.coverUrl)} alt={track.album} className="w-full h-full object-cover" />
                        {getTrackProgress?.(track.id) && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="text-[10px] text-white font-medium">
                              {getTrackProgress(track.id)?.progress || 0}%
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                        <p className={cn("text-sm font-medium truncate", isCurrentTrack ? "text-primary" : "text-foreground")}>
                          {track.title}
                        </p>
                          {isUploaded?.(track.id) && (
                            <UploadIndicator provider={getUploadedProvider?.(track.id) || undefined} size="sm" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                      </div>
                    </div>
                        </TrackContextMenu>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-sm font-medium">{track.title}</div>
                      <div className="text-xs text-muted-foreground">{track.artist}</div>
                      {track.album && <div className="text-xs text-muted-foreground mt-1">{track.album}</div>}
                      <div className="text-xs text-muted-foreground mt-1">{formatTime(track.duration)}</div>
                    </TooltipContent>
                  </Tooltip>
                </td>
                {showAlbum && (
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-sm text-muted-foreground truncate">{track.album}</p>
                  </td>
                )}
                {showHistory && (
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <p className="text-sm text-muted-foreground">
                      {track.lastPlayedAt ? new Date(track.lastPlayedAt).toLocaleDateString() : "-"}
                    </p>
                  </td>
                )}
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-muted-foreground font-mono">{formatTime(track.duration)}</span>
                </td>
                <td className="px-4 py-2.5">
                  <TrackContextMenu
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
                    onRemoveFromPlaylist={showRemoveFromPlaylist ? () => onRemoveFromPlaylist?.(track) : undefined}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button 
                          className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                          aria-label="Options"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-sm">Options</div>
                      </TooltipContent>
                    </Tooltip>
                  </TrackContextMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
});

TrackListView.displayName = 'TrackListView';

