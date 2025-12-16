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
      
      {/* Multiple gradient layers for perfect fade - Style Netflix perfection */}
      {/* Layer 1: Top dark overlay for text readability */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.8) 20%, rgba(0, 0, 0, 0.6) 40%, rgba(0, 0, 0, 0.3) 60%, transparent 85%)'
        }}
      />
      
      {/* Layer 2: Middle transition layer */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, transparent 0%, transparent 55%, rgba(0, 0, 0, 0.2) 70%, rgba(0, 0, 0, 0.5) 82%, rgba(0, 0, 0, 0.75) 92%, rgba(0, 0, 0, 0.9) 97%, rgba(0, 0, 0, 0.98) 100%)'
        }}
      />
      
      {/* Layer 3: Perfect fade to page background - Main transition layer */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-[65%] pointer-events-none"
        style={{
          background: `linear-gradient(to top, 
            hsl(var(--background)) 0%,
            hsl(var(--background)) 12%,
            hsl(var(--background) / 0.99) 18%,
            hsl(var(--background) / 0.97) 24%,
            hsl(var(--background) / 0.94) 30%,
            hsl(var(--background) / 0.90) 36%,
            hsl(var(--background) / 0.84) 42%,
            hsl(var(--background) / 0.76) 48%,
            hsl(var(--background) / 0.66) 54%,
            hsl(var(--background) / 0.54) 60%,
            hsl(var(--background) / 0.42) 66%,
            hsl(var(--background) / 0.30) 72%,
            hsl(var(--background) / 0.20) 78%,
            hsl(var(--background) / 0.12) 84%,
            hsl(var(--background) / 0.06) 90%,
            hsl(var(--background) / 0.02) 95%,
            transparent 100%
          )`
        }}
      />
      
      {/* Layer 4: Ultra-smooth bottom edge transition */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
        style={{
          background: `linear-gradient(to top, 
            hsl(var(--background)) 0%,
            hsl(var(--background) / 0.96) 15%,
            hsl(var(--background) / 0.88) 30%,
            hsl(var(--background) / 0.75) 45%,
            hsl(var(--background) / 0.58) 60%,
            hsl(var(--background) / 0.40) 75%,
            hsl(var(--background) / 0.22) 87%,
            hsl(var(--background) / 0.10) 94%,
            transparent 100%
          )`
        }}
      />
      
      {/* Layer 5: Final polish - seamless edge blend */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
        style={{
          background: `linear-gradient(to top, 
            hsl(var(--background)) 0%,
            hsl(var(--background) / 0.85) 25%,
            hsl(var(--background) / 0.50) 50%,
            hsl(var(--background) / 0.20) 75%,
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

