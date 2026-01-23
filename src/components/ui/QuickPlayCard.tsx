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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className={cn(
        // Pure Vision Pro spatial quick play card
        "relative flex items-center gap-4 p-3 rounded-2xl w-full text-left",
        "bg-white/[0.03] backdrop-blur-2xl",
        "border border-white/[0.06]",
        "hover:bg-white/[0.06]",
        "hover:border-white/[0.1]",
        "hover:shadow-[0_12px_32px_rgba(0,0,0,0.35)]",
        "transition-all duration-300 group overflow-hidden",
        isCurrent && [
          "bg-primary/[0.08]",
          "border-primary/30",
          "shadow-[0_0_30px_hsl(var(--primary)/0.2)]",
        ],
        className
      )}
    >
      {/* Ambient glow on hover */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 80% at 0% 50%, hsl(var(--primary) / 0.1) 0%, transparent 60%)'
        }}
      />

      {/* Image */}
      <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 shadow-lg shadow-black/30">
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
        
        {/* Shine effect */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Play overlay */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center",
            "bg-black/50 opacity-0 group-hover:opacity-100",
            "transition-all duration-300",
            isCurrent && isPlaying && "opacity-100"
          )}
        >
          {isCurrent && isPlaying ? (
            <div className="flex items-end gap-[3px] h-5">
              <motion.div 
                className="w-[3px] bg-white rounded-full"
                animate={{ height: ["60%", "100%", "60%"] }}
                transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div 
                className="w-[3px] bg-white rounded-full"
                animate={{ height: ["100%", "60%", "100%"] }}
                transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
              />
              <motion.div 
                className="w-[3px] bg-white rounded-full"
                animate={{ height: ["75%", "100%", "75%"] }}
                transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
              />
            </div>
          ) : (
            <Play className="w-5 h-5 text-white fill-current drop-shadow-lg" />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="relative flex-1 min-w-0">
        <p
          className={cn(
            "font-medium text-sm truncate transition-colors",
            isCurrent ? "text-primary" : "text-foreground"
          )}
        >
          {title}
        </p>
        {subtitle && (
          <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Hover play button */}
      <div
        className={cn(
          "relative w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
          "bg-white text-black",
          "shadow-xl shadow-white/20",
          "opacity-0 group-hover:opacity-100",
          "scale-75 group-hover:scale-100",
          "transition-all duration-300"
        )}
      >
        {isCurrent && isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </div>
    </motion.button>
  );
});

QuickPlayCard.displayName = "QuickPlayCard";
