"use client";

import { Play, Music, Search, Library, Settings, Video, Download, Sparkles, Clock, Disc3, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Track } from "@/types/music";
import type { LucideIcon } from "lucide-react";

interface HeroContentProps {
  /** Page title */
  title: string;
  /** Subtitle or description */
  subtitle?: string;
  /** Icon component */
  icon?: LucideIcon;
  /** Current featured track (for display) */
  currentTrack?: Track;
  /** Action button click handler */
  onActionClick?: () => void;
  /** Action button label */
  actionLabel?: string;
  /** Stats to display */
  stats?: Array<{ label: string; value: string | number; icon?: LucideIcon }>;
  /** Greeting text (for home variant) */
  greeting?: string;
  /** User name (for home variant) */
  userName?: string;
  /** Additional class names */
  className?: string;
  /** Content alignment */
  align?: "left" | "center";
  /** Size variant */
  size?: "default" | "compact" | "large";
}

/**
 * Hero content component - displays title, subtitle, stats, and action buttons
 * Adapts to different hero variants
 */
export const HeroContent = ({
  title,
  subtitle,
  icon: Icon = Music,
  currentTrack,
  onActionClick,
  actionLabel = "Lire maintenant",
  stats,
  greeting,
  userName,
  className,
  align = "left",
  size = "default",
}: HeroContentProps) => {
  const sizeClasses = {
    compact: {
      container: "p-4 md:p-6 pb-8 md:pb-12",
      icon: "w-10 h-10 md:w-12 md:h-12",
      iconInner: "w-5 h-5 md:w-6 md:h-6",
      title: "text-2xl md:text-3xl",
      subtitle: "text-sm md:text-base",
      greeting: "text-base md:text-lg",
    },
    default: {
      container: "p-6 md:p-10 pb-14 md:pb-20",
      icon: "w-12 h-12 md:w-14 md:h-14",
      iconInner: "w-6 h-6 md:w-7 md:h-7",
      title: "text-3xl md:text-5xl lg:text-6xl",
      subtitle: "text-base md:text-lg",
      greeting: "text-lg md:text-xl",
    },
    large: {
      container: "p-8 md:p-12 pb-16 md:pb-24",
      icon: "w-14 h-14 md:w-16 md:h-16",
      iconInner: "w-7 h-7 md:w-8 md:h-8",
      title: "text-4xl md:text-6xl lg:text-7xl",
      subtitle: "text-lg md:text-xl",
      greeting: "text-xl md:text-2xl",
    },
  }[size];

  return (
    <div 
      className={cn(
        "relative z-10 h-full flex flex-col justify-end",
        sizeClasses.container,
        className
      )}
    >
      <div className={cn(
        "space-y-4 max-w-4xl",
        align === "center" && "mx-auto text-center"
      )}>
        {/* Greeting (Home variant) */}
        {greeting && (
          <p className={cn(
            "font-medium text-white/90 drop-shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-500",
            sizeClasses.greeting
          )}>
            {greeting}{userName && `, ${userName}`}
          </p>
        )}

        {/* Icon + Title */}
        <div className={cn(
          "flex gap-4 mb-2",
          align === "center" ? "justify-center items-center" : "items-end"
        )}>
          <div className={cn(
            "rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/25 shadow-lg",
            "animate-in fade-in zoom-in-95 duration-500",
            sizeClasses.icon
          )}>
            <Icon className={cn("text-white drop-shadow", sizeClasses.iconInner)} />
          </div>
          <h1 className={cn(
            "font-display font-bold text-white leading-tight",
            "drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]",
            "animate-in fade-in slide-in-from-bottom-4 duration-700",
            sizeClasses.title
          )}>
            {title}
          </h1>
        </div>

        {/* Subtitle */}
        {subtitle && (
          <p className={cn(
            "text-white/90 font-medium max-w-2xl",
            "drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]",
            "animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100",
            sizeClasses.subtitle,
            align === "center" && "mx-auto"
          )}>
            {subtitle}
          </p>
        )}

        {/* Stats (Library variant) */}
        {stats && stats.length > 0 && (
          <div className={cn(
            "flex gap-6 pt-2",
            "animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150",
            align === "center" && "justify-center"
          )}>
            {stats.map((stat, index) => (
              <div key={index} className="flex items-center gap-2">
                {stat.icon && <stat.icon className="w-4 h-4 text-white/70" />}
                <span className="text-white font-bold text-lg md:text-xl drop-shadow">
                  {stat.value}
                </span>
                <span className="text-white/70 text-sm">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Featured Track Info */}
        {currentTrack && (
          <div className="pt-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            <p className="text-white/80 text-sm md:text-base drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
              <span className="text-white/60">En vedette :</span>{" "}
              <span className="font-semibold text-white">{currentTrack.title}</span>
              {" "}par {currentTrack.artist}
            </p>
          </div>
        )}

        {/* Action Button */}
        {onActionClick && (
          <div className={cn(
            "pt-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300",
            align === "center" && "flex justify-center"
          )}>
            <Button
              onClick={onActionClick}
              size="lg"
              className={cn(
                "bg-white text-black hover:bg-white/90 font-semibold rounded-full shadow-xl",
                "transition-all duration-200 hover:scale-105 active:scale-95",
                "px-8 py-6 text-base md:text-lg"
              )}
            >
              <Play className="w-5 h-5 mr-2 fill-current" />
              {actionLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
