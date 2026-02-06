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
  Film,
  Tv2,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useAudioVibes } from "@/hooks/useAudioVibes";
import { Track } from "@/types/music";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import { type YouTubePlayerRef } from "./YouTubePlayer";
import { extractYouTubeVideoId } from "@/lib/youtube";

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
  isInline?: boolean;
  /** Whether to show video mode (YouTube player is handled by parent) */
  showVideoMode?: boolean;
  /** Shared YouTube player ref from DesktopApp */
  youtubePlayerRef?: React.RefObject<YouTubePlayerRef | null>;
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
  onToggleVideoMode?: () => void;
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
  isInline = false,
  showVideoMode = false,
  youtubePlayerRef,
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
  onToggleVideoMode,
}: VisionProPlayerProps) => {
  const [showControls, setShowControls] = useState(true);
  const inactivityTimeoutRef = useRef<NodeJS.Timeout>();
  const INACTIVITY_DELAY = 4000;

  // Detect YouTube track
  const isYouTube = currentTrack.mediaSource === 'youtube';
  const youtubeVideoId = currentTrack.youtubeVideoId || (isYouTube && currentTrack.filePath ? extractYouTubeVideoId(currentTrack.filePath) : null);

  // Audio visualization (only for non-YouTube tracks)
  const vibesData = useAudioVibes(isYouTube ? null : (audioElement ?? null), {
    fftSize: 512,
    enableBassFilter: false,
  });

  // Check if track has video
  const hasVideo = Boolean(youtubeVideoId);

  // Auto-hide controls (only in fullscreen mode)
  const resetInactivityTimer = useCallback(() => {
    if (isInline) return;
    setShowControls(true);
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }
    inactivityTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, INACTIVITY_DELAY);
  }, [isPlaying, isInline]);

  useEffect(() => {
    if (isInline) return;
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
  }, [resetInactivityTimer, isInline]);

  // Sync YouTube player controls (same logic as FullscreenPlayer)
  useEffect(() => {
    if (isYouTube && youtubePlayerRef?.current && youtubeVideoId) {
      const player = youtubePlayerRef.current;
      
      if (player.duration > 0) {
        if (isPlaying && !player.isPlaying) {
          requestAnimationFrame(() => {
            if (player && typeof player.play === 'function' && !player.isPlaying) {
              try {
                player.play();
              } catch (err) {
                console.error('[VisionProPlayer] Erreur lors du play YouTube:', err);
              }
              
              window.dispatchEvent(new CustomEvent('youtube-video-played', { 
                detail: { 
                  videoId: youtubeVideoId,
                  trackId: currentTrack.id,
                  title: currentTrack.title,
                } 
              }));
            }
          });
        } else if (!isPlaying && player.isPlaying) {
          player.pause();
        }
      }
    }
  }, [isPlaying, isYouTube, youtubeVideoId, currentTrack.id, currentTrack.title, youtubePlayerRef]);

  // Sync volume with YouTube player
  useEffect(() => {
    if (isYouTube && youtubePlayerRef?.current) {
      const currentVol = isMuted ? 0 : volume;
      const youtubeVol = youtubePlayerRef.current.volume;
      if (Math.abs(youtubeVol - currentVol) > 1) {
        youtubePlayerRef.current.setVolume(currentVol);
      }
      
      const youtubeMuted = youtubePlayerRef.current.isMuted;
      if (youtubeMuted !== isMuted) {
        youtubePlayerRef.current.toggleMute();
      }
    }
  }, [volume, isMuted, isYouTube, youtubePlayerRef]);

  // Handle seek for YouTube
  const handleSeek = useCallback((value: number[]) => {
    if (isYouTube && youtubePlayerRef?.current) {
      youtubePlayerRef.current.seek(value[0]);
    }
    onSeek(value);
  }, [isYouTube, onSeek, youtubePlayerRef]);

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

  // Circular visualizer for inline mode
  const circularVisualizerBars = useMemo(() => {
    if (!vibesData?.frequency) return Array(48).fill(0.15);
    const freq = vibesData.frequency;
    const barCount = 48;
    const result = [];
    for (let i = 0; i < barCount; i++) {
      const index = Math.floor((i / barCount) * (freq.length * 0.7));
      result.push(freq[index] / 255);
    }
    return result;
  }, [vibesData?.frequency]);

  // ═══════════════════════════════════════════════════════════════════════════
  // INLINE MODE - Immersive visualization without controls
  // ═══════════════════════════════════════════════════════════════════════════
  if (isInline) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="relative w-full h-full overflow-hidden rounded-2xl"
      >
        {/* Dynamic background with album art */}
        <div className="absolute inset-0">
          <motion.div 
            initial={{ scale: 1.3 }}
            animate={{ 
              scale: isPlaying ? [1.15, 1.25, 1.15] : 1.2,
            }}
            transition={{ 
              duration: 12, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${getCoverUrl(currentTrack.coverUrl)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(80px) saturate(1.8) brightness(0.5)',
            }}
          />
          
          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-transparent to-background/60" />
          <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-background/40" />
          
          {/* Animated particle effect */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-white/20"
                initial={{ 
                  x: Math.random() * 100 + '%',
                  y: '100%',
                  opacity: 0 
                }}
                animate={isPlaying ? { 
                  y: '-10%',
                  opacity: [0, 0.5, 0],
                } : {}}
                transition={{
                  duration: 6 + Math.random() * 8,
                  repeat: Infinity,
                  delay: Math.random() * 5,
                  ease: "linear",
                }}
              />
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full p-8">
          
          {/* Album art with circular visualizer */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className="relative mb-8"
          >
            {/* Circular visualizer around album art */}
            <div className="absolute inset-0 flex items-center justify-center">
              <svg 
                className="absolute w-[340px] h-[340px] sm:w-[400px] sm:h-[400px]"
                viewBox="0 0 400 400"
              >
                {circularVisualizerBars.map((height, i) => {
                  const angle = (i / circularVisualizerBars.length) * Math.PI * 2 - Math.PI / 2;
                  const innerRadius = 145;
                  const barHeight = isPlaying ? 20 + height * 40 : 8;
                  const x1 = 200 + Math.cos(angle) * innerRadius;
                  const y1 = 200 + Math.sin(angle) * innerRadius;
                  const x2 = 200 + Math.cos(angle) * (innerRadius + barHeight);
                  const y2 = 200 + Math.sin(angle) * (innerRadius + barHeight);
                  
                  return (
                    <motion.line
                      key={i}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={`hsl(var(--primary) / ${0.3 + height * 0.6})`}
                      strokeWidth="3"
                      strokeLinecap="round"
                      initial={{ opacity: 0 }}
                      animate={{ 
                        opacity: isPlaying ? 0.6 + height * 0.4 : 0.2,
                        x2,
                        y2,
                      }}
                      transition={{ duration: 0.05 }}
                    />
                  );
                })}
              </svg>
            </div>

            {/* Pulsing glow */}
            <motion.div
              animate={{ 
                scale: isPlaying ? [1, 1.1, 1] : 1,
                opacity: isPlaying ? [0.4, 0.7, 0.4] : 0.2,
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -inset-10 rounded-full"
              style={{
                background: `radial-gradient(circle, hsl(var(--primary) / 0.5) 0%, transparent 70%)`,
                filter: 'blur(30px)',
              }}
            />
            
            {/* Album art with rotation */}
            <motion.div
              animate={{ rotate: isPlaying ? 360 : 0 }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full overflow-hidden shadow-2xl"
              style={{
                boxShadow: isPlaying 
                  ? '0 0 80px hsl(var(--primary) / 0.4), 0 20px 60px rgba(0,0,0,0.5)' 
                  : '0 20px 50px rgba(0,0,0,0.4)',
              }}
            >
              <img
                src={getCoverUrl(currentTrack.coverUrl)}
                alt={currentTrack.album}
                className="w-full h-full object-cover"
              />
              {/* Center dot */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={cn(
                  "w-10 h-10 rounded-full",
                  "bg-background/90 backdrop-blur-xl",
                  "border-2 border-white/20",
                  "flex items-center justify-center"
                )}>
                  <motion.div 
                    animate={{ scale: isPlaying ? [1, 1.4, 1] : 1 }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="w-2 h-2 rounded-full bg-primary"
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Track info */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center"
          >
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 truncate max-w-md">
              {currentTrack.title}
            </h1>
            <p className="text-lg text-white/60 truncate max-w-sm">
              {currentTrack.artist}
            </p>
          </motion.div>

          {/* Minimal progress indicator */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8 w-full max-w-xs"
          >
            <div className="h-1 rounded-full bg-white/10 overflow-hidden">
              <motion.div 
                className="h-full rounded-full"
                style={{ 
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))',
                }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-white/40">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(effectiveDuration)}</span>
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FULLSCREEN MODE - With video support and futuristic Apple design
  // Same blur level as other panels (backdrop-blur-md)
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        "fixed inset-0 z-[10000] overflow-hidden",
        isYouTube ? "bg-transparent" : "bg-black"
      )}
    >
      {/* ═══════════════════════════════════════════════════════════════════════════
         IMMERSIVE BACKGROUND
         ═══════════════════════════════════════════════════════════════════════════ */}
      <div className="absolute inset-0">
        {/* Video mode: YouTube player is rendered by parent (DesktopApp) behind this */}
        {showVideoMode && hasVideo ? (
          <div className="absolute inset-0">
            {/* Animated border glow around video area */}
            <motion.div
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-4 rounded-3xl pointer-events-none"
              style={{
                border: '1px solid hsl(var(--primary) / 0.3)',
                boxShadow: '0 0 60px hsl(var(--primary) / 0.2), inset 0 0 60px hsl(var(--primary) / 0.05)',
              }}
            />
          </div>
        ) : (
          <>
            {/* Album art background with parallax */}
            <motion.div 
              initial={{ scale: 1.5, opacity: 0 }}
              animate={{ 
                scale: isPlaying ? [1.15, 1.25, 1.15] : 1.2,
                opacity: 1,
              }}
              transition={{ 
                scale: { duration: 20, repeat: Infinity, ease: "easeInOut" },
                opacity: { duration: 2 }
              }}
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${getCoverUrl(currentTrack.coverUrl)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(100px) saturate(1.6) brightness(0.4)',
              }}
            />
            
            {/* Animated gradient mesh */}
            <div className="absolute inset-0">
              <motion.div
                animate={{ 
                  background: [
                    'radial-gradient(circle at 20% 30%, hsl(var(--primary) / 0.3) 0%, transparent 50%)',
                    'radial-gradient(circle at 80% 70%, hsl(var(--primary) / 0.3) 0%, transparent 50%)',
                    'radial-gradient(circle at 50% 50%, hsl(var(--primary) / 0.3) 0%, transparent 50%)',
                    'radial-gradient(circle at 20% 30%, hsl(var(--primary) / 0.3) 0%, transparent 50%)',
                  ]
                }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0"
              />
            </div>
          </>
        )}
        
        {/* Dark overlays for contrast - same opacity as panels */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/60" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40" />
        
        {/* Animated orbs */}
        <motion.div
          animate={{ 
            x: [0, 100, 0],
            y: [0, -50, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/3 left-1/4 w-[600px] h-[600px] rounded-full blur-[150px] opacity-30"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.6) 0%, transparent 70%)" }}
        />
        <motion.div
          animate={{ 
            x: [0, -80, 0],
            y: [0, 60, 0],
            scale: [1.2, 1, 1.2],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] rounded-full blur-[130px] opacity-25"
          style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.5) 0%, transparent 70%)" }}
        />

        {/* Floating light rays */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute h-[200vh] w-px bg-gradient-to-b from-transparent via-white/5 to-transparent"
              style={{ left: `${20 + i * 15}%` }}
              animate={{
                y: ['-50%', '0%'],
                opacity: [0, 0.3, 0],
              }}
              transition={{
                duration: 8 + i * 2,
                repeat: Infinity,
                delay: i * 1.5,
                ease: "linear",
              }}
            />
          ))}
        </div>

        {/* Noise texture */}
        <div 
          className="absolute inset-0 opacity-[0.02] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════
         MAIN CONTENT
         ═══════════════════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 flex flex-col h-full">
        
        {/* Top Bar */}
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
              "bg-white/5 hover:bg-white/15 backdrop-blur-md",
              "border border-white/10 hover:border-white/25",
              "text-white/70 hover:text-white",
              "transition-all duration-300",
              "shadow-lg shadow-black/20"
            )}
          >
            <ChevronDown className="w-6 h-6" />
          </motion.button>
          
          <div className="flex items-center gap-3">
            <motion.div 
              animate={{ 
                rotate: isPlaying ? 360 : 0,
                scale: isPlaying ? [1, 1.1, 1] : 1,
              }}
              transition={{ 
                rotate: { duration: 4, repeat: Infinity, ease: "linear" },
                scale: { duration: 2, repeat: Infinity }
              }}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                "bg-primary/20 backdrop-blur-md border border-primary/30"
              )}
            >
              <Radio className="w-5 h-5 text-primary" />
            </motion.div>
            <span className="text-xs uppercase tracking-[0.25em] text-white/40 font-medium hidden sm:block">
              {showVideoMode ? 'Mode Vidéo' : 'En Lecture'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Video toggle button */}
            {hasVideo && onToggleVideoMode && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onToggleVideoMode}
                className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center",
                  "backdrop-blur-md border transition-all duration-300",
                  "shadow-lg shadow-black/20",
                  showVideoMode 
                    ? "bg-primary/20 border-primary/40 text-primary" 
                    : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20"
                )}
              >
                <Tv2 className="w-5 h-5" />
              </motion.button>
            )}
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onToggleFavorite}
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center",
                "backdrop-blur-md border transition-all duration-300",
                "shadow-lg shadow-black/20",
                isFavorite 
                  ? "bg-rose-500/20 border-rose-500/40 text-rose-400" 
                  : "bg-white/5 border-white/10 text-white/50 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30"
              )}
            >
              <Heart className={cn("w-5 h-5", isFavorite && "fill-current")} />
            </motion.button>
          </div>
        </motion.header>

        {/* Center Content */}
        <div className="flex-1 flex items-center justify-center px-8">
          {!showVideoMode && (
            <div className="flex flex-col items-center max-w-2xl w-full">
              
              {/* Album Art with holographic effects */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.2 }}
                className="relative mb-10"
              >
                {/* Holographic ring */}
                <motion.div
                  animate={{ 
                    rotate: 360,
                    scale: isPlaying ? [1, 1.02, 1] : 1,
                  }}
                  transition={{ 
                    rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                    scale: { duration: 3, repeat: Infinity }
                  }}
                  className="absolute -inset-6 rounded-full"
                  style={{
                    background: `conic-gradient(from 0deg, 
                      hsl(var(--primary) / 0.6), 
                      hsl(var(--accent) / 0.4), 
                      transparent,
                      hsl(var(--primary) / 0.6)
                    )`,
                    filter: 'blur(20px)',
                  }}
                />
                
                {/* Outer glow */}
                <motion.div
                  animate={{ 
                    scale: isPlaying ? [1, 1.08, 1] : 1,
                    opacity: isPlaying ? [0.3, 0.6, 0.3] : 0.15,
                  }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -inset-12 rounded-full"
                  style={{
                    background: `radial-gradient(circle, hsl(var(--primary) / 0.4) 0%, transparent 70%)`,
                  }}
                />
                
                {/* Rotating border */}
                <motion.div
                  animate={{ rotate: isPlaying ? -360 : 0 }}
                  transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                  className="absolute -inset-1 rounded-full p-[2px]"
                  style={{
                    background: `conic-gradient(from 180deg, 
                      hsl(var(--primary)), 
                      transparent 25%,
                      hsl(var(--accent)) 50%,
                      transparent 75%,
                      hsl(var(--primary))
                    )`,
                    opacity: isPlaying ? 0.8 : 0.3,
                  }}
                >
                  <div className="w-full h-full rounded-full bg-black" />
                </motion.div>

                {/* Album Art */}
                <motion.div
                  animate={{ rotate: isPlaying ? 360 : 0 }}
                  transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                  className="relative w-72 h-72 sm:w-80 sm:h-80 rounded-full overflow-hidden shadow-2xl"
                  style={{
                    boxShadow: isPlaying 
                      ? '0 0 120px hsl(var(--primary) / 0.3), 0 30px 100px rgba(0,0,0,0.6)' 
                      : '0 30px 60px rgba(0,0,0,0.5)',
                  }}
                >
                  <img
                    src={getCoverUrl(currentTrack.coverUrl)}
                    alt={currentTrack.album}
                    className="w-full h-full object-cover"
                  />
                  {/* Vinyl center */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={cn(
                      "w-[18%] h-[18%] rounded-full",
                      "bg-black/95 backdrop-blur-md",
                      "border-4 border-white/5",
                      "shadow-inner flex items-center justify-center"
                    )}>
                      <motion.div 
                        animate={{ scale: isPlaying ? [1, 1.4, 1] : 1 }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="w-2.5 h-2.5 rounded-full bg-primary shadow-lg shadow-primary/50"
                      />
                    </div>
                  </div>
                  
                  {/* Vinyl grooves */}
                  <div 
                    className="absolute inset-0 rounded-full pointer-events-none opacity-5"
                    style={{
                      background: `repeating-radial-gradient(circle at center, transparent 0px, transparent 4px, rgba(255,255,255,0.2) 5px, transparent 6px)`,
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
                <p className="text-xl text-white/50 truncate mb-2">
                  {currentTrack.artist}
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-white/30">
                  <Disc3 className="w-4 h-4" />
                  <span className="truncate max-w-[300px]">{currentTrack.album}</span>
                </div>
              </motion.div>

              {/* Horizontal Visualizer */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: isPlaying && showControls ? 1 : 0 }}
                transition={{ duration: 0.5 }}
                className="flex items-end justify-center gap-[2px] h-16 w-full max-w-md mb-6"
              >
                {visualizerBars.map((height, i) => (
                  <motion.div
                    key={i}
                    className="flex-1 max-w-1 rounded-full"
                    style={{
                      background: `linear-gradient(to top, hsl(var(--primary) / ${0.3 + height * 0.6}), hsl(var(--accent) / ${0.2 + height * 0.5}))`,
                    }}
                    animate={{ 
                      height: isPlaying ? Math.max(3, height * 64) : 3,
                    }}
                    transition={{ duration: 0.06 }}
                  />
                ))}
              </motion.div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════════
           BOTTOM CONTROLS - Floating glass panel (same blur as other panels)
           ═══════════════════════════════════════════════════════════════════════════ */}
        <motion.div 
          initial={{ opacity: 0, y: 60 }}
          animate={{ 
            opacity: showControls ? 1 : 0,
            y: showControls ? 0 : 60,
          }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className={cn(
            "mx-4 sm:mx-8 mb-6 p-5 sm:p-6 rounded-3xl",
            // Same blur as other panels (backdrop-blur-md)
            "bg-card/80 backdrop-blur-md",
            "border border-border/50",
            "shadow-2xl shadow-black/40"
          )}
        >
          {/* Progress Bar */}
          <div className="mb-5">
            <div className="relative group">
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div 
                  className="h-full rounded-full"
                  style={{ 
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))',
                    boxShadow: '0 0 20px hsl(var(--primary) / 0.5)',
                  }}
                  layoutId="progress-vision"
                />
              </div>
              <Slider
                value={[currentTime]}
                max={effectiveDuration}
                step={0.1}
                onValueChange={handleSeek}
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              />
            </div>
            
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="text-white/40 font-mono tabular-nums">
                {formatTime(currentTime)}
              </span>
              <span className="text-white/40 font-mono tabular-nums">
                {formatTime(effectiveDuration)}
              </span>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-5">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onShuffle}
              className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center transition-all",
                isShuffle 
                  ? "bg-primary/20 text-primary border border-primary/30" 
                  : "text-white/30 hover:text-white/70 hover:bg-white/5"
              )}
            >
              <Shuffle className="w-5 h-5" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1, x: -3 }}
              whileTap={{ scale: 0.9 }}
              onClick={onPrevious}
              className="w-13 h-13 rounded-xl bg-white/5 hover:bg-white/15 text-white/70 hover:text-white flex items-center justify-center transition-all"
            >
              <SkipBack className="w-6 h-6 fill-current" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onPlayPause}
              className={cn(
                "w-18 h-18 sm:w-20 sm:h-20 rounded-full flex items-center justify-center",
                "bg-white text-black",
                "shadow-xl transition-all"
              )}
              style={{
                boxShadow: '0 8px 50px rgba(255,255,255,0.25), 0 0 30px rgba(255,255,255,0.1)',
              }}
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 sm:w-9 sm:h-9 fill-current" />
              ) : (
                <Play className="w-8 h-8 sm:w-9 sm:h-9 fill-current ml-1" />
              )}
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1, x: 3 }}
              whileTap={{ scale: 0.9 }}
              onClick={onNext}
              className="w-13 h-13 rounded-xl bg-white/5 hover:bg-white/15 text-white/70 hover:text-white flex items-center justify-center transition-all"
            >
              <SkipForward className="w-6 h-6 fill-current" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onRepeat}
              className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center transition-all",
                repeatMode !== "off" 
                  ? "bg-primary/20 text-primary border border-primary/30" 
                  : "text-white/30 hover:text-white/70 hover:bg-white/5"
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
            <div className="flex items-center gap-3 flex-1 max-w-[180px]">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onMuteToggle}
                className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/15 text-white/50 hover:text-white flex items-center justify-center transition-all"
              >
                <VolumeIcon className="w-4 h-4" />
              </motion.button>
              <Slider
                value={[isMuted ? 0 : volume]}
                max={100}
                step={1}
                onValueChange={onVolumeChange}
                className="flex-1"
              />
              <span className="text-xs text-white/30 font-mono w-7 text-right tabular-nums">
                {isMuted ? 0 : volume}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/15 text-white/40 hover:text-white flex items-center justify-center transition-all"
              >
                <ListMusic className="w-4 h-4" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/15 text-white/40 hover:text-white flex items-center justify-center transition-all"
              >
                <Share2 className="w-4 h-4" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/15 text-white/40 hover:text-white flex items-center justify-center transition-all"
              >
                <MoreHorizontal className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default VisionProPlayer;
