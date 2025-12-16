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
      
      {/* Gradient Overlay - Style Netflix avec fondu vers le bas */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/70 to-black/40" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent" />
      
      {/* Bottom fade to page background - Excellent fondu */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-background via-background/95 to-transparent pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-end p-6 md:p-12 pb-16">
        {/* Breadcrumbs */}
        <div className="absolute top-6 left-6 md:top-12 md:left-12">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#" className="flex items-center gap-1.5 text-white/90 hover:text-white transition-colors">
                  <Home className="w-4 h-4" />
                  <span>Accueil</span>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="w-4 h-4 text-white/60" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage className="text-white font-medium">NEXUS</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Hero Content - Bottom aligned like Netflix */}
        <div className="space-y-4 max-w-3xl">
          <h1 className="font-display text-5xl md:text-7xl font-bold text-white drop-shadow-2xl leading-tight">
            {getGreeting()}{userName ? `, ${userName}` : ""}
          </h1>
          <p className="text-white/90 text-xl md:text-2xl font-medium drop-shadow-lg max-w-2xl">
            {trackCount !== undefined && trackCount > 0
              ? `${trackCount} ${trackCount === 1 ? "piste disponible" : "pistes disponibles"} dans votre bibliothèque`
              : "Votre système audio futuriste personnel. Découvrez, écoutez et explorez votre musique comme jamais auparavant."
            }
          </p>
          {featuredTrack && (
            <div className="pt-2">
              <p className="text-white/70 text-sm md:text-base">
                En vedette : <span className="font-semibold text-white">{featuredTrack.title}</span> par {featuredTrack.artist}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

