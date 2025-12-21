import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Repeat1,
  Volume2, 
  VolumeX,
  Volume1,
  Heart,
  ListMusic,
  Maximize2,
  Mic2,
  MoreHorizontal,
  Share2,
  Info,
  Radio,
  Disc3,
  Users,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import { Track } from "@/types/music";
import { toast } from "sonner";
import { useNotifications } from "@/hooks/useNotifications";

interface NowPlayingBarProps {
  currentTrack: Track;
  isPlaying: boolean;
  currentTime: number;
  isShuffle: boolean;
  repeatMode: "off" | "all" | "one";
  volume: number;
  isMuted: boolean;
  isFavorite?: boolean;
  audioElement?: HTMLAudioElement | null;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onShuffle: () => void;
  onRepeat: () => void;
  onSeek: (value: number[]) => void;
  onVolumeChange: (value: number[]) => void;
  onMuteToggle: () => void;
  onToggleQueue: () => void;
  onFullscreen: () => void;
  onToggleFavorite?: () => void;
  onShowPlayer?: () => void;
  onShowLyrics?: () => void;
  onNavigateToAlbum?: () => void;
  onNavigateToArtist?: () => void;
  isQueueOpen: boolean;
  youtubeDuration?: number; // Durée du player YouTube (si différente de currentTrack.duration)
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const NowPlayingBar = ({
  currentTrack,
  isPlaying,
  currentTime,
  isShuffle,
  repeatMode,
  volume,
  isMuted,
  isFavorite = false,
  onPlayPause,
  onPrevious,
  onNext,
  onShuffle,
  onRepeat,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onToggleQueue,
  onFullscreen,
  onToggleFavorite,
  onShowPlayer,
  onShowLyrics,
  onNavigateToAlbum,
  onNavigateToArtist,
  isQueueOpen,
  youtubeDuration,
}: NowPlayingBarProps) => {
  const VolumeIcon = isMuted || volume === 0 
    ? VolumeX 
    : volume < 50 
      ? Volume1 
      : Volume2;

  // Arrondir currentTime pour l'affichage seulement (évite le clignotement des compteurs)
  const roundedCurrentTime = Math.floor(currentTime);
  // Utiliser youtubeDuration si disponible (pour les tracks YouTube), sinon currentTrack.duration
  const effectiveDuration = youtubeDuration || currentTrack.duration || 0;
  const progress = effectiveDuration > 0 
    ? (currentTime / effectiveDuration) * 100 
    : 0;

  const { notifySuccess, notify } = useNotifications();

  return (
    <div className="bg-card/80 backdrop-blur-md border-t border-border/50 flex flex-col">
      {/* Progress Bar - Full width at top */}
      <div className="h-1 w-full bg-muted/30 cursor-pointer group" onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        onSeek([percent * effectiveDuration]);
      }}>
        <div 
          className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-200 ease-out relative"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out shadow-lg shadow-primary/50" />
        </div>
      </div>

      {/* Main Content - Compact 2 rows */}
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-4 relative">
          {/* Cover + Track Info - Left */}
          <div className="flex items-center gap-3 min-w-0 w-64 flex-shrink-0">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={onShowPlayer}
                  className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 relative group ring-2 ring-transparent hover:ring-primary/50 transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                >
                  <img 
                    src={getCoverUrl(currentTrack.coverUrl)} 
                    alt={currentTrack.album}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200 ease-out"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out">
                    <Maximize2 className="w-4 h-4 text-white" />
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent>Ouvrir le lecteur</TooltipContent>
            </Tooltip>
            
            <div className="flex-1 min-w-0">
              <p 
                onClick={onShowPlayer}
                className="text-sm font-medium truncate text-foreground hover:text-primary cursor-pointer transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 rounded"
              >
                {currentTrack.title}
              </p>
              <div className="text-xs text-muted-foreground truncate">
                <span 
                  onClick={onNavigateToArtist}
                  className="hover:text-foreground cursor-pointer transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 rounded"
                >
                  {currentTrack.artist}
                </span>
                <span className="mx-1">•</span>
                <span 
                  onClick={onNavigateToAlbum}
                  className="hover:text-foreground cursor-pointer transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 rounded"
                >
                  {currentTrack.album}
                </span>
              </div>
            </div>
          </div>

