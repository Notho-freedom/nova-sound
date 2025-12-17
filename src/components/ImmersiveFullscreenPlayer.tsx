"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Track } from "@/types/music";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import { useAudioSenses } from "@/hooks/useAudioSenses";

interface ImmersiveFullscreenPlayerProps {
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
  onClose: () => void;
  onToggleFavorite?: () => void;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const ImmersiveFullscreenPlayer = ({
  currentTrack,
  isPlaying,
  currentTime,
  isShuffle,
  repeatMode,
  volume,
  isMuted,
  isFavorite = false,
  audioElement,
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
}: ImmersiveFullscreenPlayerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const threeSceneRef = useRef<any>(null);
  const threeCameraRef = useRef<any>(null);
  const threeRendererRef = useRef<any>(null);
  const particlesRef = useRef<any[]>([]);
  const starsRef = useRef<any>(null);
  const [showControls, setShowControls] = useState(true);
  const [dominantColor, setDominantColor] = useState("#3b82f6");
  const [isUserActive, setIsUserActive] = useState(true); // Start with Nexus background
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Audio analysis
  const sensesData = useAudioSenses(audioElement ?? null, {
    enablePitchDetection: false,
    enableBPMDetection: true,
  });

  const VolumeIcon = isMuted || volume === 0 
    ? VolumeX 
    : volume < 50 
      ? Volume1 
      : Volume2;

  const progress = currentTrack.duration > 0 
    ? (currentTime / currentTrack.duration) * 100 
    : 0;

  // Extract dominant color from album art
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = getCoverUrl(currentTrack.coverUrl);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Simple color extraction (average of bright pixels)
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 16) {
        const pixelR = data[i];
        const pixelG = data[i + 1];
        const pixelB = data[i + 2];
        const brightness = (pixelR + pixelG + pixelB) / 3;
        
        if (brightness > 50) {
          r += pixelR;
          g += pixelG;
          b += pixelB;
          count++;
        }
      }
      
