import { X, GripVertical, Play, Pause, Disc3, Radio, Clock, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Track } from "@/types/music";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useYouTubeSimilarTracks } from "@/hooks/useYouTubeSimilarTracks";

interface QueuePanelProps {
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onTrackSelect: (index: number) => void;
  onClose: () => void;
  albumTracks?: Track[];
  similarTracks?: Track[];
  historyTracks?: Track[];
  onPlayTrack?: (track: Track) => void;
  currentTrack?: Track | null; // Track actuellement en lecture
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
  <Tooltip>
    <TooltipTrigger asChild>
      <div
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer group",
          "hover:bg-muted/40 transition-all duration-200 ease-out active:scale-[0.98]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
        )}
      >
    {showGrip && (
      <GripVertical className="w-4 h-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out cursor-grab" />
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
    </TooltipTrigger>
    <TooltipContent>
      <div className="text-sm font-medium">{track.title}</div>
      <div className="text-xs text-muted-foreground">{track.artist}</div>
      {track.album && <div className="text-xs text-muted-foreground mt-1">{track.album}</div>}
      <div className="text-xs text-muted-foreground mt-1">{formatTime(track.duration)}</div>
    </TooltipContent>
  </Tooltip>
);

export const QueuePanel = ({
  tracks,
  currentTrackIndex,
  isPlaying,
  onTrackSelect,
  onClose,
  albumTracks = [],
  similarTracks: propSimilarTracks = [],
  historyTracks = [],
  onPlayTrack,
  currentTrack: propCurrentTrack,
}: QueuePanelProps) => {
  const currentTrack = propCurrentTrack || tracks[currentTrackIndex];

  // Hook pour charger les tracks YouTube similaires
  const { 
    similarTracks: youtubeSimilarTracks, 
    loading: loadingYouTubeSimilar,
    loadSimilar: loadYouTubeSimilar 
  } = useYouTubeSimilarTracks();

  // Charger les tracks YouTube similaires quand le track actuel change
  useEffect(() => {
    if (currentTrack && currentTrack.mediaSource === 'youtube') {
      loadYouTubeSimilar(currentTrack);
    }
  }, [currentTrack?.id, currentTrack?.mediaSource, currentTrack?.artist, currentTrack?.youtubeVideoId, loadYouTubeSimilar]);

  // File: Tous les tracks de l'album (flux de l'album complet)
  const albumTracksForFile = albumTracks.length > 0 && currentTrack
    ? (() => {
        // Pour les tracks locaux, afficher tous les tracks de l'album
        // Pour les tracks YouTube, ne pas afficher de tracks d'album (pas d'album réel)
        if (currentTrack.mediaSource === 'youtube') {
          return [];
        }
        // Exclure le track actuel
        return albumTracks.filter(t => t.id !== currentTrack.id);
      })()
    : [];

  // Similaire: Utiliser les tracks YouTube si c'est un track YouTube, sinon les tracks locaux
  const similarTracksForDisplay = currentTrack?.mediaSource === 'youtube' 
    ? youtubeSimilarTracks 
    : propSimilarTracks;

  return (
    <div className="w-80 h-full bg-card/95 backdrop-blur-md border-l border-border flex flex-col shadow-2xl">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="font-display text-sm tracking-wider text-foreground">
          FILE D'ATTENTE
        </h2>
        <button
          onClick={onClose}
          title="Fermer la file d'attente"
          className="p-1.5 rounded-lg hover:bg-muted/40 transition-all duration-200 ease-out active:scale-95 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
        >
          <X className="w-4 h-4 hover:scale-105 transition-transform duration-200 ease-out" />
        </button>
      </div>

      {/* Now Playing - Always visible */}
      {currentTrack && (
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-xs font-display uppercase tracking-widest text-primary mb-3">
            En Lecture
          </h3>
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 transition-all duration-200 ease-out">
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
      <Tabs defaultValue="file" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 pt-2 border-b border-border">
          <TabsList className="w-full grid grid-cols-3 h-auto bg-muted/30">
            <TabsTrigger 
              value="file" 
              className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              <Disc3 className="w-3 h-3 mr-1" />
              File ({albumTracksForFile.length})
            </TabsTrigger>
            <TabsTrigger 
              value="similar" 
              className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              <Radio className="w-3 h-3 mr-1" />
              Similaire ({similarTracksForDisplay.length})
            </TabsTrigger>
            <TabsTrigger 
              value="history" 
              className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              <Clock className="w-3 h-3 mr-1" />
              Historique ({historyTracks.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          {/* File: Flux de l'album complet */}
          <TabsContent value="file" className="p-4 mt-0">
            {albumTracksForFile.length > 0 ? (
              <div>
                <div className="mb-4 p-3 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">Album en lecture</p>
                  <p className="text-sm font-medium text-foreground">
                    {currentTrack?.album}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {currentTrack?.artist}
                  </p>
                </div>
                <div className="space-y-0.5">
                  {albumTracksForFile.map((track) => (
                    <TrackItem
                      key={track.id}
                      track={track}
                      onClick={() => onPlayTrack?.(track)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {currentTrack 
                  ? currentTrack.mediaSource === 'youtube'
                    ? "Les vidéos YouTube n'ont pas d'album associé"
                    : `Aucune autre piste dans l'album "${currentTrack.album}"`
                  : "Aucun album en lecture"}
              </div>
            )}
          </TabsContent>

          {/* Similaire: Flux YouTube pour tracks YouTube, tracks locaux pour tracks locaux */}
          <TabsContent value="similar" className="p-4 mt-0">
            {loadingYouTubeSimilar && currentTrack?.mediaSource === 'youtube' ? (
              <div className="text-center py-8 text-muted-foreground text-sm flex flex-col items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Chargement du flux YouTube...</span>
              </div>
            ) : similarTracksForDisplay.length > 0 ? (
              <div>
                {currentTrack && (
                  <div className="mb-4 p-3 rounded-lg bg-muted/30 border border-border/30">
                    <p className="text-xs text-muted-foreground mb-1">
                      {currentTrack.mediaSource === 'youtube' ? 'Flux YouTube' : 'Bibliothèque locale'}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {currentTrack.artist}
                    </p>
                    {currentTrack.mediaSource === 'youtube' && (
                      <p className="text-xs text-muted-foreground">
                        {currentTrack.album}
                      </p>
                    )}
                  </div>
                )}
                <div className="space-y-0.5">
                  {similarTracksForDisplay.map((track) => (
                    <TrackItem
                      key={track.id}
                      track={track}
                      onClick={() => onPlayTrack?.(track)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {currentTrack?.mediaSource === 'youtube' 
                  ? "Aucune vidéo YouTube similaire trouvée"
                  : "Aucune piste similaire trouvée"}
              </div>
            )}
          </TabsContent>

          {/* Historique */}
          <TabsContent value="history" className="p-4 mt-0">
            {historyTracks.length > 0 ? (
              <div className="space-y-0.5">
                {historyTracks.map((track) => (
                  <TrackItem
                    key={track.id}
                    track={track}
                    onClick={() => onPlayTrack?.(track)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Aucun historique disponible
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
};
