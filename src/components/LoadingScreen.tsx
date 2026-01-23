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
      {/* Subtle radial gradient */}
      <div 
        className="absolute inset-0 opacity-40"
        style={{
          background: 'radial-gradient(circle at 50% 40%, hsl(var(--primary) / 0.15) 0%, transparent 60%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo */}
        <div className="relative mb-12">
          {/* Outer ring - subtle pulse */}
          <div className="w-28 h-28 rounded-full border border-white/[0.08] flex items-center justify-center">
            {/* Rotating accent */}
            <div 
              className="absolute inset-0 rounded-full border-t border-primary/50 animate-spin-slow"
              style={{ animationDuration: '3s' }}
            />
            
            {/* Icon */}
            <div className="relative">
              <img 
                src="/icon.png" 
                alt="NEXUS" 
                className="w-14 h-14 object-contain"
                style={{
                  filter: 'drop-shadow(0 0 20px hsl(var(--primary) / 0.4))'
                }}
              />
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">
          NEXUS
        </h1>
        <p className="text-xs font-medium tracking-[0.25em] text-white/40 uppercase mb-16">
          Audio System
        </p>

        {/* Progress */}
        <div className="w-48">
          {/* Progress bar */}
          <div className="relative h-[2px] bg-white/[0.08] rounded-full overflow-hidden mb-4">
            <div 
              className="absolute left-0 top-0 h-full bg-white rounded-full transition-all duration-300 ease-out"
              style={{ width: `${displayProgress}%` }}
            />
          </div>
          
          {/* Status */}
          <div className="flex items-center justify-center gap-2">
            <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
            <span className="text-xs text-white/40 truncate max-w-[160px]">
              {realStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Version */}
      <div className="absolute bottom-8 text-center">
        <p className="text-[10px] text-white/20 font-mono tracking-wider">
          v1.0.0
        </p>
      </div>
    </div>
  );
};
