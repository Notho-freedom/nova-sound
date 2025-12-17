"use client";

import { Play, Pause, SkipBack, SkipForward, Shuffle, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import { Button } from "@/components/ui/button";
import type { Track } from "@/types/music";

interface HeroSectionProps {
  currentTrack?: Track | null;
  isPlaying?: boolean;
  userName?: string;
  greeting?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onShuffle?: () => void;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  className?: string;
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Bonjour";
  if (hour < 18) return "Bon après-midi";
  return "Bonsoir";
};

export const HeroSection = ({
  currentTrack,
  isPlaying = false,
  userName,
  greeting,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onShuffle,
  onToggleFavorite,
  isFavorite = false,
  className,
}: HeroSectionProps) => {
  const displayGreeting = greeting || getGreeting();

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl",
        "min-h-[280px] md:min-h-[320px]",
        className
      )}
    >
      {/* Background with album art */}
      {currentTrack ? (
        <>
          <img
            src={getCoverUrl(currentTrack.coverUrl)}
            alt=""
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-primary/10 to-secondary/20" />
      )}

      {/* Content */}
      <div className="relative h-full p-6 md:p-8 flex flex-col justify-between">
        {/* Greeting */}
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
            {displayGreeting}
            {userName && `, ${userName}`}
          </h1>
          <p className="text-white/70 mt-2 text-sm md:text-base">
            {currentTrack
              ? "En lecture maintenant"
              : "Bienvenue sur NEXUS"
            }
          </p>
        </div>

        {/* Now Playing Section */}
        {currentTrack && (
          <div className="flex items-end gap-6">
            {/* Album Art */}
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-xl overflow-hidden shadow-2xl flex-shrink-0 ring-2 ring-white/20">
              <img
                src={getCoverUrl(currentTrack.coverUrl)}
                alt={currentTrack.album || currentTrack.title}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Track Info and Controls */}
            <div className="flex-1 min-w-0 pb-2">
              <p className="text-white/60 text-xs uppercase tracking-wider mb-1">
                En lecture
              </p>
              <h2 className="font-display text-2xl md:text-3xl font-bold text-white truncate drop-shadow-lg">
                {currentTrack.title}
              </h2>
              <p className="text-white/80 text-lg truncate">
                {currentTrack.artist}
              </p>
              {currentTrack.album && (
                <p className="text-white/60 text-sm truncate mt-0.5">
                  {currentTrack.album}
                </p>
              )}

              {/* Controls */}
              <div className="flex items-center gap-2 mt-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onShuffle}
                  className="text-white/70 hover:text-white hover:bg-white/10"
                >
                  <Shuffle className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onPrevious}
                  className="text-white/70 hover:text-white hover:bg-white/10"
                >
                  <SkipBack className="w-5 h-5" />
                </Button>
                <Button
                  variant="default"
                  size="icon"
                  onClick={isPlaying ? onPause : onPlay}
                  className="w-12 h-12 rounded-full bg-white text-black hover:bg-white/90 hover:scale-105 transition-transform"
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 fill-current" />
                  ) : (
                    <Play className="w-6 h-6 fill-current ml-1" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onNext}
                  className="text-white/70 hover:text-white hover:bg-white/10"
                >
                  <SkipForward className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleFavorite}
                  className={cn(
                    "hover:bg-white/10 transition-colors",
                    isFavorite ? "text-red-500" : "text-white/70 hover:text-white"
                  )}
                >
                  <Heart className={cn("w-5 h-5", isFavorite && "fill-current")} />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Empty state when no track */}
        {!currentTrack && (
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-xl bg-white/10 flex items-center justify-center">
              <Play className="w-10 h-10 text-white/50" />
            </div>
            <div>
              <p className="text-white/80 text-lg">Aucune piste en cours</p>
              <p className="text-white/50 text-sm">Sélectionnez une piste pour commencer</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
