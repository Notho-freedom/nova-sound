"use client"

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
  Disc3,
  Users,
  Airplay,
} from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { getCoverUrl } from "@/lib/audio"
import type { Track } from "@/types/music"
import { toast } from "sonner"
import { useNotifications } from "@/hooks/useNotifications"
import { useState } from "react"

interface NowPlayingBarProps {
  currentTrack: Track
  isPlaying: boolean
  currentTime: number
  isShuffle: boolean
  repeatMode: "off" | "all" | "one"
  volume: number
  isMuted: boolean
  isFavorite?: boolean
  audioElement?: HTMLAudioElement | null
  onPlayPause: () => void
  onPrevious: () => void
  onNext: () => void
  onShuffle: () => void
  onRepeat: () => void
  onSeek: (value: number[]) => void
  onVolumeChange: (value: number[]) => void
  onMuteToggle: () => void
  onToggleQueue: () => void
  onFullscreen: () => void
  onToggleFavorite?: () => void
  onShowPlayer?: () => void
  onShowLyrics?: () => void
  onNavigateToAlbum?: () => void
  onNavigateToArtist?: () => void
  isQueueOpen: boolean
  youtubeDuration?: number
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

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
  const [isHoveringProgress, setIsHoveringProgress] = useState(false)
  const [isHoveringVolume, setIsHoveringVolume] = useState(false)

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2

  const roundedCurrentTime = Math.floor(currentTime)
  const effectiveDuration = youtubeDuration || currentTrack.duration || 0
  const progress = effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0

  const { notifySuccess, notify } = useNotifications()

