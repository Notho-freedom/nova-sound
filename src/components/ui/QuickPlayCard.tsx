"use client";

import { memo } from "react";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface QuickPlayCardProps {
  title: string;
  subtitle?: string;
  imageUrl: string;
  isPlaying?: boolean;
  isCurrent?: boolean;
  onClick?: () => void;
  className?: string;
}

export const QuickPlayCard = memo(({
  title,
  subtitle,
  imageUrl,
  isPlaying = false,
  isCurrent = false,
  onClick,
  className,
}: QuickPlayCardProps) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 p-3 rounded-xl w-full text-left",
        "bg-card/50 hover:bg-card/80 backdrop-blur-sm",
        "border border-border/30 hover:border-primary/30",
        "transition-all duration-300 group",
        isCurrent && "ring-2 ring-primary/50 bg-primary/5",
        className
      )}
    >
      {/* Image */}
      <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 shadow-lg">
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
        
        {/* Play overlay */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center",
            "bg-black/40 opacity-0 group-hover:opacity-100",
            "transition-opacity duration-300",
            isCurrent && isPlaying && "opacity-100 bg-black/50"
          )}
        >
          {isCurrent && isPlaying ? (
            <div className="flex items-end gap-0.5 h-5">
              <div className="w-1 bg-primary rounded-full animate-wave" style={{ height: "100%" }} />
              <div className="w-1 bg-primary rounded-full animate-wave" style={{ animationDelay: "0.15s", height: "70%" }} />
              <div className="w-1 bg-primary rounded-full animate-wave" style={{ animationDelay: "0.3s", height: "85%" }} />
            </div>
          ) : (
            <Play className="w-6 h-6 text-white fill-current" />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "font-medium text-sm truncate transition-colors",
            isCurrent ? "text-primary" : "text-foreground"
          )}
        >
          {title}
        </p>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>

      {/* Hover play button */}
      <div
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
          "bg-primary shadow-lg shadow-primary/25",
          "opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100",
          "transition-all duration-300"
        )}
      >
        {isCurrent && isPlaying ? (
          <Pause className="w-4 h-4 text-primary-foreground fill-current" />
        ) : (
          <Play className="w-4 h-4 text-primary-foreground fill-current ml-0.5" />
        )}
      </div>
    </motion.button>
  );
});

QuickPlayCard.displayName = "QuickPlayCard";
