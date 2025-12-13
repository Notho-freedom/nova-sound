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
}: NowPlayingBarProps) => {
  const VolumeIcon = isMuted || volume === 0 
    ? VolumeX 
    : volume < 50 
      ? Volume1 
      : Volume2;

  const progress = currentTrack.duration > 0 
    ? (currentTime / currentTrack.duration) * 100 
    : 0;

  return (
    <div className="bg-card/80 backdrop-blur-md border-t border-border/50 flex flex-col">
      {/* Progress Bar - Full width at top */}
      <div className="h-1 w-full bg-muted/30 cursor-pointer group" onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        onSeek([percent * currentTrack.duration]);
      }}>
        <div 
          className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-150 relative"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity shadow-lg shadow-primary/50" />
        </div>
      </div>

      {/* Main Content - Compact 2 rows */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-3 relative">
          {/* Cover + Track Info - Left */}
          <div className="flex items-center gap-3 min-w-0 w-64 flex-shrink-0">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={onShowPlayer}
                  className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 relative group ring-2 ring-transparent hover:ring-primary/50 transition-all duration-300"
                >
                  <img 
                    src={getCoverUrl(currentTrack.coverUrl)} 
                    alt={currentTrack.album}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Maximize2 className="w-4 h-4 text-white" />
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent>Ouvrir le lecteur</TooltipContent>
            </Tooltip>
            
            <div className="flex-1 min-w-0">
              <p 
                onClick={onShowPlayer}
                className="text-sm font-medium truncate text-foreground hover:text-primary cursor-pointer transition-colors"
              >
                {currentTrack.title}
              </p>
              <div className="text-xs text-muted-foreground truncate">
                <span 
                  onClick={onNavigateToArtist}
                  className="hover:text-foreground cursor-pointer transition-colors"
                >
                  {currentTrack.artist}
                </span>
                <span className="mx-1">•</span>
                <span 
                  onClick={onNavigateToAlbum}
                  className="hover:text-foreground cursor-pointer transition-colors"
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
                    "p-1.5 rounded-full transition-all duration-200",
                    isShuffle 
                      ? "text-primary" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Shuffle className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Lecture aléatoire {isShuffle ? "activée" : "désactivée"}</TooltipContent>
            </Tooltip>
            
            <button
              onClick={onPrevious}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>
            
            <button
              onClick={onPlayPause}
              className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 hover:shadow-lg hover:shadow-primary/30 transition-all duration-200"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>
            
            <button
              onClick={onNext}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
            
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={onRepeat}
                  className={cn(
                    "p-1.5 rounded-full transition-all duration-200",
                    repeatMode !== "off" 
                      ? "text-primary" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {repeatMode === "one" ? (
                    <Repeat1 className="w-4 h-4" />
                  ) : (
                    <Repeat className="w-4 h-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {repeatMode === "off" ? "Répéter désactivé" : repeatMode === "all" ? "Répéter tout" : "Répéter un"}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-0.5 w-64 justify-end ml-auto flex-shrink-0">
            {/* Time Display */}
            <div className="text-xs text-muted-foreground font-mono w-24 text-center mr-2">
              {formatTime(currentTime)} / {formatTime(currentTrack.duration)}
            </div>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleFavorite}
                  className={cn(
                    "p-1.5 rounded-full transition-all duration-200",
                    isFavorite 
                      ? "text-red-500" 
                      : "text-muted-foreground hover:text-red-500"
                  )}
                >
                  <Heart className={cn("w-4 h-4", isFavorite && "fill-current")} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}</TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={onShowLyrics}
                  className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Mic2 className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Paroles</TooltipContent>
            </Tooltip>
            
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleQueue}
                  className={cn(
                    "p-1.5 rounded-full transition-all duration-200",
                    isQueueOpen 
                      ? "text-primary" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ListMusic className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>File d'attente</TooltipContent>
            </Tooltip>
            
            {/* Volume */}
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={onMuteToggle}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <VolumeIcon className="w-4 h-4" />
              </button>
              <Slider
                value={[isMuted ? 0 : volume]}
                max={100}
                step={1}
                onValueChange={onVolumeChange}
                className="w-20"
              />
            </div>

            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={onFullscreen}
                  className="p-1.5 text-muted-foreground hover:text-foreground transition-colors ml-1"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Plein écran</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
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
                    toast.success("Copié dans le presse-papier");
                  }
                }}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Partager
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const info = `Titre: ${currentTrack.title}\nArtiste: ${currentTrack.artist}\nAlbum: ${currentTrack.album}\nDurée: ${formatTime(currentTrack.duration)}${currentTrack.genre ? `\nGenre: ${currentTrack.genre}` : ''}${currentTrack.year ? `\nAnnée: ${currentTrack.year}` : ''}`;
                  toast.info(info, { duration: 5000 });
                }}>
                  <Info className="w-4 h-4 mr-2" />
                  Infos de la piste
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => toast.info("Radio basée sur ce titre - Bientôt disponible")}>
                  <Radio className="w-4 h-4 mr-2" />
                  Démarrer une radio
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  if (onNavigateToAlbum) {
                    onNavigateToAlbum();
                  } else {
                    toast.info(`Aller à l'album "${currentTrack.album}"`);
                  }
                }}>
                  <Disc3 className="w-4 h-4 mr-2" />
                  Aller à l'album
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  if (onNavigateToArtist) {
                    onNavigateToArtist();
                  } else {
                    toast.info(`Aller à l'artiste "${currentTrack.artist}"`);
                  }
                }}>
                  <Users className="w-4 h-4 mr-2" />
                  Aller à l'artiste
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
};
