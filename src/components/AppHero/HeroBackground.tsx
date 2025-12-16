"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import type { Track } from "@/types/music";

interface HeroBackgroundProps {
  /** Featured tracks for carousel background */
  featuredTracks?: Track[];
  /** Static background image URL */
  backgroundImage?: string;
  /** Current carousel index (controlled) */
  currentIndex?: number;
  /** Enable particle effects */
  enableParticles?: boolean;
  /** Enable parallax effect on scroll */
  enableParallax?: boolean;
  /** Blur amount for background */
  blur?: "none" | "sm" | "md" | "lg";
  /** Additional class names */
  className?: string;
}

/**
 * Hero background component with carousel, parallax, and particle effects
 * Inspired by Steam, Spotify, and Apple Music
 */
export const HeroBackground = ({
  featuredTracks = [],
  backgroundImage,
  currentIndex = 0,
  enableParticles = false,
  enableParallax = false,
  blur = "none",
  className,
}: HeroBackgroundProps) => {
  const [parallaxOffset, setParallaxOffset] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Parallax scroll effect
  useEffect(() => {
    if (!enableParallax) return;

    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      setParallaxOffset(scrollY * 0.4); // 40% parallax speed
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [enableParallax]);

  // Preload images
  useEffect(() => {
    const images = featuredTracks
      .map(t => t.coverUrl ? getCoverUrl(t.coverUrl) : null)
      .filter(Boolean) as string[];
    
    if (images.length === 0 && !backgroundImage) {
      setIsLoaded(true);
      return;
    }

    let loadedCount = 0;
    const totalImages = images.length || (backgroundImage ? 1 : 0);

    const onLoad = () => {
      loadedCount++;
      if (loadedCount >= totalImages) {
        setIsLoaded(true);
      }
    };

    if (backgroundImage) {
      const img = new Image();
      img.onload = onLoad;
      img.src = backgroundImage;
    }

    images.forEach(src => {
      const img = new Image();
      img.onload = onLoad;
      img.src = src;
    });

    // Fallback timeout
    const timeout = setTimeout(() => setIsLoaded(true), 3000);
    return () => clearTimeout(timeout);
  }, [featuredTracks, backgroundImage]);

  const blurClass = {
    none: "",
    sm: "blur-sm",
    md: "blur-md",
    lg: "blur-lg",
  }[blur];

  const currentTrack = featuredTracks[currentIndex];
  const bgImage = backgroundImage || (currentTrack?.coverUrl ? getCoverUrl(currentTrack.coverUrl) : undefined);

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      {/* Carousel backgrounds */}
      {featuredTracks.length > 0 ? (
        <div className="absolute inset-0 w-full h-full">
          {featuredTracks.map((track, index) => {
            const coverUrl = track.coverUrl ? getCoverUrl(track.coverUrl) : undefined;
            if (!coverUrl) return null;
            
            return (
              <div
                key={track.id}
                className={cn(
                  "absolute inset-0 w-full h-full transition-all duration-1000 ease-in-out",
                  blurClass,
                  index === currentIndex 
                    ? "opacity-100 scale-100 z-0" 
                    : "opacity-0 scale-105 z-[-1]"
                )}
                style={{
                  backgroundImage: `url(${coverUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  transform: enableParallax 
                    ? `translateY(${parallaxOffset}px) scale(${index === currentIndex ? 1.05 : 1.1})` 
                    : undefined,
                }}
              />
            );
          })}
        </div>
      ) : bgImage && (
        <div
          className={cn(
            "absolute inset-0 w-full h-full transition-opacity duration-700",
            blurClass,
            isLoaded ? "opacity-100" : "opacity-0"
          )}
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            transform: enableParallax ? `translateY(${parallaxOffset}px) scale(1.05)` : undefined,
          }}
        />
      )}

      {/* Fallback gradient background */}
      {!bgImage && featuredTracks.length === 0 && (
        <div 
          className="absolute inset-0 w-full h-full"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--primary) / 0.15) 0%, hsl(var(--background)) 50%, hsl(var(--secondary) / 0.1) 100%)'
          }}
        />
      )}

      {/* Particle effects (Steam-like) */}
      {enableParticles && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-white/20 animate-particle-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 20}s`,
                animationDuration: `${15 + Math.random() * 15}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Noise texture overlay for depth */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.015] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
};
