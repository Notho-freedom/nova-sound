import { Play, Music, Search, Library, Settings, Video, Download, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import type { Track } from "@/types/music";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface PageHeroProps {
  title: string;
  subtitle?: string;
  icon?: typeof Music;
  featuredTracks?: Track[];
  backgroundImage?: string;
  onTrackSelect?: (track: Track) => void;
  className?: string;
  variant?: "default" | "minimal" | "featured";
}

export const PageHero = ({
  title,
  subtitle,
  icon: Icon = Music,
  featuredTracks = [],
  backgroundImage,
  onTrackSelect,
  className,
  variant = "default",
}: PageHeroProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(featuredTracks.length > 0);

  // Auto-play slider for featured tracks
  useEffect(() => {
    if (!isAutoPlaying || featuredTracks.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredTracks.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, featuredTracks.length]);

  const currentTrack = featuredTracks[currentIndex];
  const bgImage = backgroundImage || (currentTrack?.coverUrl ? getCoverUrl(currentTrack.coverUrl) : undefined);

  // Minimal variant - smaller hero
  if (variant === "minimal") {
    return (
      <div className={cn("relative w-full h-48 md:h-64 overflow-hidden", className)}>
        {/* Background */}
        {bgImage && (
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              backgroundImage: `url(${bgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )}
        
        {/* Gradient overlays - Perfect fade system */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background via-background/80 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />

        {/* Content */}
        <div className="relative z-10 h-full flex items-end p-6 md:p-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl bg-primary/20 backdrop-blur-sm flex items-center justify-center border border-primary/30">
              <Icon className="w-6 h-6 md:w-8 md:h-8 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl md:text-4xl font-bold text-white drop-shadow-lg">
                {title}
              </h1>
              {subtitle && (
                <p className="text-white/80 text-sm md:text-base mt-1 drop-shadow">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default/Featured variant - Full hero
  return (
    <div className={cn("relative w-full h-[50vh] min-h-[400px] max-h-[600px] overflow-hidden group", className)}>
      {/* Background Images - Slider */}
      {featuredTracks.length > 0 && (
        <div className="absolute inset-0 w-full h-full">
          {featuredTracks.map((track, index) => {
            const coverUrl = track.coverUrl ? getCoverUrl(track.coverUrl) : undefined;
            if (!coverUrl) return null;
            
            return (
              <div
                key={track.id}
                className={cn(
                  "absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out",
                  index === currentIndex ? "opacity-100 z-0" : "opacity-0 z-[-1]"
                )}
                style={{
                  backgroundImage: `url(${coverUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }}
              />
            );
          })}
        </div>
      )}
      
      {/* Static background if no tracks */}
      {featuredTracks.length === 0 && bgImage && (
        <div
          className="absolute inset-0 w-full h-full"
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}

      {/* Netflix-Style Perfect Gradient System - 7 layers for invisible fade */}
      
      {/* Layer 1: Top darkening for text readability */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.75) 15%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0.4) 45%, rgba(0,0,0,0.2) 60%, transparent 75%)'
        }}
      />
      
      {/* Layer 2: Central smooth transition */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, transparent 50%, rgba(0,0,0,0.15) 65%, rgba(0,0,0,0.35) 75%, rgba(0,0,0,0.6) 85%, rgba(0,0,0,0.85) 95%, rgba(0,0,0,0.95) 100%)'
        }}
      />
      
      {/* Layer 3: Main transition to background - Ultra progressive */}
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
      
      {/* Layer 4: Bottom reinforcement - Guarantees perfect fade */}
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
      
      {/* Layer 5: Edge polish - Ultra smooth edge */}
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
      
      {/* Layer 6: Final seamless blend - The Netflix secret */}
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
      
      {/* Layer 7: Micro-polish - Imperceptible but crucial */}
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
      <div className="relative z-10 h-full flex flex-col justify-end p-6 md:p-12 pb-16 md:pb-20">
        <div className="flex items-end justify-between gap-8">
          <div className="space-y-4 max-w-3xl flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <h1 className="font-display text-4xl md:text-6xl font-bold text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] leading-tight animate-in fade-in slide-in-from-bottom-4 duration-700">
                {title}
              </h1>
            </div>
            {subtitle && (
              <p className="text-white/95 text-lg md:text-xl font-medium drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                {subtitle}
              </p>
            )}
            {currentTrack && featuredTracks.length > 0 && (
              <div className="pt-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
                <p className="text-white/80 text-sm md:text-base drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                  En vedette : <span className="font-semibold text-white">{currentTrack.title}</span> par {currentTrack.artist}
                </p>
              </div>
            )}
          </div>
          
          {/* Action Button */}
          {currentTrack && onTrackSelect && (
            <div className="flex-shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
              <Button
                onClick={() => onTrackSelect(currentTrack)}
                className="bg-white text-black hover:bg-white/90 font-semibold px-8 py-6 text-lg rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
              >
                <Play className="w-5 h-5 mr-2 fill-current" />
                Lire maintenant
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
