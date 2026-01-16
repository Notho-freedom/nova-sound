import { Play, Cloud } from "lucide-react";
import { memo, useMemo, type CSSProperties } from "react";
import { FixedSizeGrid as Grid, type GridChildComponentProps } from "react-window";
import { AutoSizer } from "react-virtualized-auto-sizer";
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

interface TrackGridViewProps {
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onTrackSelect: (index: number) => void;
  onPlayTrack?: (track: Track) => void;
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
  columns?: number;
  isUploaded?: (trackId: string) => boolean;
  getUploadedProvider?: (trackId: string) => "cloudinary" | "nexus" | "bunny" | "planethoster" | null;
  onNavigateToArtist?: (artist: string) => void;
  onNavigateToAlbum?: (album: string, artist: string) => void;
}

export const TrackGridView = memo(({
  tracks,
  currentTrackIndex,
  isPlaying,
  onTrackSelect,
  onPlayTrack,
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
  const indexById = useMemo(() => {
    const map = new Map<string, number>();
    tracks.forEach((track, idx) => {
      if (!map.has(track.id)) map.set(track.id, idx);
    });
    return map;
  }, [tracks]);

  const gridCols: Record<number, string> = {
    2: "grid-cols-2",
    3: "grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
    5: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
  };

  const shouldVirtualize = tracks.length > 200;

  const cellData = useMemo(() => ({
    tracks,
    indexById,
    currentTrackIndex,
    isPlaying,
    onTrackSelect,
    onPlayTrack,
    onPlayNext,
    onAddToQueue,
    onAddToPlaylist,
    playlists,
    isFavorite,
    toggleFavorite,
    createPlaylist,
    uploadTrack,
    getTrackProgress,
    canUploadToCloudinary,
    uploadTrackToNexus,
    getNexusTrackProgress,
    canUploadToNexus,
    isUploaded,
    getUploadedProvider,
    onNavigateToArtist,
    onNavigateToAlbum,
    columnCount: columns,
  }), [
    tracks,
    indexById,
    currentTrackIndex,
    isPlaying,
    onTrackSelect,
    onPlayTrack,
    onPlayNext,
    onAddToQueue,
    onAddToPlaylist,
    playlists,
    isFavorite,
    toggleFavorite,
    createPlaylist,
    uploadTrack,
    getTrackProgress,
    canUploadToCloudinary,
    uploadTrackToNexus,
    getNexusTrackProgress,
    canUploadToNexus,
    isUploaded,
    getUploadedProvider,
    onNavigateToArtist,
    onNavigateToAlbum,
    columns,
  ]);

  const Cell = ({ columnIndex, rowIndex, style, data }: GridChildComponentProps<typeof cellData>) => {
    const index = rowIndex * data.columnCount + columnIndex;
    if (index >= data.tracks.length) return null;
    const track = data.tracks[index];
    const actualIndex = data.indexById.get(track.id) ?? index;
    const isCurrentTrack = data.currentTrackIndex === actualIndex;

    const gap = 16;
    const baseStyle = style as CSSProperties;
    const left = typeof baseStyle.left === "number" ? baseStyle.left : 0;
    const top = typeof baseStyle.top === "number" ? baseStyle.top : 0;
    const width = typeof baseStyle.width === "number" ? baseStyle.width : 0;
    const height = typeof baseStyle.height === "number" ? baseStyle.height : 0;
    const adjustedStyle = {
      ...style,
      left: left + gap / 2,
      top: top + gap / 2,
      width: width - gap,
      height: height - gap,
    } as CSSProperties;

    return (
      <div style={adjustedStyle}>
        <TrackContextMenu
          track={track}
          playlists={data.playlists}
          isFavorite={data.isFavorite?.(track.id) || false}
          onPlay={() => data.onTrackSelect(actualIndex)}
          onPlayNext={() => data.onPlayNext?.(track)}
          onAddToQueue={() => data.onAddToQueue?.(track)}
          onAddToPlaylist={(playlistId) => data.onAddToPlaylist?.(playlistId, track)}
          onCreatePlaylist={() => data.createPlaylist?.("Nouvelle playlist", [track.id])}
          onToggleFavorite={() => data.toggleFavorite?.(track.id)}
          onUploadToCloudinary={() => data.uploadTrack?.(track)}
          canUploadToCloudinary={data.canUploadToCloudinary && !!track.filePath}
          isUploading={data.getTrackProgress?.(track.id)?.status === "uploading"}
          onUploadToNexus={() => data.uploadTrackToNexus?.(track)}
          canUploadToNexus={data.canUploadToNexus && !!track.filePath}
          isUploadingToNexus={data.getNexusTrackProgress?.(track.id)?.status === "uploading"}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  data.onPlayTrack ? data.onPlayTrack(track) : data.onTrackSelect(actualIndex);
                }}
                className={cn(
                  "group p-4 rounded-xl text-left transition-all duration-200 ease-out hover:bg-card/50 hover:scale-[1.02] active:scale-[0.98] w-full h-full",
                  isCurrentTrack && "ring-2 ring-primary",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                )}
              >
                <div className="aspect-square rounded-lg overflow-hidden mb-3 relative shadow-lg">
                  <img src={getCoverUrl(track.coverUrl)} alt={track.album} className="w-full h-full object-cover transition-transform duration-200 ease-out group-hover:scale-105" />
                  {data.isUploaded?.(track.id) && (
                    <div className="absolute top-2 right-2 z-20">
                      <UploadIndicator provider={data.getUploadedProvider?.(track.id) || undefined} size="sm" />
                    </div>
                  )}
                  {data.getTrackProgress?.(track.id) && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
                      <div className="text-center">
                        <Cloud className="w-4 h-4 text-white mb-1 mx-auto" />
                        <span className="text-[10px] text-white font-medium">
                          Upload {data.getTrackProgress?.(track.id)?.progress.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="font-medium text-sm line-clamp-1">{track.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-1">{track.artist}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{track.album}</span>
                    <span>{formatTime(track.duration)}</span>
                  </div>
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{track.title} - {track.artist}</p>
            </TooltipContent>
          </Tooltip>
        </TrackContextMenu>
      </div>
    );
  };

  if (!shouldVirtualize) {
    return (
      <div className={cn("grid gap-4", gridCols[columns] ?? gridCols[5])}>
        {tracks.map((track, idx) => {
          const actualIndex = indexById.get(track.id) ?? idx;
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
              isUploading={getTrackProgress?.(track.id)?.status === "uploading"}
              onUploadToNexus={() => uploadTrackToNexus?.(track)}
              canUploadToNexus={canUploadToNexus && !!track.filePath}
              isUploadingToNexus={getNexusTrackProgress?.(track.id)?.status === "uploading"}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onPlayTrack ? onPlayTrack(track) : onTrackSelect(actualIndex)}
                    className={cn(
                      "group p-4 rounded-xl text-left transition-all duration-200 ease-out hover:bg-card/50 hover:scale-[1.02] active:scale-[0.98] w-full",
                      isCurrentTrack && "ring-2 ring-primary",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                    )}
                  >
                    <div className="aspect-square rounded-lg overflow-hidden mb-3 relative shadow-lg">
                      <img src={getCoverUrl(track.coverUrl)} alt={track.album} className="w-full h-full object-cover transition-transform duration-200 ease-out group-hover:scale-105" />
                      {isUploaded?.(track.id) && (
                        <div className="absolute top-2 right-2 z-20">
                          <UploadIndicator provider={getUploadedProvider?.(track.id) || undefined} size="sm" />
                        </div>
                      )}
                      {getTrackProgress?.(track.id) && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
                          <div className="text-center">
                            <Cloud className="w-4 h-4 text-white mb-1 mx-auto" />
                            <span className="text-[10px] text-white font-medium">
                              Upload {getTrackProgress?.(track.id)?.progress.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-medium text-sm line-clamp-1">{track.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-1">{track.artist}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{track.album}</span>
                        <span>{formatTime(track.duration)}</span>
                      </div>
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{track.title} - {track.artist}</p>
                </TooltipContent>
              </Tooltip>
            </TrackContextMenu>
          );
        })}
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-320px)]">
      <AutoSizer
        renderProp={({ height, width }) => {
          if (!height || !width) return null;
          const gap = 16;
          const minColWidth = 220;
          const maxColumns = columns;
          const computedColumns = Math.max(1, Math.min(maxColumns, Math.floor(width / (minColWidth + gap))));
          const columnWidth = Math.floor((width - gap * (computedColumns - 1)) / computedColumns);
          const rowHeight = columnWidth + 80;
          const rowCount = Math.ceil(tracks.length / computedColumns);
          const gridData = { ...cellData, columnCount: computedColumns };

          return (
            <Grid
              height={height}
              width={width}
              columnCount={computedColumns}
              columnWidth={columnWidth + gap}
              rowCount={rowCount}
              rowHeight={rowHeight + gap}
              itemData={gridData}
              itemKey={({ columnIndex, rowIndex, data }) => {
                const index = rowIndex * data.columnCount + columnIndex;
                return data.tracks[index]?.id ?? `${rowIndex}-${columnIndex}`;
              }}
              overscanRowCount={2}
              overscanColumnCount={1}
            >
              {Cell}
            </Grid>
          );
        }}
      />
    </div>
  );
});

TrackGridView.displayName = "TrackGridView";

