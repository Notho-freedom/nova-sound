"use client";

import { cn } from "@/lib/utils";

interface HeroGradientProps {
  className?: string;
  variant?: "default" | "intense" | "subtle";
}

/**
 * Netflix-style gradient system with multiple layers for perfect fade
 * Provides seamless transition from hero image to background
 */
export const HeroGradient = ({ className, variant = "default" }: HeroGradientProps) => {
  return (
    <>
      {/* Layer 1: Top darkening for text readability */}
      <div 
        className={cn("absolute inset-0 pointer-events-none", className)}
        style={{
          background: variant === "intense" 
            ? 'linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.8) 15%, rgba(0,0,0,0.65) 30%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0.25) 60%, transparent 75%)'
            : 'linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.6) 15%, rgba(0,0,0,0.45) 30%, rgba(0,0,0,0.3) 45%, rgba(0,0,0,0.15) 60%, transparent 75%)'
        }}
      />
      
      {/* Layer 2: Central smooth transition */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, transparent 45%, rgba(0,0,0,0.1) 60%, rgba(0,0,0,0.25) 72%, rgba(0,0,0,0.5) 84%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0.9) 100%)'
        }}
      />
      
      {/* Layer 3: Main transition to background - Ultra progressive */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-[65%] pointer-events-none"
        style={{
          background: `linear-gradient(to top, 
            hsl(var(--background)) 0%,
            hsl(var(--background) / 0.99) 6%,
            hsl(var(--background) / 0.97) 12%,
            hsl(var(--background) / 0.94) 18%,
            hsl(var(--background) / 0.89) 24%,
            hsl(var(--background) / 0.83) 30%,
            hsl(var(--background) / 0.75) 36%,
            hsl(var(--background) / 0.66) 42%,
            hsl(var(--background) / 0.55) 48%,
            hsl(var(--background) / 0.44) 54%,
            hsl(var(--background) / 0.33) 60%,
            hsl(var(--background) / 0.22) 68%,
            hsl(var(--background) / 0.12) 76%,
            hsl(var(--background) / 0.05) 86%,
            transparent 100%
          )`
        }}
      />
      
      {/* Layer 4: Bottom reinforcement */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-[40%] pointer-events-none"
        style={{
          background: `linear-gradient(to top, 
            hsl(var(--background)) 0%,
            hsl(var(--background) / 0.96) 15%,
            hsl(var(--background) / 0.85) 30%,
            hsl(var(--background) / 0.65) 50%,
            hsl(var(--background) / 0.40) 70%,
            hsl(var(--background) / 0.15) 85%,
            transparent 100%
          )`
        }}
      />
      
      {/* Layer 5: Edge polish */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
        style={{
          background: `linear-gradient(to top, 
            hsl(var(--background)) 0%,
            hsl(var(--background) / 0.9) 25%,
            hsl(var(--background) / 0.6) 50%,
            hsl(var(--background) / 0.25) 75%,
            transparent 100%
          )`
        }}
      />
      
      {/* Layer 6: Final seamless blend */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none"
        style={{
          background: `linear-gradient(to top, 
            hsl(var(--background)) 0%,
            hsl(var(--background) / 0.85) 30%,
            hsl(var(--background) / 0.5) 60%,
            transparent 100%
          )`
        }}
      />

      {/* Side vignettes for cinematic effect */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 120% 100% at 50% 0%, transparent 50%, rgba(0,0,0,0.15) 100%)'
        }}
      />
    </>
  );
};
