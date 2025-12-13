import { X, GripVertical, Play, Pause, Disc3, Radio } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Track } from "@/types/music";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";

interface QueuePanelProps {
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onTrackSelect: (index: number) => void;
  onClose: () => void;
  albumTracks?: Track[];
  similarTracks?: Track[];
  onPlayTrack?: (track: Track) => void;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const TrackItem = ({ 
  track, 
  onClick, 
  showGrip = false 
}: { 
  track: Track; 
  onClick: () => void; 
  showGrip?: boolean;
}) => (
  <div
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 p-2 rounded-lg cursor-pointer group",
      "hover:bg-muted/50 transition-colors"
    )}
  >
    {showGrip && (
      <GripVertical className="w-4 h-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
    )}
    <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
      <img
        src={getCoverUrl(track.coverUrl)}
        alt=""
        className="w-full h-full object-cover"
      />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm truncate text-foreground">
        {track.title}
      </p>
      <p className="text-xs text-muted-foreground truncate">
        {track.artist}
      </p>
    </div>
    <span className="text-xs text-muted-foreground">
      {formatTime(track.duration)}
    </span>
  </div>
);

export const QueuePanel = ({
  tracks,
  currentTrackIndex,
  isPlaying,
  onTrackSelect,
  onClose,
  albumTracks = [],
  similarTracks = [],
  onPlayTrack,
}: QueuePanelProps) => {
  const currentTrack = tracks[currentTrackIndex];
  const upNext = tracks.slice(currentTrackIndex + 1);
  const history = tracks.slice(0, currentTrackIndex);

  // Album tracks from current track onwards
  const albumTracksFromCurrent = albumTracks.length > 0 && currentTrack
    ? (() => {
        const currentIndex = albumTracks.findIndex(t => t.id === currentTrack.id);
        return currentIndex >= 0 ? albumTracks.slice(currentIndex + 1) : [];
      })()
    : [];

  return (
    <div className="w-80 h-full bg-card/95 backdrop-blur-md border-l border-border flex flex-col shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="font-display text-sm tracking-wider text-foreground">
          FILE D'ATTENTE
        </h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Now Playing - Always visible */}
      {currentTrack && (
        <div className="p-4 border-b border-border">
          <h3 className="text-xs font-display uppercase tracking-widest text-primary mb-3">
            En Lecture
          </h3>
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
                <img
                  src={getCoverUrl(currentTrack.coverUrl)}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-foreground">
                  {currentTrack.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {currentTrack.artist}
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                {isPlaying ? (
                  <Pause className="w-4 h-4 text-primary fill-current" />
                ) : (
                  <Play className="w-4 h-4 text-primary fill-current ml-0.5" />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="queue" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 pt-2 border-b border-border">
          <TabsList className="w-full grid grid-cols-3 h-auto bg-muted/30">
            <TabsTrigger 
              value="queue" 
              className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              File ({upNext.length})
            </TabsTrigger>
            <TabsTrigger 
              value="album" 
              className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              <Disc3 className="w-3 h-3 mr-1" />
              Album ({albumTracksFromCurrent.length})
            </TabsTrigger>
            <TabsTrigger 
              value="similar" 
              className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              <Radio className="w-3 h-3 mr-1" />
              Similaire ({similarTracks.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <TabsContent value="queue" className="p-4 space-y-6 mt-0">
            {/* Up Next */}
            {upNext.length > 0 ? (
              <div>
                <h3 className="text-xs font-display uppercase tracking-widest text-muted-foreground mb-3">
                  À Suivre
                </h3>
                <div className="space-y-1">
                  {upNext.map((track, idx) => {
                    const actualIndex = currentTrackIndex + 1 + idx;
                    return (
                      <TrackItem
                        key={track.id}
                        track={track}
                        onClick={() => onTrackSelect(actualIndex)}
                        showGrip
                      />
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Aucune piste à suivre
              </div>
            )}

            {/* History */}
            {history.length > 0 && (
              <div>
                <h3 className="text-xs font-display uppercase tracking-widest text-muted-foreground/50 mb-3">
                  Historique ({history.length})
                </h3>
                <div className="space-y-1 opacity-60">
                  {history.map((track, idx) => (
                    <TrackItem
                      key={track.id}
                      track={track}
                      onClick={() => onTrackSelect(idx)}
                    />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="album" className="p-4 mt-0">
            {albumTracksFromCurrent.length > 0 ? (
              <div className="space-y-1">
                {albumTracksFromCurrent.map((track) => (
                  <TrackItem
                    key={track.id}
                    track={track}
                    onClick={() => onPlayTrack?.(track)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {currentTrack 
                  ? `Aucune autre piste dans l'album "${currentTrack.album}"`
                  : "Aucun album disponible"}
              </div>
            )}
          </TabsContent>

          <TabsContent value="similar" className="p-4 mt-0">
            {similarTracks.length > 0 ? (
              <div className="space-y-1">
                {similarTracks.map((track) => (
                  <TrackItem
                    key={track.id}
                    track={track}
                    onClick={() => onPlayTrack?.(track)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Aucune piste similaire trouvée
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
};
