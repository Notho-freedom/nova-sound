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
  Clock,
  ListMusic,
  Share2,
  MoreHorizontal,
  Waves,
  Sparkles,
  Radio
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { AlbumArt } from "./AlbumArt";
import { LegacyAudioVisualizer } from "./LegacyAudioVisualizer";
import { BackgroundEffects } from "./BackgroundEffects";
import { useAudioVibes } from "@/hooks/useAudioVibes";
import { Track } from "@/types/music";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import { YouTubePlayer, type YouTubePlayerRef } from "./YouTubePlayer";
import { extractYouTubeVideoId } from "@/lib/youtube";

interface FullscreenPlayerProps {
  currentTrack: Track;
  isPlaying: boolean;
  currentTime: number;
  isShuffle: boolean;
  repeatMode: "off" | "all" | "one";
  volume: number;
  isMuted: boolean;
  isFavorite?: boolean;
  isInline?: boolean;
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
  youtubePlayerRef?: React.RefObject<YouTubePlayerRef | null>;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  }
  return `${mins}m ${secs}s`;
};

export const FullscreenPlayer = ({
  currentTrack,
  isPlaying,
  currentTime,
  isShuffle,
  repeatMode,
  volume,
  isMuted,
  isFavorite = false,
  isInline = false,
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
  youtubePlayerRef: sharedYoutubePlayerRef,
}: FullscreenPlayerProps) => {
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const inactivityTimeoutRef = useRef<NodeJS.Timeout>();
  const lastInteractionRef = useRef<number>(Date.now());
  const INACTIVITY_DELAY = 3000; // 3 seconds
  
  // Détecter si c'est un track YouTube
  const isYouTube = currentTrack.mediaSource === 'youtube';
  const youtubeVideoId = currentTrack.youtubeVideoId || (isYouTube && currentTrack.filePath ? extractYouTubeVideoId(currentTrack.filePath) : null);
  // Utiliser uniquement la ref partagée (player persistant de DesktopApp)
  // Ne jamais créer de nouveau player ici pour éviter les doublures
  
  // Auto-hide controls on inactivity
  const resetInactivityTimer = useCallback(() => {
    lastInteractionRef.current = Date.now();
    setShowControls(true);
    
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }
    
    inactivityTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, INACTIVITY_DELAY);
  }, []);

  useEffect(() => {
    // Set initial timeout
    resetInactivityTimer();

    const handleMouseMove = () => {
      resetInactivityTimer();
    };

    const handleClick = () => {
      resetInactivityTimer();
    };

    const handleKeyPress = () => {
      resetInactivityTimer();
    };

    // Only add listeners when fullscreen player is active (not inline)
    if (!isInline) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('click', handleClick);
      window.addEventListener('keydown', handleKeyPress);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('click', handleClick);
        window.removeEventListener('keydown', handleKeyPress);
        if (inactivityTimeoutRef.current) {
          clearTimeout(inactivityTimeoutRef.current);
        }
      };
    }

    return () => {
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
    };
  }, [isInline, resetInactivityTimer]);
  
  // État pour le player YouTube
  const [youtubeState, setYoutubeState] = useState({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 70,
    isMuted: false,
  });

  // Use FFT data for visualization (seulement pour les tracks non-YouTube)
  const vibesData = useAudioVibes(isYouTube ? null : (audioElement ?? null), {
    fftSize: 1024, // Reduced from 2048 for better performance
    enableBassFilter: false,
  });

  // Callbacks pour le player YouTube
  const handleYouTubeStateChange = useCallback((playing: boolean) => {
    setYoutubeState(prev => ({ ...prev, isPlaying: playing }));
    // Ne pas appeler onPlayPause ici pour éviter les boucles infinies
    // L'état sera synchronisé via les useEffect
  }, []);

  const handleYouTubeTimeUpdate = useCallback((time: number) => {
    setYoutubeState(prev => {
      // Mettre à jour l'état local
      const newState = { ...prev, currentTime: time };
      
      // Mettre à jour le currentTime dans DesktopApp via onSeek
      // Mais seulement si la différence est significative pour éviter trop d'appels
      const timeDiff = Math.abs(time - (prev.currentTime || 0));
      if (timeDiff > 0.5) {
        // Utiliser requestAnimationFrame pour éviter les conflits
        requestAnimationFrame(() => {
          onSeek([time]);
        });
      }
      
      return newState;
    });
  }, [onSeek]);

  // Synchroniser les contrôles avec le player YouTube persistant
  // Utiliser toujours la ref partagée (player persistant de DesktopApp)
  useEffect(() => {
    if (isYouTube && sharedYoutubePlayerRef && sharedYoutubePlayerRef.current && youtubeVideoId) {
      const player = sharedYoutubePlayerRef.current;
      
      // Vérifier si le player est prêt (a une durée > 0)
      if (player.duration > 0) {
        // Synchroniser play/pause
        if (isPlaying && !player.isPlaying) {
          // Utiliser requestAnimationFrame pour s'assurer que le DOM est prêt
          requestAnimationFrame(() => {
            if (player && typeof player.play === 'function' && !player.isPlaying) {
              try {
                player.play();
              } catch (err: unknown) {
                console.error('[FullscreenPlayer] Erreur lors du play YouTube:', err);
              }
              
              // Ajouter la vidéo YouTube à l'historique vidéo quand elle commence à jouer
              // Émettre un événement pour que DesktopApp puisse l'ajouter à l'historique
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
  }, [isPlaying, isYouTube, youtubeVideoId, currentTrack.id, currentTrack.title, sharedYoutubePlayerRef]);

  useEffect(() => {
    if (isYouTube && sharedYoutubePlayerRef && sharedYoutubePlayerRef.current) {
      // Synchroniser le volume avec le player persistant
      const currentVol = isMuted ? 0 : volume;
      const youtubeVol = sharedYoutubePlayerRef.current.volume;
      if (Math.abs(youtubeVol - currentVol) > 1) {
        sharedYoutubePlayerRef.current.setVolume(currentVol);
      }
      
      // Synchroniser le mute
      const youtubeMuted = sharedYoutubePlayerRef.current.isMuted;
      if (youtubeMuted !== isMuted) {
        if (isMuted) {
          sharedYoutubePlayerRef.current.toggleMute();
        } else {
          sharedYoutubePlayerRef.current.toggleMute();
        }
      }
    }
  }, [volume, isMuted, isYouTube, sharedYoutubePlayerRef]);

  // Gérer le seek pour YouTube
  const handleSeekYouTube = useCallback((value: number[]) => {
    if (isYouTube && sharedYoutubePlayerRef && sharedYoutubePlayerRef.current) {
      sharedYoutubePlayerRef.current.seek(value[0]);
    } else {
      onSeek(value);
    }
  }, [isYouTube, onSeek, sharedYoutubePlayerRef]);
  
// Inside your component
const canvasRef = useRef<HTMLCanvasElement>(null);
const barCount = 32; // plus léger et rapide
const bars = useMemo(() => Array.from({ length: barCount }, (_, i) => i), []);

// Render FFT optimized
useEffect(() => {
  if (!audioElement) return;
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const renderFFT = () => {
    const freqData = vibesData?.frequency;
    if (!freqData) return;

    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = canvas.offsetHeight;

    ctx.clearRect(0, 0, width, height);

    const barWidth = width / barCount;

    for (const i of bars) {
      const index = Math.floor((i / barCount) * freqData.length);
      const value = freqData[index] || 0;
      const barHeight = (value / 255) * height;

      ctx.fillStyle = `rgba(59, 130, 246, ${0.2 + (value / 255) * 0.3})`;
      ctx.fillRect(i * barWidth, height - barHeight, barWidth * 0.8, barHeight);
    }
  };

  let rafId: number;
  let lastTime = 0;
  const fps = 30;
  const interval = 1000 / fps;

  const loop = (time: number) => {
    if (time - lastTime > interval) {
      lastTime = time;
      renderFFT();
    }
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);

  return () => cancelAnimationFrame(rafId);
}, [vibesData?.frequency, bars, audioElement]);

  const VolumeIcon = isMuted || volume === 0 
    ? VolumeX 
    : volume < 50 
      ? Volume1 
      : Volume2;

  // Load lyrics
  useEffect(() => {
    const loadLyrics = async () => {
      if (window.electronAPI) {
        try {
          const lyricsData = await window.electronAPI.getLyrics(
            currentTrack.artist,
            currentTrack.title
          );
          setLyrics(lyricsData?.plainLyrics || null);
        } catch {
          setLyrics(null);
        }
      }
    };
    loadLyrics();
  }, [currentTrack.id, currentTrack.artist, currentTrack.title]);

  // Utiliser youtubeDuration pour les tracks YouTube, sinon la durée du track
  const isYouTubeTrack = (currentTrack.mediaSource as string)?.toLowerCase().includes('youtube');
  const effectiveDuration = isYouTubeTrack && youtubeDuration ? youtubeDuration : currentTrack.duration;
  const progress = effectiveDuration > 0 
    ? (currentTime / effectiveDuration) * 100 
    : 0;

  // Calculer les barres du visualizer basées sur FFT
  const visualizerBars = useMemo(() => {
    if (!vibesData?.frequency) return Array(48).fill(0.1);
    const freq = vibesData.frequency;
    const barCount = 48;
    const result = [];
    for (let i = 0; i < barCount; i++) {
      const index = Math.floor((i / barCount) * freq.length);
      result.push(freq[index] / 255);
    }
    return result;
  }, [vibesData?.frequency]);

  // Inline mode - Ultra Modern Mini Player
  if (isInline) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="h-full w-full flex items-center justify-center relative overflow-hidden"
      >
        {/* Dynamic Background based on album art */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Album art blur background */}
          <motion.div
            initial={{ scale: 1.3, opacity: 0 }}
            animate={{ scale: 1.1, opacity: 0.5 }}
            transition={{ duration: 1 }}
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${getCoverUrl(currentTrack.coverUrl)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(15px) saturate(1.5) brightness(1)',
            }}
          />
          
          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/30 to-background/70" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/50 via-transparent to-background/50" />
          
          {/* Animated orbs */}
          <motion.div
            animate={{ 
              x: [0, 30, 0],
              y: [0, -20, 0],
              scale: [1, 1.15, 1],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full blur-[80px]"
            style={{ background: "radial-gradient(circle, hsl(var(--neon-cyan) / 0.6) 0%, transparent 70%)" }}
          />
          <motion.div
            animate={{ 
              x: [0, -25, 0],
              y: [0, 25, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full blur-[100px]"
            style={{ background: "radial-gradient(circle, hsl(var(--neon-magenta) / 0.5) 0%, transparent 70%)" }}
          />
        </div>
        
        {/* Main Content */}
        <div className="flex flex-col items-center justify-center w-full relative z-10 px-8">
          
          {/* Album Art Container with effects */}
          <motion.div 
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 150, damping: 20 }}
            className="relative mb-10"
          >
            {/* Outer glow ring */}
            <motion.div
              animate={{ 
                scale: isPlaying ? [1, 1.03, 1] : 1,
                opacity: isPlaying ? [0.4, 0.7, 0.4] : 0.25,
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -inset-6 rounded-full"
              style={{
                background: `conic-gradient(from 0deg, hsl(var(--neon-cyan) / 0.6), hsl(var(--neon-magenta) / 0.6), hsl(var(--neon-purple) / 0.6), hsl(var(--neon-cyan) / 0.6))`,
                filter: 'blur(30px)',
              }}
            />
            
            {/* Album art reflection */}
            <div 
              className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-56 h-32 opacity-20"
              style={{
                backgroundImage: `url(${getCoverUrl(currentTrack.coverUrl)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'bottom',
                filter: 'blur(8px)',
                transform: 'translateX(-50%) scaleY(-1)',
                maskImage: 'linear-gradient(to top, black 0%, transparent 80%)',
                WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 80%)',
              }}
            />
            
            {/* Rotating gradient border */}
            <motion.div
              animate={{ rotate: isPlaying ? 360 : 0 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              className="absolute -inset-1.5 rounded-full p-[3px]"
              style={{
                background: `conic-gradient(from 0deg, hsl(var(--neon-cyan)), hsl(var(--neon-magenta)), hsl(var(--neon-purple)), hsl(var(--neon-cyan)))`,
                opacity: isPlaying ? 0.9 : 0.4,
              }}
            >
              <div className="w-full h-full rounded-full bg-background" />
            </motion.div>

            {/* Album Art - Vinyl style */}
            <motion.div
              animate={{ rotate: isPlaying ? 360 : 0 }}
              transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              className="relative w-64 h-64 rounded-full overflow-hidden"
              style={{
                boxShadow: isPlaying 
                  ? '0 0 60px hsl(var(--primary) / 0.35), 0 20px 60px rgba(0,0,0,0.4)' 
                  : '0 20px 50px rgba(0,0,0,0.35)',
              }}
            >
              <img
                src={getCoverUrl(currentTrack.coverUrl)}
                alt={currentTrack.album}
                className="w-full h-full object-cover"
              />
              {/* Vinyl center hole */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[16%] h-[16%] rounded-full bg-background/90 border-4 border-white/10 shadow-inner flex items-center justify-center backdrop-blur-sm">
                  <motion.div 
                    animate={{ scale: isPlaying ? [1, 1.2, 1] : 1 }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="w-2 h-2 rounded-full bg-primary/80"
                  />
                </div>
              </div>
              
              {/* Vinyl grooves overlay */}
              <div 
                className="absolute inset-0 rounded-full pointer-events-none opacity-10"
                style={{
                  background: `repeating-radial-gradient(circle at center, transparent 0px, transparent 2px, rgba(255,255,255,0.1) 3px, transparent 4px)`,
                }}
              />
            </motion.div>
          </motion.div>

          {/* Track Info */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
            className="text-center w-full max-w-lg mb-8"
          >
            <h1 className="font-display text-3xl font-bold mb-3 text-foreground truncate">
              {currentTrack.title}
            </h1>
            <p className="text-xl text-muted-foreground truncate mb-2">
              {currentTrack.artist}
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground/50">
              <Disc3 className="w-4 h-4" />
              <span className="truncate max-w-[250px]">{currentTrack.album}</span>
            </div>
          </motion.div>

          {/* Circular Visualizer around play button concept */}
          {!isYouTube && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 }}
              className="flex items-center justify-center gap-1 h-12 mb-6"
            >
              {visualizerBars.slice(0, 24).map((height, i) => (
                <motion.div
                  key={i}
                  className="w-1.5 rounded-full"
                  style={{
                    background: `linear-gradient(to top, hsl(var(--neon-cyan) / ${0.4 + height * 0.4}), hsl(var(--primary) / ${0.3 + height * 0.5}))`,
                  }}
                  animate={{ 
                    height: isPlaying ? Math.max(6, height * 48) : 6,
                    opacity: isPlaying ? 0.6 + height * 0.4 : 0.3,
                  }}
                  transition={{ duration: 0.08 }}
                />
              ))}
            </motion.div>
          )}

          {/* Mini Progress bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="w-full max-w-md"
          >
            <div className="relative h-1.5 rounded-full bg-white/10 overflow-hidden backdrop-blur-sm">
              <motion.div 
                className="h-full rounded-full"
                style={{ 
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, hsl(var(--neon-cyan)), hsl(var(--primary)), hsl(var(--neon-magenta)))',
                }}
                layoutId="mini-progress"
              />
              {/* Glow effect on progress */}
              <motion.div 
                className="absolute top-0 h-full w-4 blur-sm"
                style={{ 
                  left: `calc(${progress}% - 8px)`,
                  background: 'hsl(var(--primary))',
                  opacity: isPlaying ? 0.8 : 0.4,
                }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground/60 font-mono">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(effectiveDuration)}</span>
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  // Fullscreen mode - Ultra Modern Cinematic Design
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        "fixed inset-0 z-[10000] flex overflow-hidden",
        isYouTube ? "bg-transparent" : "bg-background"
      )}
    >
      {/* Animated Background Layer */}
      {!isYouTube && (
        <div className="absolute inset-0 overflow-hidden">
          {/* Album cover background - vivid blur */}
          <motion.div 
            initial={{ scale: 1.3, opacity: 0 }}
            animate={{ scale: 1.1, opacity: 0.6 }}
            transition={{ duration: 1.5 }}
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${getCoverUrl(currentTrack.coverUrl)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(80px) saturate(1.5) brightness(1.1)',
            }}
          />
          
          {/* Color extraction overlay - makes colors pop */}
          <div className="absolute inset-0 mix-blend-soft-light bg-gradient-to-br from-primary/40 via-transparent to-primary/30" />
          
          {/* Subtle gradient for readability - uses background color */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-background/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/50 via-transparent to-background/50" />
          
          {/* Animated light rays */}
          <motion.div
            animate={{ 
              rotate: [0, 360],
            }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] opacity-[0.07]"
            style={{
              background: `conic-gradient(from 0deg, transparent 0deg, white 2deg, transparent 4deg, transparent 90deg, white 92deg, transparent 94deg, transparent 180deg, white 182deg, transparent 184deg, transparent 270deg, white 272deg, transparent 274deg)`,
            }}
          />
          
          {/* Animated glowing orbs */}
          <motion.div
            animate={{ 
              x: [0, 80, 0],
              y: [0, -40, 0],
              scale: [1, 1.2, 1],
              opacity: [0.5, 0.7, 0.5],
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full blur-[120px]"
            style={{ background: "radial-gradient(circle, hsl(var(--neon-cyan)) 0%, transparent 70%)" }}
          />
          <motion.div
            animate={{ 
              x: [0, -60, 0],
              y: [0, 50, 0],
              scale: [1, 1.15, 1],
              opacity: [0.4, 0.6, 0.4],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute bottom-1/4 right-1/4 w-[450px] h-[450px] rounded-full blur-[140px]"
            style={{ background: "radial-gradient(circle, hsl(var(--neon-magenta)) 0%, transparent 70%)" }}
          />
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[160px]"
            style={{ background: "radial-gradient(circle, hsl(var(--neon-purple)) 0%, transparent 70%)" }}
          />

          {/* Noise texture overlay */}
          <div 
            className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            }}
          />
        </div>
      )}

      {/* Main Content - Split Layout */}
      <div className="relative z-10 flex w-full h-full">
        
        {/* Left Side - Album Art & Visualizer (60%) */}
        <motion.div 
          animate={{
            width: !isYouTube && !showControls ? '100%' : 'auto'
          }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className="flex-1 flex flex-col items-center justify-center relative p-12"
        >
          
          {/* Header - Close & Title */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ 
              opacity: showControls ? 1 : 0,
              y: showControls ? 0 : -20,
            }}
            transition={{ duration: 0.3 }}
            className="absolute top-0 left-0 right-0 flex items-center justify-between p-6"
          >
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="p-3 rounded-full backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
            >
              <ChevronDown className="w-6 h-6 text-white/70 group-hover:text-white transition-colors" />
            </motion.button>
            
            <div className="flex items-center gap-3">
              <motion.div 
                animate={{ rotate: isPlaying ? 360 : 0 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="p-2 rounded-full bg-gradient-to-r from-primary/20 to-primary/10"
              >
                <Radio className="w-4 h-4 text-primary" />
              </motion.div>
              <span className="text-xs uppercase tracking-[0.2em] text-white/50 font-medium">
                En Lecture
              </span>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={onToggleFavorite}
              className={cn(
                "p-3 rounded-full backdrop-blur-xl border transition-all",
                isFavorite 
                  ? "bg-red-500/20 border-red-500/30 text-red-500" 
                  : "bg-white/5 border-white/10 text-white/70 hover:text-red-400 hover:bg-red-500/10"
              )}
            >
              <Heart className={cn("w-6 h-6", isFavorite && "fill-current")} />
            </motion.button>
          </motion.div>

          {/* Central Album Art with Premium Effects */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: !isYouTube && !showControls ? 1.2 : 1,
              opacity: isYouTube && !showControls ? 0 : 1,
            }}
            transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.2 }}
            className="relative"
          >
            {/* Outer pulsing ring */}
            <motion.div
              animate={{ 
                scale: isPlaying ? [1, 1.05, 1] : 1,
                opacity: isPlaying ? [0.3, 0.5, 0.3] : 0.2,
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -inset-8 rounded-full"
              style={{
                background: `conic-gradient(from 0deg, hsl(var(--neon-cyan) / 0.5), hsl(var(--neon-magenta) / 0.5), hsl(var(--neon-purple) / 0.5), hsl(var(--neon-cyan) / 0.5))`,
                filter: 'blur(40px)',
              }}
            />
            
            {/* Rotating gradient border */}
            <motion.div
              animate={{ rotate: isPlaying ? 360 : 0 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="absolute -inset-1 rounded-full p-[3px]"
              style={{
                background: `conic-gradient(from 0deg, hsl(var(--neon-cyan)), hsl(var(--neon-magenta)), hsl(var(--neon-purple)), hsl(var(--neon-cyan)))`,
                opacity: isPlaying ? 0.8 : 0.4,
              }}
            >
              <div className="w-full h-full rounded-full bg-background" />
            </motion.div>

            {/* Album Art */}
            <motion.div
              animate={{ rotate: isPlaying ? 360 : 0 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="relative w-80 h-80 rounded-full overflow-hidden shadow-2xl"
              style={{
                boxShadow: isPlaying 
                  ? '0 0 80px hsl(var(--primary) / 0.3), 0 0 160px hsl(var(--primary) / 0.1)' 
                  : '0 25px 50px rgba(0,0,0,0.4)',
              }}
            >
              <img
                src={getCoverUrl(currentTrack.coverUrl)}
                alt={currentTrack.album}
                className="w-full h-full object-cover"
              />
              {/* Vinyl center hole */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[18%] h-[18%] rounded-full bg-background border-4 border-white/10 shadow-inner flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white/20" />
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Visualizer - Circular Wave */}
          {!isYouTube && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: (isPlaying && showControls) ? 1 : 0 }}
              className="absolute bottom-32 left-1/2 -translate-x-1/2 flex items-end justify-center gap-1"
              style={{ width: '60%' }}
            >
              {visualizerBars.map((height, i) => (
                <motion.div
                  key={i}
                  className="flex-1 max-w-2 rounded-t-full"
                  style={{
                    background: `linear-gradient(to top, hsl(var(--neon-cyan) / ${0.3 + height * 0.5}), hsl(var(--neon-magenta) / ${0.2 + height * 0.4}))`,
                  }}
                  animate={{ 
                    height: Math.max(4, height * 80),
                  }}
                  transition={{ duration: 0.08 }}
                />
              ))}
            </motion.div>
          )}
        </motion.div>

        {/* Right Side - Controls Panel (40%) */}
        <motion.div 
          initial={{ x: 100, opacity: 0 }}
          animate={{ 
            x: showControls ? 0 : 100,
            opacity: showControls ? 1 : 0,
          }}
          transition={{ type: "spring", stiffness: 100, damping: 20, delay: showControls ? 0.3 : 0 }}
          className={cn(
            "w-[420px] flex flex-col backdrop-blur-2xl border-l transition-all duration-300",
            isYouTube 
              ? "bg-black/60 border-white/10" 
              : "bg-background/40 border-white/5",
            !showControls && "pointer-events-none"
          )}
        >
          {/* Track Info Section */}
          <div className="flex-1 flex flex-col justify-center p-8">
            
            {/* Artist Avatar & Info */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-8"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                  <Music2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-white/50 uppercase tracking-wider">Album</p>
                  <p className="text-white/90 font-medium truncate max-w-[280px]">{currentTrack.album}</p>
                </div>
              </div>
              
              <h1 className="text-4xl font-bold text-white mb-3 leading-tight">
                {currentTrack.title}
              </h1>
              <p className="text-xl text-white/60">
                {currentTrack.artist}
              </p>
            </motion.div>

            {/* Progress Section */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mb-8"
            >
              <div className="relative group">
                {/* Progress bar background */}
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <motion.div 
                    className="h-full rounded-full bg-gradient-to-r from-primary via-primary to-primary/80"
                    style={{ width: `${progress}%` }}
                    layoutId="progress"
                  />
                </div>
                {/* Slider overlay */}
                <Slider
                  value={[currentTime]}
                  max={effectiveDuration}
                  step={0.1}
                  onValueChange={handleSeekYouTube}
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
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
            </motion.div>

            {/* Playback Controls */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex items-center justify-center gap-4 mb-8"
            >
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={onShuffle}
                className={cn(
                  "p-3 rounded-full transition-all",
                  isShuffle 
                    ? "bg-primary/20 text-primary" 
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                )}
              >
                <Shuffle className="w-5 h-5" />
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.1, x: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={onPrevious}
                className="p-4 rounded-full text-white/80 hover:text-white hover:bg-white/5 transition-all"
              >
                <SkipBack className="w-7 h-7 fill-current" />
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onPlayPause}
                className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all"
                style={{
                  background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))',
                  boxShadow: '0 8px 32px hsl(var(--primary) / 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                }}
              >
                {(isYouTube && !sharedYoutubePlayerRef ? (youtubeState.isPlaying || false) : isPlaying) ? (
                  <Pause className="w-9 h-9 text-primary-foreground fill-current" />
                ) : (
                  <Play className="w-9 h-9 text-primary-foreground fill-current ml-1" />
                )}
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.1, x: 2 }}
                whileTap={{ scale: 0.95 }}
                onClick={onNext}
                className="p-4 rounded-full text-white/80 hover:text-white hover:bg-white/5 transition-all"
              >
                <SkipForward className="w-7 h-7 fill-current" />
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={onRepeat}
                className={cn(
                  "p-3 rounded-full transition-all",
                  repeatMode !== "off" 
                    ? "bg-primary/20 text-primary" 
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                )}
              >
                {repeatMode === "one" ? (
                  <Repeat1 className="w-5 h-5" />
                ) : (
                  <Repeat className="w-5 h-5" />
                )}
              </motion.button>
            </motion.div>

            {/* Volume Control */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ 
                opacity: isYouTube && !showControls ? 0 : 1,
                y: isYouTube && !showControls ? 20 : 0,
              }}
              transition={{ delay: 0.7 }}
              className={cn(
                "flex items-center gap-4 px-4 py-3 rounded-2xl bg-white/5 border border-white/5 transition-all duration-300",
                isYouTube && !showControls && "pointer-events-none"
              )}
            >
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={onMuteToggle}
                className="p-2 text-white/60 hover:text-white transition-colors"
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
              <span className="text-xs text-white/40 font-mono w-8 text-right">
                {isMuted ? 0 : volume}%
              </span>
            </motion.div>
          </div>

          {/* Bottom Actions */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="p-6 border-t border-white/5"
          >
            <div className="flex items-center justify-center gap-6">
              <button 
                onClick={() => setShowLyrics(!showLyrics)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all",
                  showLyrics 
                    ? "bg-primary/20 text-primary" 
                    : "text-white/50 hover:text-white/80 hover:bg-white/5"
                )}
              >
                <ListMusic className="w-4 h-4" />
                <span>Paroles</span>
              </button>
              <button className="flex items-center gap-2 px-4 py-2 rounded-full text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-all">
                <Share2 className="w-4 h-4" />
                <span>Partager</span>
              </button>
              <button 
                title="Plus d'options"
                className="p-2 rounded-full text-white/50 hover:text-white/80 hover:bg-white/5 transition-all"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Lyrics Overlay */}
      <AnimatePresence>
        {showLyrics && lyrics && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute inset-x-0 bottom-0 z-50 max-h-[50vh] overflow-y-auto backdrop-blur-2xl bg-background/80 border-t border-white/10 p-8"
          >
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center gap-3 mb-6">
                <Sparkles className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold text-white">Paroles</h3>
              </div>
              <div className="text-white/70 whitespace-pre-wrap leading-relaxed text-lg">
                {lyrics}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
