"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { ChevronLeft, ChevronRight, Play, Pause, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { motion, AnimatePresence } from "framer-motion";

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

  const goToNext = useCallback(() => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const goToPrevious = useCallback(() => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  const goToSlide = useCallback((index: number) => {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  }, [currentIndex]);

  useEffect(() => {
    if (!autoPlay || isPaused || slides.length <= 1) return;

    const timer = setInterval(goToNext, interval);
    return () => clearInterval(timer);
  }, [autoPlay, isPaused, interval, goToNext, slides.length]);

  if (slides.length === 0) return null;

  const currentSlide = slides[currentIndex];

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
          {/* Image */}
          <div
            className="absolute inset-0 bg-cover bg-center transform scale-105 transition-transform duration-[8s] group-hover:scale-110"
            style={{ backgroundImage: `url(${currentSlide.imageUrl})` }}
          />

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
      {slides.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
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
      {slides.length > 1 && (
        <div className="absolute bottom-6 right-8 z-20 flex items-center gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
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
      {autoPlay && !isPaused && slides.length > 1 && (
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
