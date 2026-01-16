import { memo, useMemo } from "react";
import { Play, MoreHorizontal } from "lucide-react";
import { FixedSizeList as List, type ListChildComponentProps } from "react-window";
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

  interface TrackListViewProps {
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
    showHistory?: boolean;
    showAlbum?: boolean;
    showTrackNumber?: boolean;
    showRemoveFromPlaylist?: boolean;
    onRemoveFromPlaylist?: (track: Track) => void;
    isUploaded?: (trackId: string) => boolean;
    getUploadedProvider?: (trackId: string) => "cloudinary" | "nexus" | "bunny" | "planethoster" | null;
    onNavigateToArtist?: (artist: string) => void;
    onNavigateToAlbum?: (album: string, artist: string) => void;
  }

  export const TrackListView = memo(({ 
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
    showHistory = false,
    showAlbum = true,
    showTrackNumber = false,
    showRemoveFromPlaylist = false,
    onRemoveFromPlaylist,
    isUploaded,
    getUploadedProvider,
    onNavigateToArtist,
    onNavigateToAlbum,
  }: TrackListViewProps) => {
    const indexById = useMemo(() => {
      const map = new Map<string, number>();
      tracks.forEach((track, idx) => {
        if (!map.has(track.id)) map.set(track.id, idx);
      });
      return map;
    }, [tracks]);

    const columnsTemplate = useMemo(() => {
      const cols: string[] = [];
      cols.push(showTrackNumber ? "48px" : "16px");
      cols.push("minmax(140px, 1fr)");
      if (showAlbum) cols.push("minmax(140px, 1fr)");
      if (showHistory) cols.push("minmax(120px, 160px)");
      cols.push("72px");
      cols.push("48px");
      return cols.join(" ");
    }, [showTrackNumber, showAlbum, showHistory]);

    const rowData = useMemo(() => ({
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
      showHistory,
      showAlbum,
      showTrackNumber,
      showRemoveFromPlaylist,
      onRemoveFromPlaylist,
      isUploaded,
      getUploadedProvider,
      onNavigateToArtist,
      onNavigateToAlbum,
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
      showHistory,
      showAlbum,
      showTrackNumber,
      showRemoveFromPlaylist,
      onRemoveFromPlaylist,
      isUploaded,
      getUploadedProvider,
      onNavigateToArtist,
      onNavigateToAlbum,
    ]);

    const shouldVirtualize = tracks.length > 200;

    const Row = memo(({ index, style, data }: ListChildComponentProps<typeof rowData>) => {
      const track = data.tracks[index];
      if (!track) return null;
      const actualIndex = data.indexById.get(track.id) ?? index;
      const isCurrentTrack = data.currentTrackIndex === actualIndex;
      const tooltipText = `${track.title} - ${track.artist}${track.album ? ` (${track.album})` : ''} - ${formatTime(track.duration)}`;

      return (
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
          isUploading={data.getTrackProgress?.(track.id)?.status === 'uploading'}
          onUploadToNexus={() => data.uploadTrackToNexus?.(track)}
          canUploadToNexus={data.canUploadToNexus && !!track.filePath}
          isUploadingToNexus={data.getNexusTrackProgress?.(track.id)?.status === 'uploading'}
          onRemoveFromPlaylist={data.showRemoveFromPlaylist ? () => data.onRemoveFromPlaylist?.(track) : undefined}
        >
          <div
            style={style}
            onClick={() => data.onPlayTrack ? data.onPlayTrack(track) : data.onTrackSelect(actualIndex)}
            className={cn(
              "grid items-center cursor-pointer",
              "border-b border-border/30",
              isCurrentTrack ? "bg-primary/10" : "hover:bg-muted/40 active:bg-muted/50",
              "transition-all duration-200 ease-out",
            )}
            role="row"
            aria-selected={isCurrentTrack}
          >
            <div
              className="grid items-center px-4 py-2.5"
              style={{ gridTemplateColumns: columnsTemplate }}
            >
            <div className="flex items-center justify-center">
              {isCurrentTrack && data.isPlaying ? (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Play className="w-3 h-3 text-primary-foreground fill-current" />
                </div>
              ) : data.showTrackNumber ? (
                <span className="text-xs text-muted-foreground">{index + 1}</span>
              ) : null}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                  <img src={getCoverUrl(track.coverUrl)} alt={track.album} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          data.onPlayTrack ? data.onPlayTrack(track) : data.onTrackSelect(actualIndex);
                        }}
                        className="text-sm font-medium truncate text-left hover:underline focus-visible:outline-none"
                      >
                        {track.title}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{tooltipText}</p>
                    </TooltipContent>
                  </Tooltip>
                  <div className="text-xs text-muted-foreground truncate">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        data.onNavigateToArtist?.(track.artist);
                      }}
                      className="hover:underline"
                    >
                      {track.artist}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {data.showAlbum && (
              <div className="hidden md:block text-xs text-muted-foreground truncate">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    data.onNavigateToAlbum?.(track.album || "", track.artist);
                  }}
                  className="hover:underline"
                >
                  {track.album || "-"}
                </button>
              </div>
            )}

            {data.showHistory && (
              <div className="hidden lg:block text-xs text-muted-foreground">
                {track.lastPlayedAt ? new Date(track.lastPlayedAt).toLocaleDateString() : "-"}
              </div>
            )}

            <div className="text-right text-xs text-muted-foreground tabular-nums">
              {formatTime(track.duration)}
            </div>

            <div className="flex items-center justify-end gap-2">
              {data.isUploaded?.(track.id) && (
                <UploadIndicator provider={data.getUploadedProvider?.(track.id) || undefined} size="sm" />
              )}
              <button
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        </TrackContextMenu>
      );
    });

    return (
      <div className="bg-card/30 backdrop-blur-sm rounded-xl border border-border/30 overflow-hidden relative">
        <div className="border-b border-border/30 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/50">
          <div className="grid items-center px-4 py-2.5 text-xs font-display uppercase tracking-widest text-muted-foreground" style={{ gridTemplateColumns: columnsTemplate }}>
            <div>{showTrackNumber ? "#" : ""}</div>
            <div>Titre</div>
            {showAlbum && <div className="hidden md:block">Album</div>}
            {showHistory && <div className="hidden lg:block">Écouté</div>}
            <div className="text-right">Durée</div>
            <div></div>
          </div>
        </div>

        <div className="max-h-[calc(100vh-300px)] h-[calc(100vh-300px)]">
          {shouldVirtualize ? (
            <AutoSizer
              renderProp={({ height, width }) =>
                height && width ? (
                  <List
                    height={height}
                    width={width}
                    itemCount={tracks.length}
                    itemSize={56}
                    itemData={rowData}
                    itemKey={(index, data) => data.tracks[index]?.id ?? index}
                    overscanCount={6}
                  >
                    {Row}
                  </List>
                ) : null
              }
            />
          ) : (
            <div>
              {tracks.map((track, index) => (
                <Row
                  key={track.id}
                  index={index}
                  style={{ height: 56 }}
                  data={rowData}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  });

TrackListView.displayName = "TrackListView";

