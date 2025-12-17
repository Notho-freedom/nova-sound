import { useState, useEffect } from "react";
import { Music } from "lucide-react";
import { useInitializationProgress } from "@/hooks/useInitializationProgress";
import { useTheme } from "@/hooks/useTheme";

interface LoadingScreenProps {
  onLoadComplete: () => void;
  minDuration?: number;
}

export const LoadingScreen = ({ onLoadComplete, minDuration = 2500 }: LoadingScreenProps) => {
  const { progress: realProgress, status: realStatus, isComplete } = useInitializationProgress();
  const { theme } = useTheme();
  const [displayProgress, setDisplayProgress] = useState(0);
  const [statusText, setStatusText] = useState("Initialisation du système...");
  const [startTime] = useState(Date.now());

  // Smooth progress animation based on real progress
  useEffect(() => {
    const targetProgress = realProgress;
    const currentProgress = displayProgress;
    
    if (targetProgress > currentProgress) {
      const diff = targetProgress - currentProgress;
      const step = Math.max(1, diff / 10); // Smooth increment
      
      const interval = setInterval(() => {
        setDisplayProgress((prev) => {
          const next = Math.min(prev + step, targetProgress);
          if (next >= targetProgress) {
            clearInterval(interval);
            return targetProgress;
          }
          return next;
        });
      }, 50);

      return () => clearInterval(interval);
    }
  }, [realProgress, displayProgress]);

  // Update status text from real initialization
  useEffect(() => {
    setStatusText(realStatus);
  }, [realStatus]);

  // Complete loading when initialization is done and minimum duration has passed
  useEffect(() => {
    if (isComplete) {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, minDuration - elapsed);
      
      const timer = setTimeout(() => {
        setDisplayProgress(100);
        setTimeout(onLoadComplete, 500);
      }, remaining);

      return () => clearTimeout(timer);
    }
  }, [isComplete, startTime, minDuration, onLoadComplete]);

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center overflow-hidden">
      {/* Background Grid */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--primary) / 0.3) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--primary) / 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Animated Orbs with theme-synchronized colors */}
      <div 
        className="absolute w-[500px] h-[500px] rounded-full blur-[100px] animate-pulse transition-colors duration-500"
        style={{ 
          backgroundColor: `hsl(var(--primary) / 0.1)`,
        }}
      />
      <div 
        className="absolute w-[300px] h-[300px] rounded-full blur-[80px] animate-pulse transition-colors duration-500"
        style={{ 
          animationDelay: '0.5s',
          backgroundColor: `hsl(var(--secondary) / 0.1)`,
        }}
      />

      {/* Logo */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Spinning Ring */}
        <div className="relative mb-8">
          <div className="w-32 h-32 rounded-full border-2 border-primary/20 flex items-center justify-center relative">
            {/* Rotating outer ring */}
            <div 
              className="absolute inset-0 rounded-full border-t-2 border-r-2 border-primary animate-spin"
              style={{ animationDuration: '1.5s' }}
            />
            {/* Counter-rotating inner ring */}
            <div 
              className="absolute inset-2 rounded-full border-b-2 border-l-2 border-secondary animate-spin"
              style={{ animationDuration: '2s', animationDirection: 'reverse' }}
            />
            {/* Icon with theme-synchronized glow */}
            <div 
              className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center transition-all duration-500"
              style={{
                boxShadow: `0 0 20px hsl(var(--primary) / 0.5), 0 0 40px hsl(var(--primary) / 0.3), 0 0 60px hsl(var(--primary) / 0.1)`,
                animation: 'pulse 2s ease-in-out infinite'
              }}
            >
              <Music 
                className="w-8 h-8 text-primary transition-colors duration-500" 
                style={{
                  filter: `drop-shadow(0 0 8px hsl(var(--primary) / 0.8))`
                }}
              />
            </div>
          </div>
        </div>

        {/* Title with theme-synchronized glow */}
        <h1 
          className="font-display text-4xl md:text-5xl font-bold tracking-wider text-primary mb-2 transition-colors duration-500"
          style={{
            textShadow: `0 0 10px hsl(var(--primary) / 0.8), 0 0 20px hsl(var(--primary) / 0.5), 0 0 30px hsl(var(--primary) / 0.3)`
          }}
        >
          NEXUS
        </h1>
        <p className="text-sm text-muted-foreground font-display tracking-[0.3em] mb-12">
          AUDIO SYSTEM
        </p>

        {/* Progress Bar with theme-synchronized colors */}
        <div className="w-64 md:w-80">
          <div className="h-1 bg-muted rounded-full overflow-hidden mb-3">
            <div 
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{ 
                width: `${displayProgress}%`,
                background: `linear-gradient(90deg, hsl(var(--primary)), hsl(var(--secondary)))`,
                boxShadow: `0 0 10px hsl(var(--primary) / 0.5), 0 0 20px hsl(var(--primary) / 0.3)`
              }}
            />
          </div>
          
          {/* Status Text */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-mono">{statusText}</span>
            <span className="text-primary font-display transition-colors duration-500">{Math.round(displayProgress)}%</span>
          </div>
        </div>

        {/* Version */}
        <p className="mt-12 text-xs text-muted-foreground/50 font-mono">
          v1.0.0 • Build 2024.12.08
        </p>
      </div>

      {/* Scanlines Effect */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(var(--foreground)) 2px, hsl(var(--foreground)) 4px)',
        }}
      />
    </div>
  );
};
