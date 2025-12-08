import { X, GripVertical, Play, Pause } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Track } from "@/types/music";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";

interface QueuePanelProps {
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onTrackSelect: (index: number) => void;
  onClose: () => void;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const QueuePanel = ({
  tracks,
  currentTrackIndex,
  isPlaying,
  onTrackSelect,
  onClose,
}: QueuePanelProps) => {
  const upNext = tracks.slice(currentTrackIndex + 1);
  const history = tracks.slice(0, currentTrackIndex);

  return (
    <div className="w-80 h-full bg-card border-l border-border flex flex-col">
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

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Now Playing */}
          <div>
            <h3 className="text-xs font-display uppercase tracking-widest text-primary mb-3">
              En Lecture
            </h3>
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
                  <img
                    src={getCoverUrl(tracks[currentTrackIndex]?.coverUrl)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-foreground">
                    {tracks[currentTrackIndex]?.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {tracks[currentTrackIndex]?.artist}
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

          {/* Up Next */}
          {upNext.length > 0 && (
            <div>
              <h3 className="text-xs font-display uppercase tracking-widest text-muted-foreground mb-3">
                À Suivre ({upNext.length})
              </h3>
              <div className="space-y-1">
                {upNext.map((track, idx) => {
                  const actualIndex = currentTrackIndex + 1 + idx;
                  return (
                    <div
                      key={track.id}
                      onClick={() => onTrackSelect(actualIndex)}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg cursor-pointer group",
                        "hover:bg-muted/50 transition-colors"
                      )}
                    >
                      <GripVertical className="w-4 h-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
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
                })}
              </div>
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
                  <div
                    key={track.id}
                    onClick={() => onTrackSelect(idx)}
                    className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-muted/30 transition-colors"
                  >
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
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
