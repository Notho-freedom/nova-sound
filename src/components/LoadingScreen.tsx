import { useState, useEffect, useRef } from "react";
import { useInitializationProgress } from "@/hooks/useInitializationProgress";
import { cn } from "@/lib/utils";

interface LoadingScreenProps {
  onLoadComplete: () => void;
  minDuration?: number;
}

/**
 * Vision Pro Loading Screen
 * Minimal, elegant loading with subtle animations
 */
export const LoadingScreen = ({ onLoadComplete, minDuration = 2000 }: LoadingScreenProps) => {
  const { progress: realProgress, status: realStatus, isComplete } = useInitializationProgress();
  const [displayProgress, setDisplayProgress] = useState(0);
  const [startTime] = useState(Date.now());
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Smooth progress animation
  useEffect(() => {
    const animateProgress = () => {
      const diff = realProgress - displayProgress;
      if (diff > 0.1) {
        const step = Math.max(0.5, diff * 0.12);
        setDisplayProgress(prev => {
          const next = Math.min(prev + step, realProgress);
          if (next < realProgress) {
            animationFrameRef.current = requestAnimationFrame(animateProgress);
          }
          return next;
        });
      } else {
        setDisplayProgress(realProgress);
      }
    };

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(animateProgress);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [realProgress, displayProgress]);

  // Handle completion
  useEffect(() => {
    if (isComplete) {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, minDuration - elapsed);
      
      const timer = setTimeout(() => {
        setDisplayProgress(100);
        setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.style.opacity = '0';
          }
          setTimeout(onLoadComplete, 400);
        }, 300);
      }, remaining);

      return () => clearTimeout(timer);
    }
  }, [isComplete, startTime, minDuration, onLoadComplete]);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "fixed inset-0 z-[100]",
        "bg-black",
        "flex flex-col items-center justify-center",
        "transition-opacity duration-500 ease-out-expo",
      )}
    >
      {/* Cinematic ambient glow */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 50% at 50% 45%, hsl(var(--primary) / 0.12) 0%, transparent 70%)`,
        }}
      />
      
      {/* Secondary accent glow */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{
          background: `radial-gradient(circle at 30% 70%, hsl(var(--accent) / 0.1) 0%, transparent 40%)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo container with spatial glass ring */}
        <div className="relative mb-16">
          {/* Outer glow ring */}
          <div 
            className="absolute inset-0 rounded-full blur-xl opacity-50"
            style={{
              background: `conic-gradient(from 0deg, hsl(var(--primary) / 0.5), hsl(var(--accent) / 0.3), hsl(var(--primary) / 0.5))`,
              transform: 'scale(1.3)',
            }}
          />
          
          {/* Glass ring */}
          <div className={cn(
            "w-32 h-32 rounded-full flex items-center justify-center",
            "bg-white/[0.03] backdrop-blur-2xl",
            "border border-white/[0.1]",
            "shadow-2xl shadow-black/50"
          )}>
            {/* Rotating gradient border */}
            <div 
              className="absolute inset-0 rounded-full animate-spin-slow"
              style={{ 
                background: 'conic-gradient(from 0deg, transparent 0%, hsl(var(--primary)) 25%, transparent 50%)',
                maskImage: 'radial-gradient(circle, transparent 60%, black 61%, black 100%)',
                WebkitMaskImage: 'radial-gradient(circle, transparent 60%, black 61%, black 100%)',
                animationDuration: '4s' 
              }}
            />
            
            {/* Icon with glow */}
            <div className="relative">
              <img 
                src="/icon.png" 
                alt="NEXUS" 
                className="w-16 h-16 object-contain relative z-10"
                style={{
                  filter: 'drop-shadow(0 0 30px hsl(var(--primary) / 0.5))'
                }}
              />
            </div>
          </div>
        </div>

        {/* Title - Clean typography */}
        <h1 className="text-5xl font-semibold tracking-tight text-white mb-3">
          NEXUS
        </h1>
        <p className="text-xs font-medium tracking-[0.35em] text-white/30 uppercase mb-20">
          Audio System
        </p>

        {/* Progress container */}
        <div className="w-56">
          {/* Progress bar - Thin luminous line */}
          <div className="relative h-[2px] bg-white/[0.08] rounded-full overflow-hidden mb-5">
            <div 
              className="absolute left-0 top-0 h-full bg-white rounded-full transition-all duration-300 ease-out"
              style={{ 
                width: `${displayProgress}%`,
                boxShadow: '0 0 15px rgba(255, 255, 255, 0.6)'
              }}
            />
          </div>
          
          {/* Status text */}
          <div className="flex items-center justify-center gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-lg shadow-primary/50" />
            <span className="text-xs text-white/35 truncate max-w-[180px] font-light">
              {realStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Version footer */}
      <div className="absolute bottom-10 text-center">
        <p className="text-[10px] text-white/15 font-mono tracking-widest">
          v1.0.0
        </p>
      </div>
    </div>
  );
};
