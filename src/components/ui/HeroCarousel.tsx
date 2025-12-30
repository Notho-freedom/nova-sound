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
        "relative w-full h-[500px] md:h-[550px] lg:h-[600px] rounded-3xl overflow-hidden group mt-1",
        className
      )}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background with parallax effect */}
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.3 },
            scale: { duration: 0.3 },
          }}
          className="absolute inset-0"
        >
          {/* Image - Optimisée pour le format hero avec dimensions sur mesure */}
          <div className="absolute inset-0 overflow-hidden">
            <img
              ref={imageRef}
              src={currentSlide.imageUrl}
              alt={currentSlide.title}
              className="absolute inset-0 w-full h-full object-cover transform scale-105 transition-transform duration-[8s]"
              loading="eager"
              decoding="async"
              width={1920}
              height={1080}
              onError={(e) => {
                // Fallback si l'image ne charge pas
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                // Utiliser un background fallback
                const parent = target.parentElement;
                if (parent) {
                  parent.style.backgroundImage = `url(${currentSlide.imageUrl})`;
                  parent.style.backgroundSize = 'cover';
                  parent.style.backgroundPosition = 'center';
                }
              }}
            />
          </div>

          {/* Overlay gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />
          
          {/* Accent glow */}
          <div
            className={cn(
              "absolute -bottom-20 -left-20 w-96 h-96 rounded-full blur-[120px] opacity-40",
              currentSlide.gradient || "bg-gradient-to-r from-primary to-secondary"
            )}
          />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-end p-6 sm:p-8 md:p-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="w-full max-w-full md:max-w-2xl flex flex-col items-center md:items-start text-center md:text-left gap-2"
          >
            {/* Tag */}
            {currentSlide.subtitle && (
              <motion.span
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary border border-primary/30 mb-4"
              >
                {currentSlide.subtitle}
              </motion.span>
            )}

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 text-foreground truncate max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg"
              style={{
                textShadow: "0 4px 30px rgba(0,0,0,0.5)",
              }}
            >
              {currentSlide.title}
            </motion.h1>

            {/* Description */}
            {currentSlide.description && (
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-base md:text-lg text-muted-foreground mb-6 line-clamp-3 md:line-clamp-2"
              >
                {currentSlide.description}
              </motion.p>
            )}

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex items-center gap-3 md:gap-4 flex-wrap justify-center md:justify-start"
            >
              <Button
                size="lg"
                onClick={() => onPlay?.(currentSlide)}
                className="gap-2 px-8 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow w-full sm:w-auto"
              >
                <Play className="w-5 h-5 fill-current" />
                Lecture
              </Button>
              {onShuffle && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={onShuffle}
                  className="gap-2 bg-background/20 backdrop-blur-sm border-white/10 hover:bg-background/40 w-full sm:w-auto"
                >
                  <Shuffle className="w-4 h-4" />
                  Aléatoire
                </Button>
              )}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation arrows */}
      {enhancedSlides.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            aria-label="Slide précédent"
            title="Slide précédent"
            className={cn(
              "hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-20",
              "w-10 h-10 md:w-12 md:h-12 rounded-full items-center justify-center",
              "bg-background/30 backdrop-blur-md border border-white/10",
              "opacity-0 group-hover:opacity-100 transition-all duration-300",
              "hover:bg-background/50 hover:scale-110",
              "focus:outline-none focus:ring-2 focus:ring-primary/50"
            )}
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 text-foreground" />
          </button>
          <button
            onClick={goToNext}
            aria-label="Slide suivant"
            title="Slide suivant"
            className={cn(
              "hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-20",
              "w-10 h-10 md:w-12 md:h-12 rounded-full items-center justify-center",
              "bg-background/30 backdrop-blur-md border border-white/10",
              "opacity-0 group-hover:opacity-100 transition-all duration-300",
              "hover:bg-background/50 hover:scale-110",
              "focus:outline-none focus:ring-2 focus:ring-primary/50"
            )}
          >
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-foreground" />
          </button>
        </>
      )}

      {/* Dots indicator */}
      {enhancedSlides.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:right-8 md:translate-x-0 z-20 flex items-center gap-2">
          {enhancedSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              aria-label={`Aller au slide ${index + 1}`}
              title={`Slide ${index + 1}`}
              className={cn(
                "transition-all duration-300",
                index === currentIndex
                  ? "w-8 h-2 bg-primary rounded-full"
                  : "w-2 h-2 bg-white/30 rounded-full hover:bg-white/50"
              )}
            />
          ))}
        </div>
      )}

      {/* Progress bar */}
      {autoPlay && !isPaused && enhancedSlides.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/15 z-20">
          <motion.div
            key={currentIndex}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: interval / 1000, ease: "linear" }}
            className="h-full bg-gradient-to-r from-primary to-secondary shadow-[0_0_12px_rgba(0,0,0,0.25)]"
          />
        </div>
      )}
    </div>
  );
});

HeroCarousel.displayName = "HeroCarousel";
