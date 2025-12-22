"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { ChevronLeft, ChevronRight, Play, Pause, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { motion, AnimatePresence } from "framer-motion";
import type { ArtistImage } from "@/types/artist-image";

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
    // Dimensions cibles: 1920x1080 (Full HD) ou plus pour un meilleur rendu
    const width = 1920; // Largeur optimale pour desktop
    const height = 1080; // Hauteur optimale (ratio 16:9)
    
    return { width, height };
  }, []);

  // Fonction pour récupérer une image améliorée depuis le service d'image
  const fetchEnhancedImage = useCallback(async (query: string): Promise<string | null> => {
    // Vérifier le cache d'abord
    if (imageCache.has(query)) {
      return imageCache.get(query) || null;
    }

    try {
      const { width, height } = getOptimalImageDimensions();
      // Recherche avec dimensions spécifiques et orientation landscape
      const params = new URLSearchParams({
        query: query,
        limit: '1',
        random: 'true',
        width: width.toString(),
        height: height.toString(),
        orientation: 'landscape', // Format paysage pour le hero
      });

      const response = await fetch(`/api/artist-images?${params.toString()}`);
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (data.image?.url) {
        const imageUrl = data.image.url;
        setImageCache(prev => new Map(prev).set(query, imageUrl));
        return imageUrl;
      }
    } catch (error) {
      console.warn(`[HeroCarousel] Erreur lors de la récupération d'image pour "${query}":`, error);
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

    enhanceSlides();
  }, [slides, fetchEnhancedImage]);

  useEffect(() => {
    if (!autoPlay || isPaused || enhancedSlides.length <= 1) return;

    const timer = setInterval(goToNext, interval);
    return () => clearInterval(timer);
  }, [autoPlay, isPaused, interval, goToNext, enhancedSlides.length]);

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
        "relative w-full h-[400px] md:h-[480px] lg:h-[520px] rounded-3xl overflow-hidden group",
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
              src={currentSlide.imageUrl}
              alt={currentSlide.title}
              className="absolute inset-0 w-full h-full object-cover transform scale-105 transition-transform duration-[8s] group-hover:scale-90"
              style={{
                minWidth: '100%',
                minHeight: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
              }}
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
      <div className="relative z-10 h-full flex flex-col justify-end p-8 md:p-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="max-w-2xl"
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
              className="font-display text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 text-foreground"
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
                className="text-lg text-muted-foreground mb-6 line-clamp-2"
              >
                {currentSlide.description}
              </motion.p>
            )}

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex items-center gap-4"
            >
              <Button
                size="lg"
                onClick={() => onPlay?.(currentSlide)}
                className="gap-2 px-8 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow"
              >
                <Play className="w-5 h-5 fill-current" />
                Lecture
              </Button>
              {onShuffle && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={onShuffle}
                  className="gap-2 bg-background/20 backdrop-blur-sm border-white/10 hover:bg-background/40"
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
              "absolute left-4 top-1/2 -translate-y-1/2 z-20",
              "w-12 h-12 rounded-full flex items-center justify-center",
              "bg-background/30 backdrop-blur-md border border-white/10",
              "opacity-0 group-hover:opacity-100 transition-all duration-300",
              "hover:bg-background/50 hover:scale-110",
              "focus:outline-none focus:ring-2 focus:ring-primary/50"
            )}
          >
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </button>
          <button
            onClick={goToNext}
            aria-label="Slide suivant"
            title="Slide suivant"
            className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2 z-20",
              "w-12 h-12 rounded-full flex items-center justify-center",
              "bg-background/30 backdrop-blur-md border border-white/10",
              "opacity-0 group-hover:opacity-100 transition-all duration-300",
              "hover:bg-background/50 hover:scale-110",
              "focus:outline-none focus:ring-2 focus:ring-primary/50"
            )}
          >
            <ChevronRight className="w-6 h-6 text-foreground" />
          </button>
        </>
      )}

      {/* Dots indicator */}
      {enhancedSlides.length > 1 && (
        <div className="absolute bottom-6 right-8 z-20 flex items-center gap-2">
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
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <motion.div
            key={currentIndex}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: interval / 1000, ease: "linear" }}
            className="h-full bg-gradient-to-r from-primary to-secondary"
          />
        </div>
      )}
    </div>
  );
});

HeroCarousel.displayName = "HeroCarousel";
