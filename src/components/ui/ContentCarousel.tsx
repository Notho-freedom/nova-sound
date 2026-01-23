"use client";

import { useRef, useState, useCallback, memo, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ContentCarouselProps {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  showArrows?: boolean;
  showCount?: number;
  className?: string;
  itemClassName?: string;
  gap?: number;
  action?: ReactNode;
}

export const ContentCarousel = memo(({
  title,
  subtitle,
  icon,
  children,
  showArrows = true,
  className,
  gap = 16,
  action,
}: ContentCarouselProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollability = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
  }, []);

  const scroll = useCallback((direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  }, []);

  return (
    <div className={cn("relative w-full min-w-0 overflow-hidden", className)} style={{ contain: 'inline-size' }}>
      {/* Header */}
      {(title || subtitle || action) && (
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/10 flex items-center justify-center">
                {icon}
              </div>
            )}
            <div>
              {title && (
                <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {action}
            {showArrows && (
              <div className="hidden md:flex items-center gap-1">
                <button
                  onClick={() => scroll("left")}
                  disabled={!canScrollLeft}
                  className={cn(
                    // Vision Pro glass navigation button
                    "w-9 h-9 rounded-full flex items-center justify-center",
                    "bg-white/[0.06] backdrop-blur-xl",
                    "border border-white/[0.08] hover:border-white/[0.15]",
                    "hover:bg-white/[0.1] transition-all duration-200",
                    "disabled:opacity-30 disabled:cursor-not-allowed"
                  )}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => scroll("right")}
                  disabled={!canScrollRight}
                  className={cn(
                    // Vision Pro glass navigation button
                    "w-9 h-9 rounded-full flex items-center justify-center",
                    "bg-white/[0.06] backdrop-blur-xl",
                    "border border-white/[0.08] hover:border-white/[0.15]",
                    "hover:bg-white/[0.1] transition-all duration-200",
                    "disabled:opacity-30 disabled:cursor-not-allowed"
                  )}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Carousel container */}
      <div className="relative group/carousel min-w-0 max-w-full">
        {/* Left fade */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none",
            "bg-gradient-to-r from-background to-transparent",
            "transition-opacity duration-300",
            canScrollLeft ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Right fade */}
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none",
            "bg-gradient-to-l from-background to-transparent",
            "transition-opacity duration-300",
            canScrollRight ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Scroll container */}
        <div
          ref={scrollRef}
          onScroll={checkScrollability}
          className="flex overflow-x-auto overflow-y-hidden scrollbar-hide pb-4 -mb-4 scroll-smooth snap-x snap-mandatory w-full"
          style={{ gap: `${gap}px` }}
        >
          {children}
          {/* Spacer to ensure right padding in scroll */}
          <div className="flex-shrink-0 w-px" aria-hidden="true" />
        </div>

        {/* Mobile navigation arrows */}
        {showArrows && (
          <>
            <button
              onClick={() => scroll("left")}
              className={cn(
                "absolute left-2 top-1/2 -translate-y-1/2 z-20 md:hidden",
                "w-10 h-10 rounded-full flex items-center justify-center",
                "bg-background/80 backdrop-blur-sm border border-border/50 shadow-lg",
                "opacity-0 group-hover/carousel:opacity-100 transition-opacity",
                !canScrollLeft && "hidden"
              )}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scroll("right")}
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 z-20 md:hidden",
                "w-10 h-10 rounded-full flex items-center justify-center",
                "bg-background/80 backdrop-blur-sm border border-border/50 shadow-lg",
                "opacity-0 group-hover/carousel:opacity-100 transition-opacity",
                !canScrollRight && "hidden"
              )}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
});

ContentCarousel.displayName = "ContentCarousel";
