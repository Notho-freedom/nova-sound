import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";

interface AlbumArtProps {
  src?: string;
  alt: string;
  isPlaying: boolean;
  className?: string;
}

export const AlbumArt = ({ src, alt, isPlaying, className }: AlbumArtProps) => {
  const coverUrl = getCoverUrl(src);
  return (
    <div className={cn("relative group", className)}>
      {/* Outer glow ring */}
      <div 
        className={cn(
          "absolute -inset-4 rounded-full opacity-0 transition-opacity duration-500",
          "bg-gradient-to-r from-neon-cyan via-neon-purple to-neon-magenta blur-xl",
          isPlaying && "opacity-30 animate-pulse-glow"
        )}
      />
      
      {/* Rotating border ring */}
      <div 
        className={cn(
          "absolute -inset-2 rounded-full p-[2px] transition-all duration-500",
          "bg-gradient-neon",
          isPlaying ? "opacity-100 animate-rotate-slow" : "opacity-30"
        )}
        style={{ 
          background: isPlaying 
            ? "conic-gradient(from 0deg, hsl(var(--neon-cyan)), hsl(var(--neon-magenta)), hsl(var(--neon-purple)), hsl(var(--neon-cyan)))" 
            : undefined 
        }}
      >
        <div className="w-full h-full rounded-full bg-background" />
      </div>
      
      {/* Album image */}
      <div 
        className={cn(
          "relative rounded-full overflow-hidden border-2 border-glass-border",
          "shadow-2xl transition-all duration-500",
          isPlaying && "glow-cyan"
        )}
      >
        <img
          src={coverUrl}
          alt={alt}
          className={cn(
            "w-full h-full object-cover transition-transform duration-[20000ms] ease-linear",
            isPlaying && "animate-rotate-slow"
          )}
        />
        
        {/* Center hole overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[15%] h-[15%] rounded-full bg-background border-2 border-glass-border shadow-inner" />
        </div>
      </div>
    </div>
  );
};
