import { useState, useEffect } from "react";
import { getDefaultHeroImage } from "@/lib/audio";
import { cn } from "@/lib/utils";

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string | null;
  alt: string;
  fallback?: string;
  className?: string;
}

/**
 * Image component with automatic fallback to default hero images
 * Handles image loading errors gracefully
 */
export const ImageWithFallback = ({
  src,
  alt,
  fallback,
  className,
  onError,
  onLoad,
  ...props
}: ImageWithFallbackProps) => {
  const [imageError, setImageError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src || fallback || getDefaultHeroImage());

  // Update currentSrc when src prop changes (reset error state)
  useEffect(() => {
    if (src && src !== currentSrc) {
      setCurrentSrc(src);
      setImageError(false);
    } else if (!src) {
      setCurrentSrc(fallback || getDefaultHeroImage());
    }
  }, [src, fallback]);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!imageError) {
      setImageError(true);
      const defaultImage = fallback || getDefaultHeroImage();
      setCurrentSrc(defaultImage);
    }
    onError?.(e);
  };

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setImageError(false);
    onLoad?.(e);
  };

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={cn(className)}
      onError={handleError}
      onLoad={handleLoad}
      {...props}
    />
  );
};
