"use client";

import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { useState, useEffect } from "react";
import type { Track } from "@/types/music";

interface HeroSectionProps {
  tracks?: Track[];
  currentTrack?: Track | null;
  isPlaying?: boolean;
  userName?: string;
  greeting?: string;
  className?: string;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  onTrackSelect?: (track: Track) => void;
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Bonjour";
  if (hour < 18) return "Bon après-midi";
  return "Bonsoir";
};

export const HeroSection = ({
  tracks = [],
  currentTrack,
  isPlaying = false,
  userName,
  greeting,
  className,
  autoPlay = true,
  autoPlayInterval = 5000,
  onTrackSelect,
}: HeroSectionProps) => {
  const displayGreeting = greeting || getGreeting();
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [current, setCurrent] = useState(0);

  // Combiner currentTrack avec tracks, en mettant currentTrack en premier
  const displayTracks = currentTrack
    ? [currentTrack, ...tracks.filter(t => t.id !== currentTrack.id)]
    : tracks;

  // Auto-rotation du carrousel
  useEffect(() => {
    if (!autoPlay || !api || displayTracks.length <= 1) return;

    const interval = setInterval(() => {
      api.scrollNext();
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [api, autoPlay, autoPlayInterval, displayTracks.length]);

  // Suivre l'index actuel
  useEffect(() => {
    if (!api) return;

    const onSelect = () => {
      setCurrent(api.selectedScrollSnap());
    };

    api.on("select", onSelect);
    onSelect();

    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  const handleTrackClick = (track: Track) => {
    if (onTrackSelect) {
      onTrackSelect(track);
    }
  };

  if (displayTracks.length === 0) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl",
          "min-h-[280px] md:min-h-[320px]",
          className
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-primary/10 to-secondary/20" />
        <div className="relative h-full p-6 md:p-8 flex flex-col justify-between">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
              {displayGreeting}
              {userName && `, ${userName}`}
            </h1>
            <p className="text-white/70 mt-2 text-sm md:text-base">
              Bienvenue sur NEXUS
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-xl bg-white/10 flex items-center justify-center">
              <Play className="w-10 h-10 text-white/50" />
            </div>
            <div>
              <p className="text-white/80 text-lg">Aucune piste disponible</p>
              <p className="text-white/50 text-sm">Sélectionnez une piste pour commencer</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl",
        "min-h-[280px] md:min-h-[320px]",
        className
      )}
    >
      <Carousel setApi={setApi} className="w-full h-full" opts={{ loop: true }}>
        <CarouselContent className="h-full -ml-0">
          {displayTracks.map((track, index) => (
            <CarouselItem key={track.id} className="h-full pl-0 basis-full">
              <div className="relative h-full w-full">
                {/* Background with album art */}
                <img
                  src={getCoverUrl(track.coverUrl)}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-50"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

                 {/* Content */}
                 <div className="relative h-full p-6 md:p-8 flex flex-col justify-between gap-8">
                   {/* Greeting */}
                   <div>
                     <h1 className="font-display text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
                       {index === 0 && currentTrack
                         ? displayGreeting + (userName ? `, ${userName}` : "")
                         : displayGreeting + (userName ? `, ${userName}` : "")}
                     </h1>
                     <p className="text-white/70 mt-2 text-sm md:text-base">
                       {index === 0 && currentTrack
                         ? "En lecture maintenant"
                         : "Découvrez votre musique"}
                     </p>
                   </div>

                   {/* Track Info */}
                   <div className="flex items-end gap-6 pb-4">
                    {/* Album Art */}
                    <div
                      className="w-32 h-32 md:w-40 md:h-40 rounded-xl overflow-hidden shadow-2xl flex-shrink-0 ring-2 ring-white/20 cursor-pointer transition-transform hover:scale-105"
                      onClick={() => handleTrackClick(track)}
                    >
                      <img
                        src={getCoverUrl(track.coverUrl)}
                        alt={track.album || track.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Track Info */}
                    <div className="flex-1 min-w-0 pb-2">
                      <p className="text-white/60 text-xs uppercase tracking-wider mb-1">
                        {index === 0 && currentTrack ? "En lecture" : "Piste"}
                      </p>
                      <h2
                        className="font-display text-2xl md:text-3xl font-bold text-white truncate drop-shadow-lg cursor-pointer hover:underline"
                        onClick={() => handleTrackClick(track)}
                      >
                        {track.title}
                      </h2>
                      <p
                        className="text-white/80 text-lg truncate cursor-pointer hover:underline"
                        onClick={() => handleTrackClick(track)}
                      >
                        {track.artist}
                      </p>
                      {track.album && (
                        <p className="text-white/60 text-sm truncate mt-0.5">
                          {track.album}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

         {/* Indicators */}
        {displayTracks.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {displayTracks.map((_, index) => (
              <button
                key={index}
                onClick={() => api?.scrollTo(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  index === current
                    ? "bg-white w-8"
                    : "bg-white/40 hover:bg-white/60"
                )}
                aria-label={`Aller à la slide ${index + 1}`}
              />
            ))}
          </div>
        )}
      </Carousel>
    </div>
  );
};
