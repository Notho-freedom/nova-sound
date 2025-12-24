import { X, GripVertical, Play, Pause, Disc3, Radio, Clock, Loader2, ListMusic, Youtube, Music2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  onRemoveFromQueue?: (trackId: string) => void; // Supprimer un track de la file
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
  onRemoveFromQueue,
}: QueuePanelProps) => {
  const currentTrack = propCurrentTrack || tracks[currentTrackIndex];
  const [queueFilter, setQueueFilter] = useState<'all' | 'youtube' | 'local'>('all');

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
  // Se met à jour automatiquement quand currentTrack ou albumTracks changent
  const albumTracksForFile = useMemo(() => {
    // Si pas de track actuel, retourner un tableau vide
    if (!currentTrack) {
      console.log('[QueuePanel] Pas de currentTrack');
      return [];
    }
    
    // Pour les tracks YouTube, pas d'album réel
    if (currentTrack.mediaSource === 'youtube') {
      return [];
    }
    
    // Si pas de tracks d'album fournis, retourner un tableau vide
    if (!albumTracks || albumTracks.length === 0) {
      console.log('[QueuePanel] Pas de albumTracks fournis', {
        albumTracksLength: albumTracks?.length,
        currentTrackAlbum: currentTrack.album,
        currentTrackArtist: currentTrack.artist,
      });
      return [];
    }
    
    // Les albumTracks sont déjà filtrés par album et artiste dans DesktopApp
    // On doit juste exclure le track actuel
    // Utiliser une comparaison stricte pour éviter les problèmes de type
    const filtered = albumTracks.filter(t => {
      // Comparer par ID d'abord
      if (t.id === currentTrack.id) return false;
      // Si les IDs ne correspondent pas mais que c'est le même fichier, exclure aussi
      if (t.filePath && currentTrack.filePath && t.filePath === currentTrack.filePath) return false;
      return true;
    });
    
    console.log('[QueuePanel] albumTracksForFile calculé', {
      albumTracksCount: albumTracks.length,
      currentTrackId: currentTrack.id,
      currentTrackTitle: currentTrack.title,
      currentTrackAlbum: currentTrack.album,
      currentTrackArtist: currentTrack.artist,
      currentTrackFilePath: currentTrack.filePath,
      filteredCount: filtered.length,
      albumTracksIds: albumTracks.map(t => t.id),
    });
    
    return filtered;
  }, [currentTrack, albumTracks]);

  // Similaire: Utiliser les tracks YouTube si c'est un track YouTube, sinon les tracks locaux
  const similarTracksForDisplay = currentTrack?.mediaSource === 'youtube' 
    ? youtubeSimilarTracks 
    : propSimilarTracks;

  // File d'attente réelle (tous les tracks ajoutés à la queue)
  // Exclure le track actuel de la file d'attente affichée
  const queueTracks = useMemo(() => {
    const upcomingTracks = tracks.filter((_, index) => index > currentTrackIndex);
    return upcomingTracks;
  }, [tracks, currentTrackIndex]);

  // Stats et filtrage de la file d'attente
  const queueStats = useMemo(() => {
    const youtubeCount = queueTracks.filter(t => t.mediaSource === 'youtube').length;
    const localCount = queueTracks.filter(t => t.mediaSource !== 'youtube').length;
    return { youtubeCount, localCount, total: queueTracks.length };
  }, [queueTracks]);

  // Filtrer les tracks de la file selon le filtre actif
  const filteredQueueTracks = useMemo(() => {
    if (queueFilter === 'all') return queueTracks;
    if (queueFilter === 'youtube') return queueTracks.filter(t => t.mediaSource === 'youtube');
    return queueTracks.filter(t => t.mediaSource !== 'youtube');
  }, [queueTracks, queueFilter]);

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
      <Tabs defaultValue="queue" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 pt-2 border-b border-border">
          <TabsList className="w-full grid grid-cols-4 h-auto bg-muted/30">
            <TabsTrigger 
              value="queue" 
              className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              <ListMusic className="w-3 h-3 mr-1" />
              Queue ({queueStats.total})
            </TabsTrigger>
            <TabsTrigger 
              value="file" 
              className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              <Disc3 className="w-3 h-3 mr-1" />
              Album ({albumTracksForFile.length})
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
          {/* Queue: File d'attente réelle avec détection YouTube/Local */}
          <TabsContent value="queue" className="p-4 mt-0">
            {queueTracks.length > 0 ? (
              <div>
                {/* Filtres YouTube / Local */}
                <div className="mb-4 flex items-center gap-2">
                  <button
                    onClick={() => setQueueFilter('all')}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-full transition-all duration-200",
                      queueFilter === 'all' 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    Tous ({queueStats.total})
                  </button>
                  {queueStats.youtubeCount > 0 && (
                    <button
                      onClick={() => setQueueFilter('youtube')}
                      className={cn(
                        "px-3 py-1.5 text-xs rounded-full transition-all duration-200 flex items-center gap-1.5",
                        queueFilter === 'youtube' 
                          ? "bg-red-500/90 text-white" 
                          : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      )}
                    >
                      <Youtube className="w-3 h-3" />
                      YouTube ({queueStats.youtubeCount})
                    </button>
                  )}
                  {queueStats.localCount > 0 && (
                    <button
                      onClick={() => setQueueFilter('local')}
                      className={cn(
                        "px-3 py-1.5 text-xs rounded-full transition-all duration-200 flex items-center gap-1.5",
                        queueFilter === 'local' 
                          ? "bg-emerald-500/90 text-white" 
                          : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                      )}
                    >
                      <Music2 className="w-3 h-3" />
                      Local ({queueStats.localCount})
                    </button>
                  )}
                </div>

                {/* Info de la file */}
                <div className="mb-4 p-3 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">File d'attente</p>
                  <p className="text-sm font-medium text-foreground">
                    {filteredQueueTracks.length} {filteredQueueTracks.length === 1 ? 'piste à venir' : 'pistes à venir'}
                  </p>
                  {queueStats.youtubeCount > 0 && queueStats.localCount > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {queueStats.youtubeCount} YouTube • {queueStats.localCount} local
                    </p>
                  )}
                </div>

                {/* Liste des tracks */}
                <div className="space-y-0.5">
                  {filteredQueueTracks.map((track, index) => (
                    <div key={`${track.id}-${index}`} className="group relative">
                      <div className="flex items-center gap-2">
                        {/* Indicateur YouTube/Local */}
                        <div className={cn(
                          "w-1 h-10 rounded-full flex-shrink-0",
                          track.mediaSource === 'youtube' ? "bg-red-500/60" : "bg-emerald-500/60"
                        )} />
                        
                        <div className="flex-1">
                          <TrackItem
                            track={track}
                            onClick={() => onPlayTrack?.(track)}
                          />
                        </div>

                        {/* Bouton supprimer */}
                        {onRemoveFromQueue && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveFromQueue(track.id);
                            }}
                            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/20 text-destructive transition-all duration-200"
                            title="Retirer de la file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <ListMusic className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>La file d'attente est vide</p>
                <p className="text-xs mt-1">Ajoutez des pistes depuis la bibliothèque ou YouTube</p>
              </div>
            )}
          </TabsContent>

          {/* File: Flux de l'album complet */}
          <TabsContent value="file" className="p-4 mt-0">
            {albumTracksForFile.length > 0 ? (
              <div>
                <div className="mb-4 p-3 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">Album en lecture</p>
                  <p className="text-sm font-medium text-foreground">
                    {currentTrack?.album || 'Album inconnu'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {currentTrack?.artist || 'Artiste inconnu'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {albumTracksForFile.length} {albumTracksForFile.length === 1 ? 'piste' : 'pistes'} disponible{albumTracksForFile.length > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="space-y-0.5">
                  {albumTracksForFile.map((track, index) => (
                    <TrackItem
                      key={`${track.id}-${index}`}
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
                    : currentTrack.album
                      ? `Aucune autre piste dans l'album "${currentTrack.album}" de ${currentTrack.artist}`
                      : `Aucun album associé à "${currentTrack.title}"`
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
                  {similarTracksForDisplay.map((track, index) => (
                    <TrackItem
                      key={`${track.id}-${index}`}
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
                {historyTracks.map((track, index) => (
                  <TrackItem
                    key={`${track.id}-${index}`}
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
