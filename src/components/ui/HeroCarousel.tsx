"use client";

import { useState, useEffect, useCallback, memo, useRef } from "react";
import { ChevronLeft, ChevronRight, Play, Pause, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { motion, AnimatePresence } from "framer-motion";
import type { ArtistImage } from "@/types/artist-image";
import { getArtistImageProvider } from "@/services/artist-image-provider";

interface CarouselSlide {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl: string;
  gradient?: string;
  accentColor?: string;
}

interface HeroCarouselProps {
  slides: CarouselSlide[];
  autoPlay?: boolean;
  interval?: number;
  onSlideClick?: (slide: CarouselSlide) => void;
  onPlay?: (slide: CarouselSlide) => void;
  onShuffle?: () => void;
  className?: string;
}

export const HeroCarousel = memo(({
  slides,
  autoPlay = true,
  interval = 6000,
  onSlideClick,
  onPlay,
  onShuffle,
  className,
}: HeroCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [direction, setDirection] = useState(0);
  const [enhancedSlides, setEnhancedSlides] = useState<CarouselSlide[]>(slides);
  const [imageCache, setImageCache] = useState<Map<string, string>>(new Map());
  const imageRef = useRef<HTMLImageElement>(null);
  const goToNext = useCallback(() => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % enhancedSlides.length);
  }, [enhancedSlides.length]);

  const goToPrevious = useCallback(() => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + enhancedSlides.length) % enhancedSlides.length);
  }, [enhancedSlides.length]);

  const goToSlide = useCallback((index: number) => {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  }, [currentIndex]);

  // Dimensions optimales pour le HeroCarousel
  // Hauteur: 400px (mobile), 480px (md), 520px (lg)
  // Largeur: pleine largeur (généralement 1920px+ pour desktop)
  // Ratio: ~16:9 ou landscape pour un meilleur rendu
  const getOptimalImageDimensions = useCallback(() => {
    // Pour un carousel hero, on veut des images larges en format paysage
    const image = imageRef.current;
    if (!image) return { width: 0, height: 0 };
    const width = image.width;
    const height = image.height;
    
    return { width, height };
  }, []);

  // Fonction pour récupérer une image améliorée depuis le service d'image
  // Utilise requestIdleCallback pour ne pas bloquer l'UI
  const fetchEnhancedImage = useCallback(async (query: string): Promise<string | null> => {
    // Vérifier le cache d'abord
    if (imageCache.has(query)) {
      return imageCache.get(query) || null;
    }

    // Attendre un moment d'inactivité pour ne pas bloquer l'UI
    await new Promise<void>((resolve) => {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => resolve(), { timeout: 2000 });
      } else {
        setTimeout(resolve, 100);
      }
    });

    try {
      const { width, height } = getOptimalImageDimensions();
      // Améliorer la requête avec le contexte "artiste/musicien" pour des résultats plus pertinents
      const enhancedQuery = `${query} musician artist singer performer portrait`;
      // Recherche avec dimensions spécifiques et orientation landscape
      const params = new URLSearchParams({
        query: enhancedQuery,
        limit: '5', // Récupérer plus de résultats pour trouver une meilleure image
        random: 'true',
        width: width.toString(),
        height: height.toString(),
        orientation: 'landscape', // Format paysage pour le hero
      });

      const response = await fetch(`/api/artist-images?${params.toString()}`);
      
      // Check if API is available
      if (response.ok) {
        const data = await response.json();
        if (data.image?.url) {
          const imageUrl = data.image.url;
          setImageCache(prev => new Map(prev).set(query, imageUrl));
          return imageUrl;
        }
      }
      
      // If API returns 503 (server not available) or 404, use fallback
      if (response.status === 503 || response.status === 404 || !response.ok) {
        console.info('[HeroCarousel] API not available, using direct provider fallback');
        const provider = getArtistImageProvider();
        const image = await provider.getRandomImage(query);
        if (image?.url) {
          setImageCache(prev => new Map(prev).set(query, image.url));
          return image.url;
        }
      }
    } catch (error) {
      // Network error - API server not running, use fallback
      console.info('[HeroCarousel] Network error, using direct provider fallback:', error);
      try {
        const provider = getArtistImageProvider();
        const image = await provider.getRandomImage(query);
        if (image?.url) {
          setImageCache(prev => new Map(prev).set(query, image.url));
          return image.url;
        }
      } catch (fallbackError) {
        console.warn(`[HeroCarousel] Fallback also failed for "${query}":`, fallbackError);
      }
    }

    return null;
  }, [imageCache, getOptimalImageDimensions]);

  // Enrichir les slides avec de meilleures images
  useEffect(() => {
    const enhanceSlides = async () => {
      const updatedSlides = await Promise.all(
        slides.map(async (slide) => {
          // Si l'image actuelle est une image par défaut ou manquante, essayer d'en trouver une meilleure
          const isDefaultImage = !slide.imageUrl || 
            slide.imageUrl.includes('placeholder') || 
            slide.imageUrl.includes('default') ||
            slide.imageUrl === '/placeholder.svg';

          if (isDefaultImage && slide.title) {
            // Essayer de trouver une image basée sur le titre (artiste, album, etc.)
            const enhancedImage = await fetchEnhancedImage(slide.title);
            if (enhancedImage) {
              return { ...slide, imageUrl: enhancedImage };
            }
          }

          // Si c'est un slide d'artiste, essayer d'améliorer l'image
          if (slide.subtitle?.includes('Artiste') && slide.title) {
            const enhancedImage = await fetchEnhancedImage(slide.title);
            if (enhancedImage) {
              return { ...slide, imageUrl: enhancedImage };
            }
          }

          return slide;
        })
      );

      setEnhancedSlides(updatedSlides);
    };

    //enhanceSlides();
  }, [slides, fetchEnhancedImage]);

  useEffect(() => {
    if (!autoPlay || isPaused || enhancedSlides.length <= 1) return;

    const timer = setInterval(goToNext, interval);
    return () => clearInterval(timer);
  }, [autoPlay, isPaused, interval, goToNext, enhancedSlides.length]);

  // Preload next slide image for smooth transitions
  useEffect(() => {
    if (enhancedSlides.length <= 1) return;
    const nextIndex = (currentIndex + 1) % enhancedSlides.length;
    const nextSlide = enhancedSlides[nextIndex];
    if (!nextSlide?.imageUrl) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = nextSlide.imageUrl;
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, [currentIndex, enhancedSlides]);

  if (enhancedSlides.length === 0) return null;

  const currentSlide = enhancedSlides[currentIndex];

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.95,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.95,
    }),
  };

  return (
    <div
      className={cn(
        // Pure Vision Pro immersive hero carousel
        "relative w-full h-[480px] md:h-[540px] lg:h-[580px] rounded-[2rem] overflow-hidden group mt-1",
        "bg-[hsl(var(--glass-panel))] backdrop-blur-sm",
        "border border-border/30",
        "shadow-[0_32px_100px_-24px_rgba(0,0,0,0.4)]",
        className
      )}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background with cinematic effect */}
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 200, damping: 30 },
            opacity: { duration: 0.4 },
            scale: { duration: 0.4 },
          }}
          className="absolute inset-0"
        >
          {/* Image with Ken Burns effect */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.img
              ref={imageRef}
              src={currentSlide.imageUrl}
              alt={currentSlide.title}
              className="absolute inset-0 w-full h-full object-cover"
              initial={{ scale: 1 }}
              animate={{ scale: 1.08 }}
              transition={{ duration: 10, ease: "linear" }}
              loading="eager"
              decoding="async"
              width={1920}
              height={1080}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.style.backgroundImage = `url(${currentSlide.imageUrl})`;
                  parent.style.backgroundSize = 'cover';
                  parent.style.backgroundPosition = 'center';
                }
              }}
            />
          </div>

          {/* Cinematic gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />
          
          {/* Vignette effect */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, rgba(0,0,0,0.4) 100%)'
            }}
          />
          
          {/* Accent glow from primary color */}
          <div
            className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full blur-[150px] opacity-50"
            style={{
              background: `radial-gradient(circle, hsl(var(--primary) / 0.5) 0%, transparent 70%)`
            }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-end p-8 md:p-12 lg:p-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-full md:max-w-2xl flex flex-col items-center md:items-start text-center md:text-left gap-3"
          >
            {/* Tag badge - Vision Pro style */}
            {currentSlide.subtitle && (
              <motion.span
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  "inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold",
                  "bg-[hsl(var(--glass-bg))] backdrop-blur-xl",
                  "border border-border/50",
                  "text-foreground/90",
                  "shadow-lg",
                  "mb-4"
                )}
              >
                {currentSlide.subtitle}
              </motion.span>
            )}

            {/* Title with text shadow */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className={cn(
                "font-semibold tracking-tight text-white",
                "text-3xl sm:text-4xl md:text-5xl lg:text-6xl",
                "line-clamp-2 max-w-xs sm:max-w-sm md:max-w-lg lg:max-w-xl",
                "mb-2"
              )}
              style={{
                textShadow: "0 4px 40px rgba(0,0,0,0.8)",
              }}
            >
              {currentSlide.title}
            </motion.h1>

            {/* Description */}
            {currentSlide.description && (
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="text-base md:text-lg text-white/60 mb-6 line-clamp-2"
              >
                {currentSlide.description}
              </motion.p>
            )}

            {/* Actions - Vision Pro buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="flex items-center gap-4 flex-wrap justify-center md:justify-start"
            >
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onPlay?.(currentSlide)}
                className={cn(
                  "flex items-center gap-2.5 px-8 py-3.5 rounded-full",
                  "bg-primary text-primary-foreground font-semibold text-sm",
                  "shadow-xl shadow-primary/25",
                  "hover:shadow-2xl hover:shadow-primary/30",
                  "transition-shadow duration-300"
                )}
              >
                <Play className="w-5 h-5 fill-current" />
                Lecture
              </motion.button>
              {onShuffle && (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onShuffle}
                  className={cn(
                    "flex items-center gap-2.5 px-6 py-3.5 rounded-full",
                    "bg-[hsl(var(--glass-bg))] backdrop-blur-xl text-foreground font-medium text-sm",
                    "border border-border/50",
                    "hover:bg-[hsl(var(--glass-bg-hover))]",
                    "transition-colors duration-300"
                  )}
                >
                  <Shuffle className="w-4 h-4" />
                  Aléatoire
                </motion.button>
              )}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation arrows - Floating glass buttons */}
      {enhancedSlides.length > 1 && (
        <>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={goToPrevious}
            aria-label="Slide précédent"
            className={cn(
              "hidden sm:flex absolute left-6 top-1/2 -translate-y-1/2 z-20",
              "w-12 h-12 rounded-full items-center justify-center",
              "bg-[hsl(var(--glass-panel))] backdrop-blur-2xl",
              "border border-border/50",
              "opacity-0 group-hover:opacity-100",
              "transition-opacity duration-300",
              "hover:bg-[hsl(var(--glass-bg-hover))]"
            )}
          >
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={goToNext}
            aria-label="Slide suivant"
            className={cn(
              "hidden sm:flex absolute right-6 top-1/2 -translate-y-1/2 z-20",
              "w-12 h-12 rounded-full items-center justify-center",
              "bg-[hsl(var(--glass-panel))] backdrop-blur-2xl",
              "border border-border/50",
              "opacity-0 group-hover:opacity-100",
              "transition-opacity duration-300",
              "hover:bg-[hsl(var(--glass-bg-hover))]"
            )}
          >
            <ChevronRight className="w-6 h-6 text-foreground" />
          </motion.button>
        </>
      )}

      {/* Progress bar - Subtle line with glow */}
      {autoPlay && !isPaused && enhancedSlides.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-muted/30 z-20">
          <motion.div
            key={currentIndex}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: interval / 1000, ease: "linear" }}
            className="h-full bg-primary"
            style={{ boxShadow: '0 0 12px hsl(var(--primary) / 0.6)' }}
          />
        </div>
      )}

    </div>
  );
});

HeroCarousel.displayName = "HeroCarousel";
