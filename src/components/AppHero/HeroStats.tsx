"use client";

import { useEffect, useState, useRef } from "react";
import { Music, Disc3, Clock, User, Heart, ListMusic } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Stat {
  label: string;
  value: number;
  suffix?: string;
  icon?: LucideIcon;
}

interface HeroStatsProps {
  /** Stats to display */
  stats: Stat[];
  /** Enable count-up animation */
  animate?: boolean;
  /** Animation duration in ms */
  animationDuration?: number;
  /** Additional class names */
  className?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Layout variant */
  layout?: "horizontal" | "vertical" | "grid";
}

/**
 * Hero stats component with animated counters
 * Displays statistics like track count, album count, total duration
 */
export const HeroStats = ({
  stats,
  animate = true,
  animationDuration = 2000,
  className,
  size = "md",
  layout = "horizontal",
}: HeroStatsProps) => {
  const [displayValues, setDisplayValues] = useState<number[]>(stats.map(() => 0));
  const [hasAnimated, setHasAnimated] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Animate numbers when visible
  useEffect(() => {
    if (!animate || hasAnimated) {
      setDisplayValues(stats.map(s => s.value));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          animateValues();
        }
      },
      { threshold: 0.5 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [stats, animate, hasAnimated]);

  const animateValues = () => {
    const startTime = Date.now();
    const targetValues = stats.map(s => s.value);

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      
      // Easing function (ease-out cubic)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      setDisplayValues(targetValues.map(target => 
        Math.round(target * easeOut)
      ));

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  };

  const sizeClasses = {
    sm: {
      container: "gap-4",
      value: "text-lg md:text-xl font-bold",
      label: "text-xs",
      icon: "w-3.5 h-3.5",
    },
    md: {
      container: "gap-6",
      value: "text-xl md:text-2xl font-bold",
      label: "text-sm",
      icon: "w-4 h-4",
    },
    lg: {
      container: "gap-8",
      value: "text-2xl md:text-3xl font-bold",
      label: "text-base",
      icon: "w-5 h-5",
    },
  }[size];

  const layoutClasses = {
    horizontal: "flex flex-wrap items-center",
    vertical: "flex flex-col",
    grid: "grid grid-cols-2 md:grid-cols-4",
  }[layout];

  return (
    <div 
      ref={containerRef}
      className={cn(
        layoutClasses,
        sizeClasses.container,
        className
      )}
    >
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        const displayValue = displayValues[index] ?? stat.value;
        
        return (
          <div 
            key={index}
            className={cn(
              "flex items-center gap-2",
              layout === "vertical" && "justify-between py-2 border-b border-white/10 last:border-0",
              layout === "grid" && "flex-col text-center p-4 rounded-xl bg-white/5 backdrop-blur-sm"
            )}
          >
            {Icon && (
              <Icon className={cn(
                sizeClasses.icon,
                "text-white/60"
              )} />
            )}
            <div className={cn(
              "flex items-baseline gap-1",
              layout === "grid" && "flex-col items-center gap-0"
            )}>
              <span className={cn(
                sizeClasses.value,
                "text-white tabular-nums drop-shadow-lg"
              )}>
                {displayValue.toLocaleString()}
                {stat.suffix && (
                  <span className="text-white/70 ml-0.5">{stat.suffix}</span>
                )}
              </span>
              <span className={cn(
                sizeClasses.label,
                "text-white/60"
              )}>
                {stat.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Helper function to format duration
export const formatDurationStat = (totalSeconds: number): { value: number; suffix: string; label: string } => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  if (hours > 0) {
    return { value: hours, suffix: "h", label: `${minutes}m` };
  }
  return { value: minutes, suffix: "min", label: "" };
};
