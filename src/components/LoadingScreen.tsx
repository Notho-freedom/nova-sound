import { useState, useEffect, useRef } from "react";
import { Music } from "lucide-react";
import { useInitializationProgress } from "@/hooks/useInitializationProgress";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

interface LoadingScreenProps {
  onLoadComplete: () => void;
  minDuration?: number;
}

/**
 * Écran de chargement connecté au système d'initialisation réel
 * 
 * Ce composant affiche la progression basée sur l'état réel des services :
 * - Firebase (initialisation)
 * - Stripe (configuration)
 * - Bibliothèque audio (chargement)
 * - Services cloud (synchronisation)
 * - Cloudinary (configuration optionnelle)
 * 
 * La progression et le statut sont récupérés via le hook useInitializationProgress
 * qui surveille l'état réel de chaque service. L'écran se termine automatiquement
 * quand tous les services critiques sont initialisés, même si l'utilisateur n'est pas authentifié.
 */
export const LoadingScreen = ({ onLoadComplete, minDuration = 2200 }: LoadingScreenProps) => {
  // Connexion au système d'initialisation réel via le hook
  const { progress: realProgress, status: realStatus, isComplete } = useInitializationProgress();
  const { theme } = useTheme();
  const [displayProgress, setDisplayProgress] = useState(0);
  const [statusText, setStatusText] = useState("Initialisation du système...");
  const [startTime] = useState(Date.now());
  const progressRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Animation fluide de la progression - connectée à la progression réelle d'initialisation
  useEffect(() => {
    const animateProgress = () => {
      const diff = realProgress - displayProgress;
      if (diff > 0.1) { // Only animate if difference is significant
        const step = Math.max(0.5, diff * 0.15);
        
        setDisplayProgress(prev => {
          const next = Math.min(prev + step, realProgress);
          if (next < realProgress) {
            animationFrameRef.current = requestAnimationFrame(animateProgress);
          }
          return next;
        });
      } else {
        // Snap to final value if very close
        setDisplayProgress(realProgress);
      }
    };

    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Start animation
    animationFrameRef.current = requestAnimationFrame(animateProgress);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [realProgress, displayProgress]);

  // Mise à jour du texte de statut depuis le système d'initialisation réel
  useEffect(() => {
    setStatusText(realStatus);
  }, [realStatus]);

  // Gestion de la complétion du chargement
  // Se déclenche quand le système d'initialisation signale que tout est prêt
  useEffect(() => {
    if (isComplete) {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, minDuration - elapsed);
      
      const timer = setTimeout(() => {
        // Animation finale vers 100%
        setDisplayProgress(100);
        
        // Fondu de sortie en douceur
        setTimeout(() => {
          if (progressRef.current) {
            progressRef.current.style.opacity = '0';
          }
          setTimeout(onLoadComplete, 300);
        }, 400);
      }, remaining);

      return () => clearTimeout(timer);
    }
  }, [isComplete, startTime, minDuration, onLoadComplete]);

  return (
    <div 
      ref={progressRef}
      className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500"
    >
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
      
      {/* Geometric grid pattern */}
      <div className="absolute inset-0 opacity-5">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(circle at 25% 25%, hsl(var(--primary) / 0.15) 0%, transparent 50%),
              radial-gradient(circle at 75% 75%, hsl(var(--secondary) / 0.15) 0%, transparent 50%)
            `,
          }}
        />
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 1px,
              hsl(var(--border) / 0.05) 1px,
              hsl(var(--border) / 0.05) 2px
            )`,
          }}
        />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-[1px] h-[1px] rounded-full bg-primary/20 animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${15 + Math.random() * 10}s`,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-md px-8">
        {/* Animated logo container */}
        {/* Logo avec anneaux rotatifs (from original) */}
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
            
            {/* Icône avec lueur synchronisée au thème */}
            <div className="relative">
              {/* Effet de lueur dynamique basé sur les variables CSS du thème */}
              <div 
                className="absolute -inset-4 rounded-full blur-md opacity-30 transition-colors duration-500"
                style={{
                  background: `radial-gradient(circle, hsl(var(--primary) / 0.5) 0%, transparent 70%)`,
                }}
              />
              
              {/* Conteneur de l'icône avec gradient et lueur */}
              <div 
                className="w-16 h-16 backdrop-blur-sm flex items-center justify-center transition-all duration-500"
              >
                <img 
                  src="/icon.png" 
                  alt="NEXUS" 
                  className={cn("object-contain transition-all duration-500",  "w-15 h-15")}
                  style={{
                    filter: `drop-shadow(0 0 8px hsl(var(--primary) / 0.8))`
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Title with gradient text */}
        <div className="text-center mb-12">
          <h1 className="font-display text-5xl font-bold tracking-tight mb-2">
            <span className="bg-gradient-to-r from-primary via-foreground to-secondary bg-clip-text text-transparent">
              NEXUS
            </span>
          </h1>
          <p className="text-sm text-muted-foreground font-display tracking-[0.3em] uppercase">
            AUDIO SYSTEM
          </p>
        </div>


        {/* Indicateur de progression connecté au système d'initialisation réel */}
        <div className="w-full mb-8">
          {/* Barre de progression avec gradient animé synchronisé au thème */}
          <div className="relative h-1 bg-muted/30 rounded-full overflow-hidden mb-4">
            {/* Barre de progression principale - synchronisée avec realProgress du hook */}
            <div 
              className="absolute top-0 left-0 h-full rounded-full transition-all duration-300 ease-out"
              style={{ 
                width: `${displayProgress}%`,
                background: `linear-gradient(90deg, 
                  hsl(var(--primary)), 
                  hsl(var(--secondary)),
                  hsl(var(--primary))
                )`,
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s infinite linear',
              }}
            />
            
            {/* Effet de lueur pour la barre de progression */}
            <div 
              className="absolute top-0 left-0 h-full blur-sm transition-all duration-300 ease-out"
              style={{ 
                width: `${displayProgress}%`,
                background: `linear-gradient(90deg, 
                  hsl(var(--primary) / 0.5), 
                  hsl(var(--secondary) / 0.5)
                )`,
              }}
            />
          </div>
          
          {/* Statut et pourcentage - affiche le statut réel du système d'initialisation */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-muted-foreground font-medium tracking-wide">
                {statusText}
              </span>
            </div>
            <span className="font-display font-bold text-primary tabular-nums">
              {Math.round(displayProgress)}%
            </span>
          </div>
        </div>


        {/* Version info */}
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <p className="text-xs text-muted-foreground/60 font-mono tracking-wider">
            v1.0.0 • Build 2024.12.08
          </p>
        </div>
      </div>

      {/* Subtle scanlines effect */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(var(--foreground)) 2px, hsl(var(--foreground)) 4px)',
        }}
      />
    </div>
  );
};