"use client";

import { memo, ReactNode } from "react";
import { ChevronLeft, Play, Shuffle, Heart, MoreHorizontal, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { motion } from "framer-motion";

interface DetailHeaderProps {
  title: string;
  subtitle?: string;
  type?: string;
  imageUrl?: string;
  stats?: Array<{ label: string; value: string | number }>;
  onBack?: () => void;
  onPlay?: () => void;
  onShuffle?: () => void;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  actions?: ReactNode;
  imageShape?: "square" | "circle";
  className?: string;
}

export const DetailHeader = memo(({
  title,
  subtitle,
  type,
  imageUrl,
  stats,
  onBack,
  onPlay,
  onShuffle,
  onToggleFavorite,
  isFavorite = false,
  actions,
  imageShape = "square",
  className,
}: DetailHeaderProps) => (
  <div className={cn("space-y-6", className)}>
    {/* Back button */}
    {onBack && (
      <motion.button
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className={cn(
          "inline-flex items-center gap-2 text-sm text-muted-foreground",
          "hover:text-foreground transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
        )}
      >
        <ChevronLeft className="w-4 h-4" />
        Retour
      </motion.button>
    )}

    {/* Main header */}
    <div className="flex gap-6 flex-col md:flex-row">
      {/* Image */}
      {imageUrl && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "flex-shrink-0 shadow-2xl overflow-hidden",
            imageShape === "circle"
              ? "w-40 h-40 md:w-52 md:h-52 rounded-full"
              : "w-40 h-40 md:w-52 md:h-52 rounded-xl"
          )}
        >
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover"
          />
        </motion.div>
      )}

      {/* Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col justify-end"
      >
        {type && (
          <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">
            {type}
          </p>
        )}

        <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-2">
          {title}
        </h1>

        {subtitle && (
          <p className="text-lg text-muted-foreground mb-3">{subtitle}</p>
        )}

        {stats && stats.length > 0 && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4 flex-wrap">
            {stats.map((stat, i) => (
              <span key={i} className="flex items-center gap-1">
                {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
                <span className="opacity-70">{stat.label}</span>
                {i < stats.length - 1 && <span className="mx-2 opacity-30">•</span>}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 mt-2">
          {onPlay && (
            <Button onClick={onPlay} size="lg" className="gap-2 shadow-lg shadow-primary/25">
              <Play className="w-5 h-5 fill-current" />
              Lecture
            </Button>
          )}
          
          {onShuffle && (
            <Button onClick={onShuffle} variant="outline" size="lg" className="gap-2">
              <Shuffle className="w-4 h-4" />
              Aléatoire
            </Button>
          )}
          
          {onToggleFavorite && (
            <Button
              onClick={onToggleFavorite}
              variant="ghost"
              size="icon"
              className="w-11 h-11"
            >
              <Heart
                className={cn(
                  "w-5 h-5",
                  isFavorite && "fill-red-500 text-red-500"
                )}
              />
            </Button>
          )}
          
          {actions}
        </div>
      </motion.div>
    </div>
  </div>
));

DetailHeader.displayName = "DetailHeader";

interface TrackTableProps {
  children: ReactNode;
  showAlbum?: boolean;
  stickyHeader?: boolean;
  className?: string;
}

export const TrackTable = memo(({
  children,
  showAlbum = true,
  stickyHeader = true,
  className,
}: TrackTableProps) => (
  <div
    className={cn(
      "bg-card/30 backdrop-blur-sm rounded-2xl border border-border/30 overflow-hidden",
      className
    )}
  >
    <table className="w-full">
      <thead
        className={cn(
          stickyHeader && "sticky top-0 z-10 bg-background/80 backdrop-blur-md"
        )}
      >
        <tr className="border-b border-border/30">
          <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground w-12">
            #
          </th>
          <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground">
            Titre
          </th>
          {showAlbum && (
            <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden md:table-cell">
              Album
            </th>
          )}
          <th className="px-4 py-3 text-right text-xs font-display uppercase tracking-widest text-muted-foreground">
            Durée
          </th>
          <th className="px-4 py-3 w-12"></th>
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
));

TrackTable.displayName = "TrackTable";

interface TrackRowProps {
  index: number;
  title: string;
  artist: string;
  album?: string;
  duration: string;
  imageUrl?: string;
  isPlaying?: boolean;
  isCurrent?: boolean;
  showAlbum?: boolean;
  onClick?: () => void;
  actions?: ReactNode;
  badge?: ReactNode;
  className?: string;
}

export const TrackRow = memo(({
  index,
  title,
  artist,
  album,
  duration,
  imageUrl,
  isPlaying = false,
  isCurrent = false,
  showAlbum = true,
  onClick,
  actions,
  badge,
  className,
}: TrackRowProps) => (
  <tr
    onClick={onClick}
    className={cn(
      "group cursor-pointer transition-all duration-200",
      isCurrent ? "bg-primary/10" : "hover:bg-muted/30",
      className
    )}
  >
    {/* Index / Playing indicator */}
    <td className="px-4 py-3">
      <div className="w-6 flex items-center justify-center">
        {isCurrent && isPlaying ? (
          <div className="flex items-center gap-0.5">
            <div className="w-1 h-4 bg-primary rounded-full animate-wave" />
            <div className="w-1 h-4 bg-primary rounded-full animate-wave" style={{ animationDelay: "0.1s" }} />
            <div className="w-1 h-4 bg-primary rounded-full animate-wave" style={{ animationDelay: "0.2s" }} />
          </div>
        ) : (
          <>
            <span className="text-sm text-muted-foreground group-hover:hidden">{index}</span>
            <Play className="w-4 h-4 text-foreground hidden group-hover:block fill-current" />
          </>
        )}
      </div>
    </td>

    {/* Track info */}
    <td className="px-4 py-3">
      <div className="flex items-center gap-3">
        {imageUrl && (
          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 shadow-md">
            <img src={imageUrl} alt={album || title} loading="lazy" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={cn("text-sm font-medium truncate", isCurrent ? "text-primary" : "text-foreground")}>
              {title}
            </p>
            {badge}
          </div>
          <p className="text-xs text-muted-foreground truncate">{artist}</p>
        </div>
      </div>
    </td>

    {/* Album */}
    {showAlbum && (
      <td className="px-4 py-3 hidden md:table-cell">
        <p className="text-sm text-muted-foreground truncate">{album}</p>
      </td>
    )}

    {/* Duration */}
    <td className="px-4 py-3 text-right">
      <span className="text-sm text-muted-foreground font-mono">{duration}</span>
    </td>

    {/* Actions */}
    <td className="px-4 py-3">
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        {actions || (
          <button className="p-1 text-muted-foreground hover:text-foreground">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        )}
      </div>
    </td>
  </tr>
));

TrackRow.displayName = "TrackRow";
