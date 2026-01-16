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
  Sparkles,
  Brain,
  TrendingUp,
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
import type { AIAnalysisResult } from "@/hooks/useAudioAI"

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
  onShowArtistInfo?: () => void
  onNavigateToAlbum?: () => void
  onNavigateToArtist?: () => void
  isQueueOpen: boolean
  youtubeDuration?: number
  audioAnalysis?: AIAnalysisResult | null
  onStartAIAnalysis?: () => void
  isAudioAIPro?: boolean
  // onShowKaraoke?: () => void // DÉSACTIVÉ - Système karaoke désactivé
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
  onShowArtistInfo,
  onNavigateToAlbum,
  onNavigateToArtist,
  isQueueOpen,
  youtubeDuration,
  audioAnalysis,
  onStartAIAnalysis,
  isAudioAIPro = false,
  // onShowKaraoke, // DÉSACTIVÉ
}: NowPlayingBarProps) => {
  const [isHoveringVolume, setIsHoveringVolume] = useState(false)

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2

  const roundedCurrentTime = Math.floor(currentTime)
  const effectiveDuration = youtubeDuration || currentTrack.duration || 0
  const progress = effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0

  const { notifySuccess, notify } = useNotifications()

  return (
    <TooltipProvider>
      <div
        data-coachmark="player-bar"
        className={cn(
          "relative flex flex-col",
          "bg-gradient-to-t from-black/90 via-card/80 to-card/60",
          "backdrop-blur-2xl border-t border-white/5",
        )}
      >
        {/* Ambient glow from album art */}
        <div className="absolute inset-0 opacity-30 pointer-events-none now-playing-ambient" />

        {/* Progress Bar - Interactive full width */}
        <div
          className="relative h-1.5 w-full group cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const percent = (e.clientX - rect.left) / rect.width
            onSeek([percent * effectiveDuration])
          }}
        >
          <progress className="now-playing-progress" value={progress} max={100} />
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
                    aria-label="Ouvrir le lecteur"
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
                          <div className="w-1 bg-primary rounded-full animate-wave wave-bar-full" />
                          <div className="w-1 bg-primary rounded-full animate-wave wave-bar-70 wave-delay-100" />
                          <div className="w-1 bg-primary rounded-full animate-wave wave-bar-85 wave-delay-200" />
                          <div className="w-1 bg-primary rounded-full animate-wave wave-bar-60 wave-delay-300" />
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
                    aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
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
            <div 
              data-coachmark="player-controls"
              className="flex-1 flex flex-col items-center justify-center"
            >
              <div className="flex items-center gap-2">
                {/* Shuffle */}
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onShuffle}
                      aria-label="Lecture aléatoire"
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
                  aria-label="Piste précédente"
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
                  aria-label={isPlaying ? "Pause" : "Lecture"}
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
                  aria-label="Piste suivante"
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
                      aria-label="Répétition"
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
              {/* Audio Analysis / AI */}
              {audioAnalysis && (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      aria-label="Analyse audio"
                      onClick={() => {
                        if (audioAnalysis.isPro && !audioAnalysis.transcription && onStartAIAnalysis) {
                          onStartAIAnalysis();
                          toast.info("Analyse IA en cours...", { duration: 3000 });
                        } else if (!audioAnalysis.isPro) {
                          toast.info("Passez à Pro pour accéder à l'analyse IA avancée", { duration: 4000 });
                        } else {
                          toast.info("Analyse disponible", { duration: 2000 });
                        }
                      }}
                      className={cn(
                        "p-2 rounded-full transition-all duration-300 relative",
                        audioAnalysis.browserAnalysis?.hasVoice 
                          ? "text-primary bg-primary/10" 
                          : "text-muted-foreground/50 hover:text-primary",
                        "hover:bg-primary/10 active:scale-95",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                      )}
                    >
                      <Brain className="w-4 h-4" />
                      {/* Indicateur de sentiment si disponible */}
                      {audioAnalysis.sentiment && audioAnalysis.sentiment.length > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      )}
                      {/* Indicateur Pro */}
                      {isAudioAIPro && (
                        <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <div className="space-y-1">
                      {audioAnalysis.browserAnalysis && (
                        <>
                          <p className="text-xs font-semibold">Analyse Audio</p>
                          <p className="text-xs text-muted-foreground">
                            Voix: {audioAnalysis.browserAnalysis.hasVoice ? "Détectée" : "Non détectée"}
                          </p>
                          {audioAnalysis.browserAnalysis.pitch && (
                            <p className="text-xs text-muted-foreground">
                              Pitch: {audioAnalysis.browserAnalysis.pitch.toFixed(0)} Hz
                            </p>
                          )}
                        </>
                      )}
                      {audioAnalysis.sentiment && audioAnalysis.sentiment.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/10">
                          <p className="text-xs font-semibold flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            Sentiment
                          </p>
                          {audioAnalysis.sentiment.slice(0, 2).map((s, i) => (
                            <p key={i} className="text-xs text-muted-foreground">
                              {s.sentiment} ({Math.round(s.confidence * 100)}%)
                            </p>
                          ))}
                        </div>
                      )}
                      {isAudioAIPro && !audioAnalysis.transcription && (
                        <p className="text-xs text-primary mt-2">Cliquez pour lancer l'analyse IA</p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Artist Info */}
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onShowArtistInfo?.()}
                    aria-label="Profil artiste"
                    className={cn(
                      "p-2 rounded-full transition-all duration-300",
                      "text-muted-foreground/50 hover:text-primary",
                      "hover:bg-primary/10 active:scale-95",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    )}
                    disabled={!onShowArtistInfo}
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Profil artiste</TooltipContent>
              </Tooltip>

              {/* Karaoké - DÉSACTIVÉ */}
              {/* {onShowKaraoke && (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onShowKaraoke}
                      className={cn(
                        "p-2 rounded-full transition-all duration-300",
                        "text-muted-foreground/50 hover:text-primary",
                        "hover:bg-primary/10 active:scale-95",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                      )}
                    >
                      <Mic2 className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Karaoké</TooltipContent>
                </Tooltip>
              )} */}

              {/* Lyrics */}
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={onShowLyrics}
                    aria-label="Afficher les paroles"
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
                    data-coachmark="player-queue-btn"
                    onClick={onToggleQueue}
                    aria-label="Ouvrir la file d'attente"
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
                    aria-label="Appareils"
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
                  aria-label={isMuted ? "Activer le son" : "Couper le son"}
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
                    aria-label="Plein écran"
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
                    aria-label="Plus d'options"
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
