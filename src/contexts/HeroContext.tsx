"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";

export type HeroVariant = "home" | "library" | "search" | "settings" | "media" | "notifications";

interface HeroContextType {
  // Visibility state
  isHeroVisible: boolean;
  setIsHeroVisible: (visible: boolean) => void;
  
  // Hero ref for intersection observer
  heroRef: React.RefObject<HTMLDivElement>;
  
  // Current variant
  heroVariant: HeroVariant;
  setHeroVariant: (variant: HeroVariant) => void;
  
  // Register hero visibility observer
  registerHeroObserver: () => (() => void) | undefined;
}

const HeroContext = createContext<HeroContextType | undefined>(undefined);

interface HeroProviderProps {
  children: React.ReactNode;
}

export const HeroProvider = ({ children }: HeroProviderProps) => {
  const [isHeroVisible, setIsHeroVisible] = useState(true);
  const [heroVariant, setHeroVariant] = useState<HeroVariant>("home");
  const heroRef = useRef<HTMLDivElement>(null);

  // Register intersection observer for hero visibility
  const registerHeroObserver = useCallback(() => {
    if (!heroRef.current) {
      // If no hero ref, assume hero is not visible (show TitleBar v1)
      setIsHeroVisible(false);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        
        // Hero is visible when at least 15% is in viewport
        const isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.15;
        setIsHeroVisible(isVisible);
      },
      {
        threshold: [0, 0.1, 0.15, 0.2, 0.3, 0.5, 1.0],
        rootMargin: '-5% 0px -5% 0px',
      }
    );

    observer.observe(heroRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <HeroContext.Provider
      value={{
        isHeroVisible,
        setIsHeroVisible,
        heroRef,
        heroVariant,
        setHeroVariant,
        registerHeroObserver,
      }}
    >
      {children}
    </HeroContext.Provider>
  );
};

export const useHero = (): HeroContextType => {
  const context = useContext(HeroContext);
  if (!context) {
    throw new Error("useHero must be used within a HeroProvider");
  }
  return context;
};

// Hook for components that want to use hero without throwing
export const useHeroOptional = (): HeroContextType | null => {
  return useContext(HeroContext) ?? null;
};