      if (count > 0) {
        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);
        setDominantColor(`rgb(${r}, ${g}, ${b})`);
      }
    };
  }, [currentTrack.coverUrl]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!canvasRef.current || typeof window === 'undefined') return;

    let cleanup: (() => void) | null = null;
    let animationId: number | null = null;

    // Dynamically load Three.js
    const loadThree = async () => {
      if ((window as any).THREE) {
        initThreeScene();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/three@0.160.0/build/three.min.js';
      script.onload = () => {
        initThreeScene();
      };
      document.head.appendChild(script);
    };

    const initThreeScene = () => {
      const THREE = (window as any).THREE;
      if (!THREE) return;

      // Cleanup previous scene if exists
      if (threeRendererRef.current) {
        threeRendererRef.current.dispose();
      }

      const canvas = canvasRef.current!;
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x01020a);
      threeSceneRef.current = scene;

      // Camera - positioned to view the scene
      const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 3000);
      camera.position.set(0, 0, 90);
      camera.lookAt(0, 0, 0);
      threeCameraRef.current = camera;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ 
        canvas, 
        alpha: true, 
        antialias: true 
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      threeRendererRef.current = renderer;

      // Stars field
      const STAR_COUNT = 5000;
      const starPositions = new Float32Array(STAR_COUNT * 3);
      for (let i = 0; i < STAR_COUNT; i++) {
        starPositions[i * 3] = (Math.random() - 0.5) * 1400;
        starPositions[i * 3 + 1] = (Math.random() - 0.5) * 1400;
        starPositions[i * 3 + 2] = Math.random() * -3000;
      }
      const starGeometry = new THREE.BufferGeometry();
      starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
      const starMaterial = new THREE.PointsMaterial({
        color: 0x8bbcff,
        size: 1,
        transparent: true,
        opacity: 0.85
      });
      const stars = new THREE.Points(starGeometry, starMaterial);
      scene.add(stars);
      starsRef.current = stars;


      // Particles - free floating with random velocities
      const particleCount = 200;
      const particles = new THREE.BufferGeometry();
      const particlePositions = new Float32Array(particleCount * 3);
      const particleColors = new Float32Array(particleCount * 3);
      const particleVelocities: number[] = []; // Store velocities for each particle
      
      for (let i = 0; i < particleCount; i++) {
        // Random initial positions - spread in space
        particlePositions[i * 3] = (Math.random() - 0.5) * 200;
        particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 200;
        particlePositions[i * 3 + 2] = Math.random() * -300 - 50; // Start behind camera
        
        // Random velocities for free movement - particles move towards camera (positive Z)
        particleVelocities.push(
          (Math.random() - 0.5) * 0.4, // vx
          (Math.random() - 0.5) * 0.4, // vy
          Math.random() * 0.5 + 0.2  // vz - always positive (towards camera)
        );
        
        const color = new THREE.Color();
        color.setHSL(0.6, 0.8, 0.6);
        particleColors[i * 3] = color.r;
        particleColors[i * 3 + 1] = color.g;
        particleColors[i * 3 + 2] = color.b;
      }
      
      particles.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
      particles.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));
      
      // Store velocities in ref for animation
      const velocitiesRef = { current: particleVelocities };
      
      const particleMaterial = new THREE.PointsMaterial({
        size: 1, // Small base size
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true, // Particles grow as they get closer
        map: (() => {
          // Create a circular texture for round particles
          const canvas = document.createElement('canvas');
          canvas.width = 32;
          canvas.height = 32;
          const ctx = canvas.getContext('2d')!;
          const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
          gradient.addColorStop(0, 'rgba(255,255,255,1)');
          gradient.addColorStop(0.5, 'rgba(255,255,255,0.8)');
          gradient.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, 32, 32);
          const texture = new THREE.CanvasTexture(canvas);
          return texture;
        })()
      });
      
      const particleSystem = new THREE.Points(particles, particleMaterial);
      scene.add(particleSystem);
      particlesRef.current = [particleSystem, particles, velocitiesRef];

      // Animation loop
      const speed = 1.3;
      const animate = () => {
        animationId = requestAnimationFrame(animate);

        // Audio reactive effects
        const bass = sensesData?.energyBands?.bass ? sensesData.energyBands.bass / 255 : 0;
        const mid = sensesData?.energyBands?.mid ? sensesData.energyBands.mid / 255 : 0;
        const high = sensesData?.energyBands?.treble ? sensesData.energyBands.treble / 255 : 0;
        const volume = sensesData?.volume || 0;

        // Stars movement
        const starArray = starGeometry.attributes.position.array as Float32Array;
        for (let i = 0; i < STAR_COUNT; i++) {
          starArray[i * 3 + 2] += speed + bass * 25;
          if (starArray[i * 3 + 2] > 120) {
            starArray[i * 3 + 2] = -3000;
          }
        }
        starGeometry.attributes.position.needsUpdate = true;


        // Particles animation - free floating movement, no audio reactivity
        if (particlesRef.current[0] && particlesRef.current[2]) {
          const particleArray = particlesRef.current[1].attributes.position.array as Float32Array;
          const velocities = particlesRef.current[2].current;
          
          for (let i = 0; i < particleCount; i++) {
            const idx = i * 3;
            
            // Update position with velocity (free movement) - fixed speed, no external factors
            const fixedSpeed = 0.5; // Fixed speed multiplier
            particleArray[idx] += velocities[i * 3] * fixedSpeed;
            particleArray[idx + 1] += velocities[i * 3 + 1] * fixedSpeed;
            particleArray[idx + 2] += velocities[i * 3 + 2] * fixedSpeed;
            
            // Wrap around boundaries for continuous flow
            if (Math.abs(particleArray[idx]) > 100) {
              particleArray[idx] = -Math.sign(particleArray[idx]) * 100;
            }
            if (Math.abs(particleArray[idx + 1]) > 100) {
              particleArray[idx + 1] = -Math.sign(particleArray[idx + 1]) * 100;
            }
            // Reset Z when particle passes camera (grows as it approaches)
            if (particleArray[idx + 2] > 50) {
              particleArray[idx + 2] = -350; // Reset far behind
            }
          }
          particlesRef.current[1].attributes.position.needsUpdate = true;
        }

        // Camera movement - subtle movement
        camera.position.x = Math.sin(performance.now() * 0.0012) * bass * 7;
        camera.position.y = Math.cos(performance.now() * 0.0015) * bass * 7;
        camera.lookAt(0, 0, 0);
        scene.rotation.z = high * 0.04;

        renderer.render(scene, camera);
      };

      animate();

      // Handle resize
      const handleResize = () => {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
      };
      window.addEventListener('resize', handleResize);

      cleanup = () => {
        window.removeEventListener('resize', handleResize);
        if (animationId !== null) {
          cancelAnimationFrame(animationId);
        }
        if (renderer) {
          renderer.dispose();
        }
        // Dispose geometries and materials
        if (starGeometry) starGeometry.dispose();
        if (starMaterial) starMaterial.dispose();
        if (particles) particles.dispose();
        if (particleMaterial) particleMaterial.dispose();
      };
    };

    loadThree();

    return () => {
      if (cleanup) cleanup();
    };
  }, [currentTrack.id]);

  // Auto-hide controls
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowControls(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [showControls]);

  // Inactivity detection - switch to space mode after 10 seconds
  useEffect(() => {
    // Ensure we start with active state (Nexus background)
    setIsUserActive(true);
    
    const resetInactivityTimer = () => {
      setIsUserActive(true);
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      inactivityTimerRef.current = setTimeout(() => {
        setIsUserActive(false);
      }, 10000); // 10 seconds
    };

    // Initial timer - start counting after component mount
    // Don't start timer immediately, wait for first user interaction or 10s
    inactivityTimerRef.current = setTimeout(() => {
      setIsUserActive(false);
    }, 10000);

    // Listen to user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click', 'wheel'];
    events.forEach(event => {
      document.addEventListener(event, resetInactivityTimer, { passive: true });
    });

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      events.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer);
      });
    };
  }, []);

  // Handle activity on the main container - unified with inactivity timer
  const handleContainerActivity = useCallback(() => {
    setShowControls(true);
    setIsUserActive(true);
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(() => {
      setIsUserActive(false);
    }, 10000);
  }, []);

  // Debug: log state changes
  useEffect(() => {
    console.log('isUserActive changed:', isUserActive);
  }, [isUserActive]);

  return (
    <div 
      className="fixed inset-0 z-[10000] flex flex-col overflow-hidden transition-all duration-1000"
      style={{
        background: isUserActive 
          ? "radial-gradient(circle at center, #050913, #01020a)" // Nexus background
          : "radial-gradient(circle at center, #000000, #000011)" // Space background
      }}
      onMouseMove={handleContainerActivity}
      onClick={handleContainerActivity}
      onTouchStart={handleContainerActivity}
    >
      {/* Nexus Background Effects - only when user is active */}
      {isUserActive && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden transition-opacity duration-1000">
          {/* Grid pattern */}
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `
                linear-gradient(hsl(230 30% 20% / 0.5) 1px, transparent 1px),
                linear-gradient(90deg, hsl(230 30% 20% / 0.5) 1px, transparent 1px)
              `,
              backgroundSize: "80px 80px",
            }}
          />
          
          {/* Gradient orbs */}
          <div 
            className="absolute top-1/4 -left-32 w-96 h-96 rounded-full opacity-20 blur-3xl"
            style={{
              background: "radial-gradient(circle, hsl(180 100% 50%) 0%, transparent 70%)"
            }}
          />
          <div 
            className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full opacity-20 blur-3xl"
            style={{
              background: "radial-gradient(circle, hsl(320 100% 60%) 0%, transparent 70%)"
            }}
          />
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10 blur-3xl"
            style={{
              background: "radial-gradient(circle, hsl(270 80% 60%) 0%, transparent 70%)"
            }}
          />
          
        {/* Scanline effect */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(200 100% 95%) 2px, hsl(200 100% 95%) 4px)"
          }}
        />
        </div>
      )}

      {/* Three.js Canvas Background */}
      <canvas 
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Controls Overlay */}
      <div 
        className={cn(
          "absolute inset-0 z-10 flex flex-col transition-opacity duration-500",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 backdrop-blur-sm bg-background/20">
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/80 hover:text-white"
          >
            <ChevronDown className="w-6 h-6" />
          </button>
          <div className="text-center">
            <p className="text-xs text-white/60 uppercase tracking-widest">
              Mode Immersif
            </p>
          </div>
          <button
            onClick={onToggleFavorite}
            className={cn(
              "p-2 rounded-full transition-all duration-200",
              isFavorite 
                ? "text-red-400" 
                : "text-white/60 hover:text-red-400"
            )}
          >
            <Heart className={cn("w-6 h-6", isFavorite && "fill-current")} />
          </button>
        </div>

        {/* Center Content - Floating Track Info positioned below album */}
        <div className="flex-1 flex items-end justify-center pb-32">
          <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 
              className="font-display text-4xl md:text-6xl font-bold text-white drop-shadow-2xl"
              style={{ textShadow: `0 0 40px ${dominantColor}, 0 0 80px ${dominantColor}` }}
            >
              {currentTrack.title}
            </h1>
            <p className="text-2xl md:text-3xl text-white/90 drop-shadow-lg font-medium">
              {currentTrack.artist}
            </p>
            <p className="text-lg text-white/70 drop-shadow">
              {currentTrack.album}
            </p>
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="p-6 backdrop-blur-sm bg-background/20">
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs text-white/60 w-12 text-right font-mono">
                {formatTime(currentTime)}
              </span>
              <Slider
                value={[currentTime]}
                max={currentTrack.duration}
                step={1}
                onValueChange={onSeek}
                className="flex-1"
              />
              <span className="text-xs text-white/60 w-12 font-mono">
                {formatTime(currentTrack.duration)}
              </span>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <button
              onClick={onShuffle}
              className={cn(
                "p-2 rounded-full transition-all duration-200",
                isShuffle 
                  ? "text-white" 
                  : "text-white/40 hover:text-white/80"
              )}
            >
              <Shuffle className="w-5 h-5" />
            </button>
            
            <button
              onClick={onPrevious}
              className="p-3 text-white/80 hover:text-white transition-colors"
            >
              <SkipBack className="w-6 h-6 fill-current" />
            </button>
            
            <button
              onClick={onPlayPause}
              className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/30 shadow-2xl transition-all duration-200 hover:scale-110"
              style={{ boxShadow: `0 0 40px ${dominantColor}` }}
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 fill-current" />
              ) : (
                <Play className="w-8 h-8 fill-current ml-1" />
              )}
            </button>
            
            <button
              onClick={onNext}
              className="p-3 text-white/80 hover:text-white transition-colors"
            >
              <SkipForward className="w-6 h-6 fill-current" />
            </button>
            
            <button
              onClick={onRepeat}
              className={cn(
                "p-2 rounded-full transition-all duration-200",
                repeatMode !== "off" 
                  ? "text-white" 
                  : "text-white/40 hover:text-white/80"
              )}
            >
              {repeatMode === "one" ? (
                <Repeat1 className="w-5 h-5" />
              ) : (
                <Repeat className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={onMuteToggle}
              className="p-2 text-white/60 hover:text-white/80 transition-colors"
            >
              <VolumeIcon className="w-5 h-5" />
            </button>
            <Slider
              value={[isMuted ? 0 : volume]}
              max={100}
              step={1}
              onValueChange={onVolumeChange}
              className="flex-1 max-w-xs"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

