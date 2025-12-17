"use client";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface GenreCardProps {
  name: string;
  trackCount?: number;
  gradient?: string;
  icon?: React.ReactNode;
  imageUrl?: string;
  onClick?: () => void;
  className?: string;
}

// Predefined gradients for common genres
const genreGradients: Record<string, string> = {
  pop: "from-pink-500 to-rose-600",
  rock: "from-red-600 to-orange-500",
  jazz: "from-amber-500 to-yellow-600",
  classical: "from-blue-400 to-indigo-500",
  electronic: "from-purple-500 to-violet-600",
  hiphop: "from-gray-700 to-gray-900",
  "hip-hop": "from-gray-700 to-gray-900",
  rap: "from-gray-700 to-gray-900",
  rnb: "from-pink-600 to-purple-600",
  "r&b": "from-pink-600 to-purple-600",
  soul: "from-orange-500 to-amber-600",
  country: "from-amber-600 to-orange-500",
  reggae: "from-green-500 to-yellow-500",
  metal: "from-gray-800 to-black",
  blues: "from-blue-600 to-indigo-700",
  folk: "from-green-600 to-emerald-700",
  indie: "from-teal-500 to-cyan-600",
  alternative: "from-violet-500 to-purple-600",
  dance: "from-fuchsia-500 to-pink-600",
  house: "from-blue-500 to-purple-600",
  techno: "from-gray-600 to-purple-800",
  ambient: "from-sky-400 to-blue-500",
  chill: "from-cyan-400 to-teal-500",
  lofi: "from-purple-400 to-pink-400",
  "lo-fi": "from-purple-400 to-pink-400",
  world: "from-emerald-500 to-teal-600",
  latin: "from-red-500 to-orange-400",
  afrobeat: "from-yellow-500 to-orange-600",
  kpop: "from-pink-400 to-purple-500",
  "k-pop": "from-pink-400 to-purple-500",
  french: "from-blue-500 to-red-500",
  default: "from-primary/80 to-secondary/80",
};

export const GenreCard = ({
  name,
  trackCount,
  gradient,
  icon,
  imageUrl,
  onClick,
  className,
}: GenreCardProps) => {
  // Get gradient based on genre name or use provided/default
  const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const effectiveGradient = gradient || genreGradients[normalizedName] || genreGradients.default;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "group relative overflow-hidden rounded-xl",
            "aspect-[2/1] min-h-[80px]",
            "transition-all duration-200 ease-out",
            "hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
            "text-left w-full",
            className
          )}
        >
          {/* Background image if provided */}
          {imageUrl && (
            <img
              src={imageUrl}
              alt=""
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-40 transition-opacity"
            />
          )}
          
          {/* Gradient background */}
          <div className={cn("absolute inset-0 bg-gradient-to-br", effectiveGradient)} />

          {/* Decorative element */}
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-125 transition-transform duration-300" />

          {/* Content */}
          <div className="relative h-full p-4 flex flex-col justify-end">
            <div className="flex items-center gap-2">
              {icon && <div className="text-white/90">{icon}</div>}
              <h3 className="font-display text-lg font-bold text-white drop-shadow-lg capitalize">
                {name}
              </h3>
            </div>
            {trackCount !== undefined && (
              <p className="text-white/70 text-xs mt-0.5">
                {trackCount} titre{trackCount > 1 ? "s" : ""}
              </p>
            )}
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-sm font-medium capitalize">{name}</div>
        {trackCount !== undefined && (
          <div className="text-xs text-muted-foreground">{trackCount} titre{trackCount > 1 ? "s" : ""}</div>
        )}
      </TooltipContent>
    </Tooltip>
  );
};

// Export gradients for external use
export { genreGradients };
