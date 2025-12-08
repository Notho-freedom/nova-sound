import { useState, useEffect } from "react";
import { Music } from "lucide-react";

interface LoadingScreenProps {
  onLoadComplete: () => void;
  minDuration?: number;
}

export const LoadingScreen = ({ onLoadComplete, minDuration = 2500 }: LoadingScreenProps) => {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Initialisation du système...");

  useEffect(() => {
    const statusMessages = [
      "Initialisation du système...",
      "Chargement des modules audio...",
      "Configuration du visualiseur...",
      "Synchronisation des bibliothèques...",
      "Préparation de l'interface...",
      "Système prêt."
    ];

    const interval = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev + Math.random() * 15 + 5;
        
        // Update status text based on progress
        const statusIndex = Math.min(
          Math.floor((newProgress / 100) * statusMessages.length),
          statusMessages.length - 1
        );
        setStatusText(statusMessages[statusIndex]);

        if (newProgress >= 100) {
          clearInterval(interval);
          setTimeout(onLoadComplete, 500);
          return 100;
        }
        return newProgress;
      });
    }, minDuration / 8);

    return () => clearInterval(interval);
  }, [onLoadComplete, minDuration]);

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

      {/* Animated Orbs */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-primary/10 blur-[100px] animate-pulse" />
      <div 
        className="absolute w-[300px] h-[300px] rounded-full bg-secondary/10 blur-[80px] animate-pulse"
        style={{ animationDelay: '0.5s' }}
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
            {/* Icon */}
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center glow-cyan">
              <Music className="w-8 h-8 text-primary" />
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-wider text-primary neon-text-cyan mb-2">
          NEXUS
        </h1>
        <p className="text-sm text-muted-foreground font-display tracking-[0.3em] mb-12">
          AUDIO SYSTEM
        </p>

        {/* Progress Bar */}
        <div className="w-64 md:w-80">
          <div className="h-1 bg-muted rounded-full overflow-hidden mb-3">
            <div 
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{ 
                width: `${progress}%`,
                background: 'linear-gradient(90deg, hsl(var(--neon-cyan)), hsl(var(--neon-magenta)))',
                boxShadow: '0 0 10px hsl(var(--neon-cyan) / 0.5)'
              }}
            />
          </div>
          
          {/* Status Text */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-mono">{statusText}</span>
            <span className="text-primary font-display">{Math.round(progress)}%</span>
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