  return (
    <TooltipProvider>
      <div
        className={cn(
          "relative flex flex-col",
          "bg-gradient-to-t from-black/90 via-card/80 to-card/60",
          "backdrop-blur-2xl border-t border-white/5",
        )}
      >
        {/* Ambient glow from album art */}
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 10% 50%, hsl(var(--primary) / 0.3), transparent 50%)`,
          }}
        />

        {/* Progress Bar - Interactive full width */}
        <div
          className="relative h-1.5 w-full group cursor-pointer"
          onMouseEnter={() => setIsHoveringProgress(true)}
          onMouseLeave={() => setIsHoveringProgress(false)}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const percent = (e.clientX - rect.left) / rect.width
            onSeek([percent * effectiveDuration])
          }}
        >
          {/* Background track */}
          <div className="absolute inset-0 bg-white/5" />

          {/* Buffered indicator */}
          <div className="absolute inset-y-0 left-0 w-1/3 bg-white/10" />

          {/* Progress fill with gradient */}
          <div
            className="absolute inset-y-0 left-0 transition-all duration-150 ease-out"
            style={{ width: `${progress}%` }}
          >
            <div className="h-full bg-gradient-to-r from-primary via-primary to-secondary" />
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/50 to-secondary/50 blur-sm" />
          </div>

          {/* Hover scrubber */}
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full",
              "bg-white shadow-lg shadow-black/50",
              "transition-all duration-200",
              isHoveringProgress ? "opacity-100 scale-100" : "opacity-0 scale-75",
            )}
            style={{ left: `calc(${progress}% - 8px)` }}
          />
        </div>

        {/* Main Content */}
        <div className="relative px-4 py-3">
          <div className="flex items-center gap-4">
            {/* Left: Track Info */}
            <div className="flex items-center gap-4 min-w-0 w-[280px] flex-shrink-0">
              {/* Album Art with hover effect */}
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={onShowPlayer}
                    className={cn(
                      "relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 group",
                      "ring-2 ring-white/10 hover:ring-primary/50",
                      "transition-all duration-300 ease-out",
                      "hover:shadow-xl hover:shadow-primary/20",
                      "active:scale-95",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    )}
                  >
                    <img
                      src={getCoverUrl(currentTrack.coverUrl) || "/placeholder.svg"}
                      alt={currentTrack.album}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    {/* Now playing animation overlay */}
                    {isPlaying && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <div className="flex items-end gap-0.5 h-4">
                          <div className="w-1 bg-primary rounded-full animate-wave" style={{ height: "100%" }} />
                          <div
                            className="w-1 bg-primary rounded-full animate-wave"
                            style={{ animationDelay: "0.1s", height: "70%" }}
                          />
                          <div
                            className="w-1 bg-primary rounded-full animate-wave"
                            style={{ animationDelay: "0.2s", height: "85%" }}
                          />
                          <div
                            className="w-1 bg-primary rounded-full animate-wave"
                            style={{ animationDelay: "0.3s", height: "60%" }}
                          />
                        </div>
                      </div>
                    )}
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <Maximize2 className="w-5 h-5 text-white" />
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Ouvrir le lecteur</TooltipContent>
              </Tooltip>

              {/* Track details */}
              <div className="flex-1 min-w-0">
                <button
                  onClick={onShowPlayer}
                  className="text-sm font-semibold truncate text-foreground hover:text-primary transition-colors duration-200 block w-full text-left"
                >
                  {currentTrack.title}
                </button>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <button
                    onClick={onNavigateToArtist}
                    className="hover:text-foreground hover:underline transition-colors truncate"
                  >
                    {currentTrack.artist}
                  </button>
                  <span className="text-muted-foreground/40">•</span>
                  <button
                    onClick={onNavigateToAlbum}
                    className="hover:text-foreground hover:underline transition-colors truncate"
                  >
                    {currentTrack.album}
                  </button>
                </div>
              </div>

              {/* Quick actions */}
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={onToggleFavorite}
                    className={cn(
                      "p-2 rounded-full transition-all duration-300",
                      isFavorite ? "text-rose-500 hover:text-rose-400" : "text-muted-foreground/50 hover:text-rose-500",
                      "hover:bg-white/5 active:scale-95",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    )}
                  >
                    <Heart
                      className={cn(
                        "w-4 h-4 transition-transform duration-300",
                        isFavorite && "fill-current scale-110",
                      )}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}</TooltipContent>
              </Tooltip>
            </div>

            {/* Center: Playback Controls */}
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="flex items-center gap-2">
                {/* Shuffle */}
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onShuffle}
                      className={cn(
                        "p-2 rounded-full transition-all duration-300",
                        isShuffle ? "text-primary bg-primary/10" : "text-muted-foreground/50 hover:text-foreground",
                        "hover:bg-white/5 active:scale-95",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                      )}
                    >
                      <Shuffle className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Lecture aléatoire {isShuffle ? "activée" : "désactivée"}</TooltipContent>
                </Tooltip>

                {/* Previous */}
                <button
                  onClick={onPrevious}
                  className={cn(
                    "p-2 rounded-full transition-all duration-300",
                    "text-foreground/80 hover:text-foreground",
                    "hover:bg-white/5 active:scale-90",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  )}
                >
                  <SkipBack className="w-5 h-5 fill-current" />
                </button>

                {/* Play/Pause - Main button */}
                <button
                  onClick={onPlayPause}
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center",
                    "bg-white text-black",
                    "hover:scale-105 hover:shadow-xl hover:shadow-white/20",
                    "active:scale-95",
                    "transition-all duration-300 ease-out",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  )}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  )}
                </button>

                {/* Next */}
                <button
                  onClick={onNext}
                  className={cn(
                    "p-2 rounded-full transition-all duration-300",
                    "text-foreground/80 hover:text-foreground",
                    "hover:bg-white/5 active:scale-90",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  )}
                >
                  <SkipForward className="w-5 h-5 fill-current" />
                </button>

                {/* Repeat */}
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onRepeat}
                      className={cn(
                        "p-2 rounded-full transition-all duration-300",
                        repeatMode !== "off"
                          ? "text-primary bg-primary/10"
                          : "text-muted-foreground/50 hover:text-foreground",
                        "hover:bg-white/5 active:scale-95",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                      )}
                    >
                      {repeatMode === "one" ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {repeatMode === "off" ? "Répéter désactivé" : repeatMode === "all" ? "Répéter tout" : "Répéter un"}
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Time display */}
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[11px] font-mono text-muted-foreground/60 w-10 text-right">
                  {formatTime(roundedCurrentTime)}
                </span>
                <span className="text-[11px] text-muted-foreground/30">/</span>
                <span className="text-[11px] font-mono text-muted-foreground/60 w-10">
                  {formatTime(effectiveDuration)}
                </span>
              </div>
            </div>

            {/* Right: Secondary Controls */}
            <div className="flex items-center gap-1 w-[280px] justify-end flex-shrink-0">
              {/* Lyrics */}
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={onShowLyrics}
                    className={cn(
                      "p-2 rounded-full transition-all duration-300",
                      "text-muted-foreground/50 hover:text-foreground",
                      "hover:bg-white/5 active:scale-95",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    )}
                  >
                    <Mic2 className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Paroles</TooltipContent>
              </Tooltip>

              {/* Queue */}
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={onToggleQueue}
                    className={cn(
                      "p-2 rounded-full transition-all duration-300",
                      isQueueOpen ? "text-primary bg-primary/10" : "text-muted-foreground/50 hover:text-foreground",
                      "hover:bg-white/5 active:scale-95",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    )}
                  >
                    <ListMusic className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>File d'attente</TooltipContent>
              </Tooltip>

              {/* Devices */}
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      "p-2 rounded-full transition-all duration-300",
                      "text-muted-foreground/50 hover:text-foreground",
                      "hover:bg-white/5 active:scale-95",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    )}
                  >
                    <Airplay className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Appareils</TooltipContent>
              </Tooltip>

              {/* Volume */}
              <div
                className="flex items-center gap-1 ml-2"
                onMouseEnter={() => setIsHoveringVolume(true)}
                onMouseLeave={() => setIsHoveringVolume(false)}
              >
                <button
                  onClick={onMuteToggle}
                  className={cn(
                    "p-2 rounded-full transition-all duration-300",
                    "text-muted-foreground/50 hover:text-foreground",
                    "hover:bg-white/5 active:scale-95",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  )}
                >
                  <VolumeIcon className="w-4 h-4" />
                </button>
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-300 ease-out",
                    isHoveringVolume ? "w-24 opacity-100" : "w-0 opacity-0",
                  )}
                >
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    max={100}
                    step={1}
                    onValueChange={onVolumeChange}
                    className="w-24"
                  />
                </div>
              </div>

              {/* Fullscreen */}
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={onFullscreen}
                    className={cn(
                      "p-2 rounded-full transition-all duration-300",
                      "text-muted-foreground/50 hover:text-foreground",
                      "hover:bg-white/5 active:scale-95",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    )}
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Plein écran</TooltipContent>
              </Tooltip>

              {/* More options */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "p-2 rounded-full transition-all duration-300",
                      "text-muted-foreground/50 hover:text-foreground",
                      "hover:bg-white/5 active:scale-95",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    )}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 bg-card/95 backdrop-blur-xl border-white/10">
                  <DropdownMenuItem
                    onClick={() => {
                      if (navigator.share) {
                        navigator
                          .share({
                            title: currentTrack.title,
                            text: `${currentTrack.title} - ${currentTrack.artist}`,
                          })
                          .catch(() => {})
                      } else {
                        navigator.clipboard.writeText(`${currentTrack.title} - ${currentTrack.artist}`)
                        toast.success("Copié dans le presse-papier")
                        notifySuccess("Copié dans le presse-papier")
                      }
                    }}
                  >
                    <Share2 className="w-4 h-4 mr-3" />
                    Partager
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      const info = `Titre: ${currentTrack.title}\nArtiste: ${currentTrack.artist}\nAlbum: ${currentTrack.album}\nDurée: ${formatTime(currentTrack.duration)}`
                      toast.info(info, { duration: 5000 })
                    }}
                  >
                    <Info className="w-4 h-4 mr-3" />
                    Infos de la piste
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/5" />
                  <DropdownMenuItem onClick={onNavigateToAlbum}>
                    <Disc3 className="w-4 h-4 mr-3" />
                    Aller à l'album
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onNavigateToArtist}>
                    <Users className="w-4 h-4 mr-3" />
                    Aller à l'artiste
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
