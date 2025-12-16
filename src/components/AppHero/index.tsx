"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Music, Search, Library, Settings, Video, Download, Disc3, Clock, Heart, ListMusic } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import { useHero, type HeroVariant } from "@/contexts/HeroContext";
import { HeroBackground } from "./HeroBackground";
import { HeroGradient } from "./HeroGradient";
import { HeroControls } from "./HeroControls";
import { HeroContent } from "./HeroContent";
import { HeroCarousel } from "./HeroCarousel";
import { HeroStats, formatDurationStat } from "./HeroStats";
import { HeroSearch } from "./HeroSearch";
import type { Track } from "@/types/music";
import type { LucideIcon } from "lucide-react";

// Re-export sub-components
export { HeroBackground } from "./HeroBackground";
export { HeroGradient } from "./HeroGradient";
export { HeroControls } from "./HeroControls";
export { HeroContent } from "./HeroContent";
export { HeroCarousel } from "./HeroCarousel";
export { HeroStats, formatDurationStat } from "./HeroStats";
export { HeroSearch } from "./HeroSearch";

export interface AppHeroProps {
  /** Hero variant determines layout and features */
  variant: HeroVariant;
  /** Page title */
  title: string;
  /** Subtitle or description */
  subtitle?: string;
  /** Custom icon */
  icon?: LucideIcon;
  /** Featured tracks for carousel/background */
  featuredTracks?: Track[];
  /** Track selection callback */
  onTrackSelect?: (track: Track) => void;
  /** Settings button callback */
  onOpenSettings?: () => void;
  /** Toggle notifications callback */
  onToggleNotifications?: () => void;
  /** Has unread notifications */
  hasNotifications?: boolean;
  /** Upload progress (0-100) */
  uploadProgress?: number;
  /** Search value (for search variant) */
  searchValue?: string;
  /** Search change callback (for search variant) */
  onSearchChange?: (value: string) => void;
  /** Search submit callback (for search variant) */
  onSearchSubmit?: (value: string) => void;
  /** Stats to display (for library variant) */
  stats?: { albums?: number; tracks?: number; duration?: number; artists?: number };
  /** User name (for home variant greeting) */
  userName?: string;
  /** Additional class names */
  className?: string;
  /** Enable particle effects */
  enableParticles?: boolean;
  /** Enable parallax effect */
  enableParallax?: boolean;
}

/**
 * Unified AppHero component
 * Replaces HeroBreadcrumbs, PageHero, and TitleBar2 with a single intelligent component
 * Automatically manages TitleBar v1/v2 switching through HeroContext
 */
