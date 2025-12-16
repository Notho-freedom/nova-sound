import { Home, ChevronRight } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import type { Track } from "@/types/music";

interface HeroBreadcrumbsProps {
  className?: string;
  userName?: string;
  trackCount?: number;
  featuredTrack?: Track;
}

export const HeroBreadcrumbs = ({ className, userName, trackCount, featuredTrack }: HeroBreadcrumbsProps) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bonjour";
    if (hour < 18) return "Bon après-midi";
    return "Bonsoir";
  };

  const backgroundImage = featuredTrack?.coverUrl 
    ? getCoverUrl(featuredTrack.coverUrl)
    : undefined;

  return (
    <div className={cn("relative w-full h-[60vh] min-h-[500px] max-h-[700px] overflow-hidden", className)}>
      {/* Background Image */}
      {backgroundImage && (
        <div 
          className="absolute inset-0 w-full h-full"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
      )}
      
      {/* Netflix-Style Perfect Gradient System - 7 couches pour un fondu invisible */}
      
      {/* Couche 1: Assombrissement supérieur pour la lisibilité du texte */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.75) 15%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0.4) 45%, rgba(0,0,0,0.2) 60%, transparent 75%)'
        }}
      />
      
      {/* Couche 2: Transition centrale douce */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, transparent 50%, rgba(0,0,0,0.15) 65%, rgba(0,0,0,0.35) 75%, rgba(0,0,0,0.6) 85%, rgba(0,0,0,0.85) 95%, rgba(0,0,0,0.95) 100%)'
        }}
      />
      
      {/* Couche 3: Transition principale vers le background - Ultra progressive */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-[70%] pointer-events-none"
        style={{
          background: `linear-gradient(to top, 
            hsl(var(--background)) 0%,
            hsl(var(--background) / 0.995) 8%,
            hsl(var(--background) / 0.985) 14%,
            hsl(var(--background) / 0.97) 20%,
            hsl(var(--background) / 0.945) 26%,
            hsl(var(--background) / 0.91) 32%,
            hsl(var(--background) / 0.865) 38%,
            hsl(var(--background) / 0.81) 44%,
            hsl(var(--background) / 0.745) 50%,
            hsl(var(--background) / 0.67) 56%,
            hsl(var(--background) / 0.585) 62%,
            hsl(var(--background) / 0.49) 68%,
            hsl(var(--background) / 0.39) 74%,
            hsl(var(--background) / 0.285) 80%,
            hsl(var(--background) / 0.18) 86%,
            hsl(var(--background) / 0.09) 92%,
            hsl(var(--background) / 0.03) 96%,
            transparent 100%
          )`
        }}
      />
      
      {/* Couche 4: Renforcement du bas - Garantit un fondu parfait */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-[45%] pointer-events-none"
        style={{
          background: `linear-gradient(to top, 
            hsl(var(--background)) 0%,
            hsl(var(--background) / 0.98) 12%,
            hsl(var(--background) / 0.93) 24%,
            hsl(var(--background) / 0.84) 36%,
            hsl(var(--background) / 0.71) 48%,
            hsl(var(--background) / 0.54) 60%,
            hsl(var(--background) / 0.35) 72%,
            hsl(var(--background) / 0.18) 84%,
            hsl(var(--background) / 0.05) 92%,
            transparent 100%
          )`
        }}
      />
      
      {/* Couche 5: Edge polish - Bord ultra lisse */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: `linear-gradient(to top, 
            hsl(var(--background)) 0%,
            hsl(var(--background) / 0.95) 20%,
            hsl(var(--background) / 0.80) 40%,
            hsl(var(--background) / 0.55) 60%,
            hsl(var(--background) / 0.25) 80%,
            transparent 100%
          )`
        }}
      />
      
      {/* Couche 6: Final seamless blend - Le secret Netflix */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
        style={{
          background: `linear-gradient(to top, 
            hsl(var(--background)) 0%,
            hsl(var(--background) / 0.92) 25%,
            hsl(var(--background) / 0.65) 50%,
            hsl(var(--background) / 0.30) 75%,
            transparent 100%
          )`
        }}
      />
      
      {/* Couche 7: Micro-polish imperceptible mais crucial */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
        style={{
          background: `linear-gradient(to top, 
            hsl(var(--background)) 0%,
            hsl(var(--background) / 0.75) 33%,
            hsl(var(--background) / 0.40) 66%,
            transparent 100%
          )`
        }}
      />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-end p-6 md:p-12 pb-20 md:pb-24">
        {/* Breadcrumbs */}
        <div className="absolute top-6 left-6 md:top-12 md:left-12 z-20">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#" className="flex items-center gap-1.5 text-white/90 hover:text-white transition-colors drop-shadow-lg">
                  <Home className="w-4 h-4" />
                  <span>Accueil</span>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="w-4 h-4 text-white/60" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage className="text-white font-medium drop-shadow-lg">NEXUS</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Hero Content - Bottom aligned like Netflix with perfect positioning */}
        <div className="space-y-4 max-w-3xl pb-4">
          <h1 className="font-display text-5xl md:text-7xl font-bold text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] leading-tight">
            {getGreeting()}{userName ? `, ${userName}` : ""}
          </h1>
          <p className="text-white/95 text-xl md:text-2xl font-medium drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] max-w-2xl">
            {trackCount !== undefined && trackCount > 0
              ? `${trackCount} ${trackCount === 1 ? "piste disponible" : "pistes disponibles"} dans votre bibliothèque`
              : "Votre système audio futuriste personnel. Découvrez, écoutez et explorez votre musique comme jamais auparavant."
            }
          </p>
          {featuredTrack && (
            <div className="pt-2">
              <p className="text-white/80 text-sm md:text-base drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                En vedette : <span className="font-semibold text-white">{featuredTrack.title}</span> par {featuredTrack.artist}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

