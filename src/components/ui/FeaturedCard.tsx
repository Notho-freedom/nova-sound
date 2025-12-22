"use client";

import { memo, ReactNode } from "react";
import { Play, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface FeaturedCardProps {
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl: string;
  badge?: string;
  badgeColor?: string;
  icon?: ReactNode;
  isPlaying?: boolean;
  isCurrent?: boolean;
  onClick?: () => void;
  onPlay?: () => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const FeaturedCard = memo(({
  title,
  subtitle,
  description,
  imageUrl,
  badge,
  badgeColor = "bg-primary",
  icon,
  isPlaying = false,
  isCurrent = false,
  onClick,
  onPlay,
  size = "md",
  className,
}: FeaturedCardProps) => {
  const sizeClasses = {
    sm: "w-36",
    md: "w-44",
    lg: "w-56",
  };

  const imageSizeClasses = {
    sm: "h-36",
    md: "h-44",
    lg: "h-56",
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={cn(
        "group flex-shrink-0 snap-start cursor-pointer",
        sizeClasses[size],
        className
      )}
      onClick={onClick}
    >
      {/* Image container */}
      <div
        className={cn(
          "relative rounded-xl overflow-hidden mb-3 shadow-lg",
          imageSizeClasses[size],
          "ring-1 ring-white/5 group-hover:ring-primary/30",
          "transition-all duration-300"
        )}
      >
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          loading="lazy"
          decoding="async"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Badge */}
        {badge && (
          <div
            className={cn(
              "absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider",
              badgeColor,
              "text-primary-foreground shadow-lg"
            )}
          >
            {badge}
          </div>
        )}

        {/* Icon */}
        {icon && (
          <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            {icon}
          </div>
        )}

        {/* Play button */}
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          whileHover={{ scale: 1.1 }}
          className={cn(
            "absolute bottom-3 right-3 z-10",
            "w-11 h-11 rounded-full flex items-center justify-center",
            "bg-primary shadow-xl shadow-primary/30",
            "opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0",
            "transition-all duration-300",
            isCurrent && isPlaying && "opacity-100 translate-y-0"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onPlay?.();
          }}
        >
          {isCurrent && isPlaying ? (
            <div className="flex items-end gap-0.5 h-4">
              <div className="w-1 bg-primary-foreground rounded-full animate-wave" style={{ height: "100%" }} />
              <div className="w-1 bg-primary-foreground rounded-full animate-wave" style={{ animationDelay: "0.15s", height: "70%" }} />
              <div className="w-1 bg-primary-foreground rounded-full animate-wave" style={{ animationDelay: "0.3s", height: "85%" }} />
            </div>
          ) : (
            <Play className="w-5 h-5 text-primary-foreground fill-current ml-0.5" />
          )}
        </motion.button>

        {/* Now playing indicator */}
        {isCurrent && (
          <div className="absolute inset-0 ring-2 ring-primary ring-inset rounded-xl" />
        )}
      </div>

      {/* Content */}
      <div className="px-1">
        <p
          className={cn(
            "font-medium text-sm truncate transition-colors",
            isCurrent ? "text-primary" : "text-foreground group-hover:text-primary"
          )}
        >
          {title}
        </p>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {subtitle}
          </p>
        )}
        {description && (
          <p className="text-xs text-muted-foreground/70 truncate mt-0.5 line-clamp-2">
            {description}
          </p>
        )}
      </div>
    </motion.div>
  );
});

FeaturedCard.displayName = "FeaturedCard";
