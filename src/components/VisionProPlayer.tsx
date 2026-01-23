"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
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
  ChevronDown,
  Music2,
  Disc3,
  ListMusic,
  Share2,
  MoreHorizontal,
  Sparkles,
  Clock,
  Waves,
  Radio,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useAudioVibes } from "@/hooks/useAudioVibes";
import { Track } from "@/types/music";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";

interface VisionProPlayerProps {
  currentTrack: Track;
  isPlaying: boolean;
  currentTime: number;
  isShuffle: boolean;
  repeatMode: "off" | "all" | "one";
  volume: number;
  isMuted: boolean;
  isFavorite?: boolean;
  audioElement?: HTMLAudioElement | null;
  youtubeDuration?: number;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onShuffle: () => void;
  onRepeat: () => void;
  onSeek: (value: number[]) => void;
  onVolumeChange: (value: number[]) => void;
  onMuteToggle: () => void;
  onClose: () => void;
  onToggleFavorite?: () => void;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const VisionProPlayer = ({
  currentTrack,
  isPlaying,
  currentTime,
  isShuffle,
  repeatMode,
  volume,
  isMuted,
  isFavorite = false,
  audioElement,
  youtubeDuration,
  onPlayPause,
  onPrevious,
  onNext,
  onShuffle,
  onRepeat,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onClose,
  onToggleFavorite,
}: VisionProPlayerProps) => {
  const [showControls, setShowControls] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const inactivityTimeoutRef = useRef<NodeJS.Timeout>();
  const INACTIVITY_DELAY = 4000;

  // Audio visualization
  const vibesData = useAudioVibes(audioElement ?? null, {
    fftSize: 512,
    enableBassFilter: false,
  });

  // Auto-hide controls
  const resetInactivityTimer = useCallback(() => {
    setShowControls(true);
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }
    inactivityTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, INACTIVITY_DELAY);
  }, [isPlaying]);

  useEffect(() => {
    resetInactivityTimer();
    const handleInteraction = () => resetInactivityTimer();
    window.addEventListener('mousemove', handleInteraction);
    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    return () => {
      window.removeEventListener('mousemove', handleInteraction);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
    };
  }, [resetInactivityTimer]);

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;
  
  const effectiveDuration = youtubeDuration || currentTrack.duration || 0;
  const progress = effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

  // Visualizer bars from FFT
  const visualizerBars = useMemo(() => {
    if (!vibesData?.frequency) return Array(64).fill(0.1);
    const freq = vibesData.frequency;
    const barCount = 64;
    const result = [];
    for (let i = 0; i < barCount; i++) {
      const index = Math.floor((i / barCount) * freq.length);
      result.push(freq[index] / 255);
    }
    return result;
  }, [vibesData?.frequency]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10000] overflow-hidden"
    >
      {/* ═══════════════════════════════════════════════════════════════════════════
         IMMERSIVE BACKGROUND - Dynamic album art with spatial depth
         ═══════════════════════════════════════════════════════════════════════════ */}
      <div className="absolute inset-0">
        {/* Base album art - ultra blur */}
        <motion.div 
          initial={{ scale: 1.5, opacity: 0 }}
          animate={{ scale: 1.2, opacity: 1 }}
          transition={{ duration: 2, ease: "easeOut" }}
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${getCoverUrl(currentTrack.coverUrl)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(120px) saturate(1.5) brightness(0.6)',
          }}
        />
        
        {/* Gradient overlays for depth - uses theme colors */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/80" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/30 via-transparent to-background/30" />
        
        {/* Animated ambient orbs */}
        <motion.div
          animate={{ 
            x: [0, 100, 0],
            y: [0, -50, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full blur-[150px] opacity-50"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.6) 0%, transparent 70%)" }}
        />
        <motion.div
          animate={{ 
            x: [0, -80, 0],
            y: [0, 60, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 3 }}
          className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full blur-[120px] opacity-40"
          style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.5) 0%, transparent 70%)" }}
        />

        {/* Subtle noise texture */}
        <div 
          className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════
         MAIN CONTENT AREA
         ═══════════════════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 flex flex-col h-full">
        
        {/* Top Bar - Close & Status */}
        <motion.header 
          initial={{ opacity: 0, y: -30 }}
          animate={{ 
            opacity: showControls ? 1 : 0,
            y: showControls ? 0 : -30,
          }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex items-center justify-between p-6"
        >
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center",
              "bg-white/10 hover:bg-white/20 backdrop-blur-2xl",
              "border border-white/20 hover:border-white/30",
              "text-white/80 hover:text-white",
              "transition-all duration-300",
              "shadow-lg shadow-black/20"
            )}
          >
            <ChevronDown className="w-6 h-6" />
          </motion.button>
          
          <div className="flex items-center gap-3">
            <motion.div 
              animate={{ rotate: isPlaying ? 360 : 0 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                "bg-primary/20 backdrop-blur-xl border border-primary/30"
              )}
            >
              <Radio className="w-5 h-5 text-primary" />
            </motion.div>
            <span className="text-xs uppercase tracking-[0.25em] text-white/50 font-medium hidden sm:block">
              En Lecture
            </span>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onToggleFavorite}
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center",
              "backdrop-blur-2xl border transition-all duration-300",
              "shadow-lg shadow-black/20",
              isFavorite 
                ? "bg-rose-500/20 border-rose-500/40 text-rose-400" 
                : "bg-white/10 border-white/20 text-white/60 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30"
            )}
          >
            <Heart className={cn("w-6 h-6", isFavorite && "fill-current")} />
          </motion.button>
        </motion.header>

        {/* Center Content - Album Art & Info */}
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="flex flex-col items-center max-w-2xl w-full">
            
            {/* Album Art with Spatial Effects */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.2 }}
              className="relative mb-10"
            >
              {/* Outer glow ring - pulses with music */}
              <motion.div
                animate={{ 
                  scale: isPlaying ? [1, 1.05, 1] : 1,
                  opacity: isPlaying ? [0.3, 0.5, 0.3] : 0.15,
                }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -inset-8 rounded-full"
                style={{
                  background: `conic-gradient(from 0deg, hsl(var(--primary) / 0.5), hsl(var(--accent) / 0.4), hsl(var(--primary) / 0.5))`,
                  filter: 'blur(50px)',
                }}
              />
              
              {/* Rotating gradient border */}
              <motion.div
                animate={{ rotate: isPlaying ? 360 : 0 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute -inset-1 rounded-full p-[3px]"
                style={{
                  background: `conic-gradient(from 0deg, hsl(var(--primary)), hsl(var(--accent)), hsl(var(--primary)))`,
                  opacity: isPlaying ? 0.8 : 0.3,
                }}
              >
                <div className="w-full h-full rounded-full bg-background" />
              </motion.div>

              {/* Album Art - Vinyl rotation effect */}
              <motion.div
                animate={{ rotate: isPlaying ? 360 : 0 }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                className={cn(
                  "relative w-72 h-72 sm:w-80 sm:h-80 rounded-full overflow-hidden",
                  "shadow-2xl"
                )}
                style={{
                  boxShadow: isPlaying 
                    ? '0 0 100px hsl(var(--primary) / 0.3), 0 30px 80px rgba(0,0,0,0.5)' 
                    : '0 30px 60px rgba(0,0,0,0.4)',
                }}
              >
                <img
                  src={getCoverUrl(currentTrack.coverUrl)}
                  alt={currentTrack.album}
                  className="w-full h-full object-cover"
                />
                {/* Vinyl center hole */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={cn(
                    "w-[18%] h-[18%] rounded-full",
                    "bg-background/95 backdrop-blur-xl",
                    "border-4 border-white/10",
                    "shadow-inner flex items-center justify-center"
                  )}>
                    <motion.div 
                      animate={{ scale: isPlaying ? [1, 1.3, 1] : 1 }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="w-2 h-2 rounded-full bg-primary/80"
                    />
                  </div>
                </div>
                
                {/* Vinyl grooves */}
                <div 
                  className="absolute inset-0 rounded-full pointer-events-none opacity-10"
                  style={{
                    background: `repeating-radial-gradient(circle at center, transparent 0px, transparent 3px, rgba(255,255,255,0.1) 4px, transparent 5px)`,
                  }}
                />
              </motion.div>
            </motion.div>

            {/* Track Info */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-center w-full mb-8"
            >
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 truncate px-4">
                {currentTrack.title}
              </h1>
              <p className="text-xl text-white/60 truncate mb-2">
                {currentTrack.artist}
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-white/40">
                <Disc3 className="w-4 h-4" />
                <span className="truncate max-w-[300px]">{currentTrack.album}</span>
              </div>
            </motion.div>

            {/* Visualizer - Horizontal bars */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: isPlaying && showControls ? 1 : 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-end justify-center gap-[3px] h-16 w-full max-w-md mb-8"
            >
              {visualizerBars.map((height, i) => (
                <motion.div
                  key={i}
                  className="flex-1 max-w-1.5 rounded-full"
                  style={{
                    background: `linear-gradient(to top, hsl(var(--primary) / ${0.4 + height * 0.5}), hsl(var(--accent) / ${0.3 + height * 0.4}))`,
                  }}
                  animate={{ 
                    height: isPlaying ? Math.max(4, height * 64) : 4,
                  }}
                  transition={{ duration: 0.08 }}
                />
              ))}
            </motion.div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════════
           BOTTOM CONTROLS - Glass panel with all playback controls
           ═══════════════════════════════════════════════════════════════════════════ */}
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ 
            opacity: showControls ? 1 : 0,
            y: showControls ? 0 : 50,
          }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className={cn(
            "mx-4 mb-6 p-6 rounded-3xl",
            "bg-white/10 backdrop-blur-2xl",
            "border border-white/20",
            "shadow-2xl shadow-black/30"
          )}
        >
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="relative group">
              {/* Track background */}
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <motion.div 
                  className="h-full rounded-full"
                  style={{ 
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))',
                  }}
                  layoutId="progress-vision"
                />
              </div>
              {/* Interactive slider */}
              <Slider
                value={[currentTime]}
                max={effectiveDuration}
                step={0.1}
                onValueChange={onSeek}
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              />
            </div>
            
            <div className="flex items-center justify-between mt-3 text-sm">
              <span className="text-white/50 font-mono tabular-nums">
                {formatTime(currentTime)}
              </span>
              <span className="text-white/50 font-mono tabular-nums">
                {formatTime(effectiveDuration)}
              </span>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onShuffle}
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                isShuffle 
                  ? "bg-primary/20 text-primary border border-primary/30" 
                  : "text-white/40 hover:text-white/80 hover:bg-white/10"
              )}
            >
              <Shuffle className="w-5 h-5" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1, x: -3 }}
              whileTap={{ scale: 0.9 }}
              onClick={onPrevious}
              className="w-14 h-14 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-all"
            >
              <SkipBack className="w-7 h-7 fill-current" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onPlayPause}
              className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center",
                "bg-primary text-primary-foreground",
                "shadow-xl transition-all"
              )}
              style={{
                boxShadow: '0 8px 40px hsl(var(--primary) / 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
              }}
            >
              {isPlaying ? (
                <Pause className="w-9 h-9 fill-current" />
              ) : (
                <Play className="w-9 h-9 fill-current ml-1" />
              )}
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1, x: 3 }}
              whileTap={{ scale: 0.9 }}
              onClick={onNext}
              className="w-14 h-14 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-all"
            >
              <SkipForward className="w-7 h-7 fill-current" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onRepeat}
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                repeatMode !== "off" 
                  ? "bg-primary/20 text-primary border border-primary/30" 
                  : "text-white/40 hover:text-white/80 hover:bg-white/10"
              )}
            >
              {repeatMode === "one" ? (
                <Repeat1 className="w-5 h-5" />
              ) : (
                <Repeat className="w-5 h-5" />
              )}
            </motion.button>
          </div>

          {/* Volume & Actions */}
          <div className="flex items-center justify-between">
            {/* Volume Control */}
            <div className="flex items-center gap-3 flex-1 max-w-[200px]">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onMuteToggle}
                className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white flex items-center justify-center transition-all"
              >
                <VolumeIcon className="w-5 h-5" />
              </motion.button>
              <Slider
                value={[isMuted ? 0 : volume]}
                max={100}
                step={1}
                onValueChange={onVolumeChange}
                className="flex-1"
              />
              <span className="text-xs text-white/40 font-mono w-8 text-right tabular-nums">
                {isMuted ? 0 : volume}%
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-white/50 hover:text-white flex items-center justify-center transition-all"
              >
                <ListMusic className="w-5 h-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-white/50 hover:text-white flex items-center justify-center transition-all"
              >
                <Share2 className="w-5 h-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-white/50 hover:text-white flex items-center justify-center transition-all"
              >
                <MoreHorizontal className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default VisionProPlayer;