export const AppHero = ({
  variant,
  title,
  subtitle,
  icon,
  featuredTracks = [],
  onTrackSelect,
  onOpenSettings,
  onToggleNotifications,
  hasNotifications = false,
  uploadProgress,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  stats,
  userName,
  className,
  enableParticles = false,
  enableParallax = false,
}: AppHeroProps) => {
  const { heroRef, setHeroVariant, registerHeroObserver } = useHero();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(featuredTracks.length > 0);

  // Update hero variant in context
  useEffect(() => {
    setHeroVariant(variant);
  }, [variant, setHeroVariant]);

  // Register intersection observer for visibility tracking
  useEffect(() => {
    const cleanup = registerHeroObserver();
    return () => cleanup?.();
  }, [registerHeroObserver]);

  // Auto-play carousel
  useEffect(() => {
    if (!isAutoPlaying || featuredTracks.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredTracks.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, featuredTracks.length]);

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bonjour";
    if (hour < 18) return "Bon après-midi";
    return "Bonsoir";
  };

  // Get default icon based on variant
  const getDefaultIcon = (): LucideIcon => {
    switch (variant) {
      case "home": return Music;
      case "library": return Library;
      case "search": return Search;
      case "settings": return Settings;
      case "media": return Video;
      case "notifications": return Music;
      default: return Music;
    }
  };

  const Icon = icon || getDefaultIcon();
  const currentTrack = featuredTracks[currentIndex];

  // Build stats array for library variant
  const buildStats = () => {
    if (!stats) return undefined;
    const statArray = [];
    
    if (stats.tracks !== undefined) {
      statArray.push({ label: "titres", value: stats.tracks, icon: Music });
    }
    if (stats.albums !== undefined) {
      statArray.push({ label: "albums", value: stats.albums, icon: Disc3 });
    }
    if (stats.artists !== undefined) {
      statArray.push({ label: "artistes", value: stats.artists, icon: Music });
    }
    if (stats.duration !== undefined) {
      const formatted = formatDurationStat(stats.duration);
      statArray.push({ label: formatted.label || "de musique", value: formatted.value, suffix: formatted.suffix, icon: Clock });
    }
    
    return statArray;
  };

  // Variant-specific heights
  const heightClasses = {
    home: "h-[65vh] min-h-[550px] max-h-[750px]",
    library: "h-[50vh] min-h-[400px] max-h-[600px]",
    search: "h-[45vh] min-h-[350px] max-h-[500px]",
    settings: "h-[35vh] min-h-[280px] max-h-[400px]",
    media: "h-[45vh] min-h-[350px] max-h-[550px]",
    notifications: "h-[35vh] min-h-[280px] max-h-[400px]",
  }[variant];

  // Variant-specific content size
  const contentSize = {
    home: "large" as const,
    library: "default" as const,
    search: "default" as const,
    settings: "compact" as const,
    media: "default" as const,
    notifications: "compact" as const,
  }[variant];

  return (
    <div 
      ref={heroRef}
      className={cn(
        "relative w-full overflow-hidden group",
        heightClasses,
        className
      )}
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Background Layer */}
      <HeroBackground
        featuredTracks={featuredTracks}
        currentIndex={currentIndex}
        enableParticles={enableParticles || variant === "home"}
        enableParallax={enableParallax}
        blur={variant === "search" ? "sm" : "none"}
      />

      {/* Gradient Overlay */}
      <HeroGradient variant={variant === "home" ? "intense" : "default"} />

      {/* Hero Controls (TitleBar2 functionality) */}
      <div 
        className="absolute top-4 right-4 md:top-6 md:right-8 z-30"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <HeroControls
          onOpenSettings={onOpenSettings}
          onToggleNotifications={onToggleNotifications}
          hasNotifications={hasNotifications}
          uploadProgress={uploadProgress}
          variant="glass"
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 h-full flex flex-col">
        {/* Home Variant - Full featured with greeting and carousel */}
        {variant === "home" && (
          <>
            <HeroContent
              title={title}
              subtitle={subtitle}
              icon={Icon}
              greeting={getGreeting()}
              userName={userName}
              currentTrack={currentTrack}
              onActionClick={currentTrack && onTrackSelect ? () => onTrackSelect(currentTrack) : undefined}
              actionLabel="Lire maintenant"
              size="large"
              className="flex-1"
            />
            
            {/* Featured Tracks Carousel */}
            {featuredTracks.length > 0 && (
              <div className="px-6 md:px-10 pb-6 md:pb-10" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                <HeroCarousel
                  tracks={featuredTracks}
                  currentIndex={currentIndex}
                  onIndexChange={setCurrentIndex}
                  onTrackSelect={onTrackSelect}
                  showDots={true}
                  showArrows={true}
                />
              </div>
            )}
          </>
        )}

        {/* Library Variant - With stats */}
        {variant === "library" && (
          <HeroContent
            title={title}
            subtitle={subtitle}
            icon={Icon}
            stats={buildStats()}
            currentTrack={currentTrack}
            onActionClick={currentTrack && onTrackSelect ? () => onTrackSelect(currentTrack) : undefined}
            actionLabel="Lecture aléatoire"
            size="default"
            className="flex-1"
          />
        )}

        {/* Search Variant - With integrated search bar */}
        {variant === "search" && (
          <div className="flex-1 flex flex-col justify-center items-center p-6 md:p-10">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/25 animate-in fade-in zoom-in-95 duration-500">
                <Search className="w-8 h-8 text-white" />
              </div>
              <h1 className="font-display text-3xl md:text-4xl font-bold text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] animate-in fade-in slide-in-from-bottom-4 duration-700">
                {title}
              </h1>
              {subtitle && (
                <p className="text-white/80 mt-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                  {subtitle}
                </p>
              )}
            </div>
            
            <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
              <HeroSearch
                value={searchValue}
                onChange={onSearchChange}
                onSubmit={onSearchSubmit}
                placeholder="Rechercher des titres, artistes, albums..."
                enableVoice={true}
                size="lg"
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Settings Variant - Minimal */}
        {variant === "settings" && (
          <HeroContent
            title={title}
            subtitle={subtitle}
            icon={Icon}
            size="compact"
            className="flex-1"
          />
        )}

        {/* Media Variant - For Videos/Downloads */}
        {variant === "media" && (
          <HeroContent
            title={title}
            subtitle={subtitle}
            icon={Icon}
            stats={buildStats()}
            size="default"
            className="flex-1"
          />
        )}

        {/* Notifications Variant - Minimal */}
        {variant === "notifications" && (
          <HeroContent
            title={title}
            subtitle={subtitle}
            icon={Icon}
            size="compact"
            className="flex-1"
          />
        )}
      </div>

      {/* Bottom fade for seamless transition */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-4 pointer-events-none"
        style={{
          background: `linear-gradient(to top, hsl(var(--background)) 0%, transparent 100%)`
        }}
      />
    </div>
  );
};

export default AppHero;