          {/* Center Controls - Absolutely centered */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center gap-1">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={onShuffle}
                  className={cn(
                    "p-1.5 rounded-full transition-all duration-200 ease-out active:scale-95",
                    isShuffle 
                      ? "text-primary" 
                      : "text-muted-foreground hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                  )}
                >
                  <Shuffle className="w-4 h-4 hover:scale-105 transition-transform duration-200 ease-out" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Lecture aléatoire {isShuffle ? "activée" : "désactivée"}</TooltipContent>
            </Tooltip>
            
            <button
              onClick={onPrevious}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 rounded"
            >
              <SkipBack className="w-5 h-5 fill-current hover:scale-105 transition-transform duration-200 ease-out" />
            </button>
            
            <button
              onClick={onPlayPause}
              className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 hover:shadow-lg hover:shadow-primary/30 transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>
            
            <button
              onClick={onNext}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 rounded"
            >
              <SkipForward className="w-5 h-5 fill-current group-hover:scale-105 transition-transform duration-200 ease-out" />
            </button>
            
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={onRepeat}
                  className={cn(
                    "p-1.5 rounded-full transition-all duration-200 ease-out active:scale-95",
                    repeatMode !== "off" 
                      ? "text-primary" 
                      : "text-muted-foreground hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                  )}
                >
                  {repeatMode === "one" ? (
                    <Repeat1 className="w-4 h-4 group-hover:scale-105 transition-transform duration-200 ease-out" />
                  ) : (
                    <Repeat className="w-4 h-4 group-hover:scale-105 transition-transform duration-200 ease-out" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {repeatMode === "off" ? "Répéter désactivé" : repeatMode === "all" ? "Répéter tout" : "Répéter un"}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1 w-64 justify-end ml-auto flex-shrink-0">
            {/* Time Display - Hidden when volume slider expands */}
            <div className="text-xs text-muted-foreground font-mono w-24 text-center mr-2 transition-all duration-200 group-hover/volume:opacity-0 group-hover/volume:w-0 group-hover/volume:overflow-hidden group-hover/volume:mr-0">
              {formatTime(roundedCurrentTime)} / {formatTime(currentTrack.duration)}
            </div>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleFavorite}
                  className={cn(
                    "p-1.5 rounded-full transition-all duration-200 ease-out active:scale-95",
                    isFavorite 
                      ? "text-red-500" 
                      : "text-muted-foreground hover:text-red-500",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                  )}
                >
                  <Heart className={cn("w-4 h-4 hover:scale-105 transition-transform duration-200 ease-out", isFavorite && "fill-current")} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}</TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={onShowLyrics}
                  className="p-1.5 text-muted-foreground hover:text-foreground transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 rounded"
                >
                  <Mic2 className="w-4 h-4 hover:scale-105 transition-transform duration-200 ease-out" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Paroles</TooltipContent>
            </Tooltip>
            
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleQueue}
                  className={cn(
                    "p-1.5 rounded-full transition-all duration-200 ease-out active:scale-95",
                    isQueueOpen 
                      ? "text-primary" 
                      : "text-muted-foreground hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                  )}
                >
                  <ListMusic className="w-4 h-4 hover:scale-105 transition-transform duration-200 ease-out" />
                </button>
              </TooltipTrigger>
              <TooltipContent>File d'attente</TooltipContent>
            </Tooltip>
            
            {/* Volume */}
            <div className="flex items-center gap-1 ml-2 group/volume">
              <button
                onClick={onMuteToggle}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 rounded"
              >
                <VolumeIcon className="w-4 h-4 hover:scale-105 transition-transform duration-200 ease-out" />
              </button>
              <div className="w-0 group-hover/volume:w-20 overflow-hidden transition-all duration-200 ease-out">
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={100}
                  step={1}
                  onValueChange={onVolumeChange}
                  className="w-20"
                />
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 text-muted-foreground hover:text-foreground transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 rounded">
                  <MoreHorizontal className="w-4 h-4 hover:scale-105 transition-transform duration-200 ease-out" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: currentTrack.title,
                      text: `${currentTrack.title} - ${currentTrack.artist}`,
                    }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(`${currentTrack.title} - ${currentTrack.artist}`);
                    const message = "Copié dans le presse-papier";
                    toast.success(message);
                    notifySuccess(message);
                  }
                }}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Partager
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const info = `Titre: ${currentTrack.title}\nArtiste: ${currentTrack.artist}\nAlbum: ${currentTrack.album}\nDurée: ${formatTime(currentTrack.duration)}${currentTrack.genre ? `\nGenre: ${currentTrack.genre}` : ''}${currentTrack.year ? `\nAnnée: ${currentTrack.year}` : ''}`;
                  toast.info(info, { duration: 5000 });
                  notify({ title: "Infos de la piste", description: info, type: "info" });
                }}>
                  <Info className="w-4 h-4 mr-2" />
                  Infos de la piste
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => {
                    // Radio functionality: play similar tracks based on current track
                    // This would require implementing a recommendation algorithm
                    const message = "Fonctionnalité radio - En développement";
                    toast.info(message, {
                      description: "Cette fonctionnalité sera disponible dans une prochaine mise à jour"
                    });
                    notify({ title: message, description: "Cette fonctionnalité sera disponible dans une prochaine mise à jour", type: "info" });
                  }}
                  disabled
                >
                  <Radio className="w-4 h-4 mr-2" />
                  Démarrer une radio
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  if (onNavigateToAlbum) {
                    onNavigateToAlbum();
                  } else {
                    const message = `Aller à l'album "${currentTrack.album}"`;
                    toast.info(message);
                    notify({ title: message, type: "info" });
                  }
                }}>
                  <Disc3 className="w-4 h-4 mr-2" />
                  Aller à l'album
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  if (onNavigateToArtist) {
                    onNavigateToArtist();
                  } else {
                    const message = `Aller à l'artiste "${currentTrack.artist}"`;
                    toast.info(message);
                    notify({ title: message, type: "info" });
                  }
                }}>
                  <Users className="w-4 h-4 mr-2" />
                  Aller à l'artiste
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onFullscreen}>
                  <Maximize2 className="w-4 h-4 mr-2" />
                  Plein écran
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
};
